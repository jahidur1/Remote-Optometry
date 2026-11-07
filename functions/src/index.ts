import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { format, addDays, startOfISOWeek } from 'date-fns';
import { jsPDF } from 'jspdf';

admin.initializeApp();

// --- SECRETS REGISTRY ---
const WHATSAPP_ACCESS_TOKEN = defineSecret('WHATSAPP_ACCESS_TOKEN');
const WHATSAPP_PHONE_NUMBER_ID = defineSecret('WHATSAPP_PHONE_NUMBER_ID');
const WHATSAPP_BUSINESS_ACCOUNT_ID = defineSecret('WHATSAPP_BUSINESS_ACCOUNT_ID');
const WHATSAPP_WEBHOOK_VERIFY_TOKEN = defineSecret('WHATSAPP_WEBHOOK_VERIFY_TOKEN');

const IST_TZ = 'Asia/Kolkata';

/**
 * 1. dailyTwoDayShiftReminder
 * Triggered at 10:00 PM IST daily.
 * Text-only 7-variable notification for Tomorrow and Day After.
 */
export const dailyTwoDayShiftReminder = onSchedule({
  schedule: '0 22 * * *',
  timeZone: IST_TZ,
  memory: '512MiB',
  secrets: [WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID],
}, async (event) => {
  const db = admin.firestore();
  
  // Logic Gate Audit
  const configSnap = await db.collection('system_settings').doc('whatsapp_config').get();
  const config = configSnap.data() || {};
  if (!config.masterEnabled || !config.dailyReminderEnabled || !config.whatsappEnabled) {
    console.log('DAILY_PULSE_SKIP: Automation switches are OFF.');
    return;
  }

  const tomorrow = addDays(new Date(), 1);
  const dayAfter = addDays(new Date(), 2);
  const dates = [tomorrow, dayAfter];
  const dateStrings = dates.map(d => format(d, 'yyyy-MM-dd'));

  const empSnap = await db.collection('employees').where('status', '==', 'Active').get();
  const shiftsSnap = await db.collection('shift_master').get();
  const shiftsMap = new Map();
  shiftsSnap.docs.forEach(d => shiftsMap.set(d.id, d.data()));

  for (const empDoc of empSnap.docs) {
    const emp = empDoc.data();
    if (!emp.whatsappNumber || emp.whatsappOptIn === false) continue;

    const templateVars: string[] = [emp.fullName];
    let missingRoster = false;

    for (const dStr of dateStrings) {
      const weekId = formatWeekId(new Date(dStr));
      const rosterId = `active_${weekId}_${emp.office}`;
      const rosterSnap = await db.collection('published_rosters').doc(rosterId).get();
      const assignments = rosterSnap.exists ? rosterSnap.data()?.assignments || [] : [];
      const assign = assignments.find((a: any) => a.employeeId === empDoc.id && a.date === dStr);
      
      if (!assign) { 
        missingRoster = true; 
        break; 
      }
      
      const s = shiftsMap.get(assign.shiftId);
      const isOff = assign.shiftId === 'none';
      templateVars.push(`${format(new Date(dStr), 'EEEE')}, ${format(new Date(dStr), 'dd MMM')}`);
      templateVars.push(isOff ? 'WEEK OFF' : (s?.name || 'DUTY'));
      templateVars.push(isOff ? 'Enjoy your day off!' : `${s?.startTime} - ${s?.endTime}`);
    }

    if (missingRoster) continue;

    const jobKey = `daily_${empDoc.id}_${dateStrings[0]}_${dateStrings[1]}`;
    await sendWhatsApp(
      emp.whatsappNumber, 
      config.dailyTemplate || 'roc_daily_two_day_shift_reminder', 
      templateVars, 
      jobKey, 
      emp.office, 
      empDoc.id,
      'daily_text'
    );
  }
});

/**
 * 2. startWeeklyRosterCampaign
 * Triggered from Master Matrix SEND WEEKLY ROSTER TO ALL.
 */
export const startWeeklyRosterCampaign = onCall({
  memory: '256MiB',
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Pulse missing.');
  
  const { officeId, weekId } = request.data;
  const db = admin.firestore();
  
  const userSnap = await db.collection('users').doc(request.auth.uid).get();
  const profile = userSnap.data();
  if (!profile || profile.status !== 'Active') throw new HttpsError('permission-denied', 'Account suspended.');
  
  if (profile.role !== 'super_admin') {
    const authorized = profile.officeIds || [profile.office];
    if (!authorized.includes(officeId)) throw new HttpsError('permission-denied', "Unauthorized cluster.");
  }

  const campaignId = `camp_${officeId}_${weekId}_${Date.now()}`;
  const empSnap = await db.collection('employees').where('office', '==', officeId).where('status', '==', 'Active').get();
  
  await db.collection('weekly_roster_campaigns').doc(campaignId).set({
    id: campaignId,
    officeId,
    weekId,
    status: 'processing',
    stats: { total: empSnap.size, pending: empSnap.size, success: 0, failed: 0 },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    actorId: request.auth.uid
  });

  const batch = db.batch();
  empSnap.docs.forEach(doc => {
    const jobRef = db.collection('whatsapp_jobs').doc();
    batch.set(jobRef, {
      campaignId,
      employeeId: doc.id,
      officeId,
      weekId,
      status: 'pending',
      type: 'weekly_pdf',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  await batch.commit();
  return { success: true, campaignId };
});

/**
 * 3. processWeeklyRosterJobs
 * Handles PDF synthesis and Meta dispatch for the bulk campaign.
 */
export const processWeeklyRosterJobs = onDocumentCreated({
  document: 'whatsapp_jobs/{jobId}',
  secrets: [WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID],
  memory: '1GiB',
}, async (event) => {
  const job = event.data?.data();
  if (!job || job.status !== 'pending') return;

  const db = admin.firestore();
  const jobRef = event.data?.ref;
  await jobRef?.update({ status: 'processing', startedAt: admin.firestore.FieldValue.serverTimestamp() });

  try {
    const configSnap = await db.collection('system_settings').doc('whatsapp_config').get();
    const config = configSnap.data() || {};
    if (!config.masterEnabled || !config.weeklyEnabled) throw new Error("AUTOMATION_DISABLED");

    const [empSnap, shiftsSnap, rosterSnap] = await Promise.all([
      db.collection('employees').doc(job.employeeId).get(),
      db.collection('shift_master').get(),
      db.collection('published_rosters').doc(`active_${job.weekId}_${job.officeId}`).get()
    ]);

    const emp = empSnap.data();
    if (!emp) throw new Error("Employee lost.");
    if (!rosterSnap.exists) throw new Error("Roster not published.");

    const shiftsMap = new Map();
    shiftsSnap.docs.forEach(d => shiftsMap.set(d.id, d.data()));
    
    const weekDates = getDatesForWeek(job.weekId);
    const rosterDays = weekDates.map(date => {
      const dStr = format(date, 'yyyy-MM-dd');
      const assignments = rosterSnap.data()?.assignments || [];
      const assign = assignments.find((a: any) => a.employeeId === job.employeeId && a.date === dStr);
      const s = assign ? shiftsMap.get(assign.shiftId) : null;
      return {
        date: format(date, 'dd MMM yyyy').toUpperCase(),
        day: format(date, 'EEEE'),
        shift: (!assign || assign.shiftId === 'none') ? 'WEEK OFF' : (s?.name || 'DUTY'),
        time: (!assign || assign.shiftId === 'none') ? '--:--' : `${s?.startTime} - ${s?.endTime}`,
        shiftId: assign?.shiftId || 'none'
      };
    });

    const pdfBuffer = await generateWeeklyPdf(emp, job.weekId, rosterDays, config.logoBase64);
    
    const bucket = admin.storage().bucket();
    const filePath = `weekly-roster-pdfs/${job.officeId}/${job.weekId}/${job.employeeId}/Roster.pdf`;
    await bucket.file(filePath).save(pdfBuffer, { contentType: 'application/pdf' });
    
    const mediaId = await uploadToMeta(pdfBuffer, 'Roster.pdf');
    const jobKey = `weekly_${job.employeeId}_${job.weekId}`;
    
    const result = await sendWhatsAppDocument(
      emp.whatsappNumber, 
      mediaId, 
      config.weeklyTemplate || 'roc_weekly_roster_pdf', 
      [emp.fullName, format(weekDates[0], 'yyyy-MM-dd'), format(weekDates[6], 'yyyy-MM-dd')],
      jobKey,
      job.officeId,
      job.employeeId
    );

    await jobRef?.update({ status: 'success', messageId: result.id, completedAt: admin.firestore.FieldValue.serverTimestamp() });
    await db.collection('weekly_roster_campaigns').doc(job.campaignId).update({
      'stats.pending': admin.firestore.FieldValue.increment(-1),
      'stats.success': admin.firestore.FieldValue.increment(1)
    });

  } catch (e: any) {
    console.error(`JOB_FAILED_${event.params.jobId}:`, e.message);
    await jobRef?.update({ status: 'failed', error: e.message });
    await db.collection('weekly_roster_campaigns').doc(job.campaignId).update({
      'stats.pending': admin.firestore.FieldValue.increment(-1),
      'stats.failed': admin.firestore.FieldValue.increment(1)
    });
  }
});

/**
 * 4. whatsappStatusWebhook
 * Meta Callback Node for delivery tracking.
 */
export const whatsappStatusWebhook = onRequest({
  secrets: [WHATSAPP_WEBHOOK_VERIFY_TOKEN],
}, async (req, res): Promise<void> => {
  if (req.method === 'GET') {
    const verifyToken = WHATSAPP_WEBHOOK_VERIFY_TOKEN.value();
    if (req.query['hub.verify_token'] === verifyToken) {
      res.status(200).send(req.query['hub.challenge']);
      return;
    }
    res.status(403).send('Forbidden');
    return;
  }

  const db = admin.firestore();
  const statuses = req.body?.entry?.[0]?.changes?.[0]?.value?.statuses;
  
  if (statuses) {
    for (const s of statuses) {
      const q = await db.collection('whatsapp_logs').where('messageId', '==', s.id).limit(1).get();
      if (!q.empty) {
        await q.docs[0].ref.update({ 
          deliveryStatus: s.status, 
          statusTimestamp: new Date(parseInt(s.timestamp) * 1000).toISOString() 
        });
      }
    }
  }

  res.sendStatus(200);
});

/**
 * 5. retryFailedWhatsAppJobs
 * Scheduled recovery pulse every 15 minutes.
 */
export const retryFailedWhatsAppJobs = onSchedule('every 15 minutes', async (event) => {
  const db = admin.firestore();
  const q = await db.collection('whatsapp_jobs')
    .where('status', '==', 'failed')
    .where('retryCount', '<', 3)
    .limit(20).get();

  for (const d of q.docs) {
    await d.ref.update({ status: 'pending', retryCount: admin.firestore.FieldValue.increment(1) });
  }
});

/**
 * 6. cleanupExpiredRosterPdfs
 * Hourly purge of PDF objects older than 48 hours.
 */
export const cleanupExpiredRosterPdfs = onSchedule('every hour', async (event) => {
  const bucket = admin.storage().bucket();
  const [files] = await bucket.getFiles({ prefix: 'weekly-roster-pdfs/' });
  const now = new Date();

  for (const file of files) {
    const [metadata] = await file.getMetadata();
    if (!metadata || !metadata.timeCreated) continue;
    
    const created = new Date(metadata.timeCreated as string);
    const diffHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

    if (diffHours > 48) {
      await file.delete();
    }
  }
});

// --- HELPER PULSES ---

function formatWeekId(date: Date): string {
  const monday = startOfISOWeek(date);
  const sunday = addDays(monday, 6);
  return `${format(monday, 'yyyyMMdd')}-${format(sunday, 'yyyyMMdd')}`;
}

function getDatesForWeek(weekId: string): Date[] {
  const startStr = weekId.split('-')[0];
  const start = new Date(startStr.slice(0, 4) + '-' + startStr.slice(4, 6) + '-' + startStr.slice(6, 8));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

async function sendWhatsApp(to: string, template: string, vars: string[], jobKey: string, office: string, employeeId: string, type: string) {
  const url = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID.value()}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN.value()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/\D/g, ''),
      type: "template",
      template: { name: template, language: { code: "en" }, components: [{ type: "body", parameters: vars.map(v => ({ type: "text", text: v })) }] }
    })
  });
  const data: any = await res.json();
  
  await admin.firestore().collection('whatsapp_logs').add({
    jobKey, to, template, office, employeeId, notificationType: type,
    messageId: data.messages?.[0]?.id || null,
    status: res.ok ? 'success' : 'failed',
    error: data.error?.message || null,
    timestamp: new Date().toISOString()
  });
}

async function uploadToMeta(buffer: Buffer, name: string): Promise<string> {
  const url = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID.value()}/media`;
  const fd = new FormData();
  // Binary Blob conversion fix for TS/Node 22
  fd.append('file', new Blob([new Uint8Array(buffer)]), name);
  fd.append('type', 'application/pdf');
  fd.append('messaging_product', 'whatsapp');

  const res = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN.value()}` }, body: fd });
  const data: any = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Meta Upload Failed');
  return data.id;
}

async function sendWhatsAppDocument(to: string, mediaId: string, template: string, vars: string[], jobKey: string, office: string, employeeId: string) {
  const url = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID.value()}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN.value()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/\D/g, ''),
      type: "template",
      template: {
        name: template,
        language: { code: "en" },
        components: [
          { type: "header", parameters: [{ type: "document", document: { id: mediaId, filename: "Roster.pdf" } }] },
          { type: "body", parameters: vars.map(v => ({ type: "text", text: v })) }
        ]
      }
    })
  });
  const data: any = await res.json();
  
  await admin.firestore().collection('whatsapp_logs').add({
    jobKey, to, template, office, employeeId, notificationType: 'weekly_pdf',
    messageId: data.messages?.[0]?.id || null,
    status: res.ok ? 'success' : 'failed',
    error: data.error?.message || null,
    timestamp: new Date().toISOString()
  });

  return { id: data.messages?.[0]?.id };
}

async function generateWeeklyPdf(emp: any, weekId: string, rosterDays: any[], logoBase64?: string): Promise<Buffer> {
  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.setTextColor('#102A43');
  doc.text('TEAM REMOTE OPTOMETRY', 20, 20);
  doc.setFontSize(10);
  doc.text('WEEKLY WORKFORCE SCHEDULE', 20, 26);
  
  doc.setFontSize(14);
  doc.text(`HELLO, ${emp.fullName.toUpperCase()}`, 20, 45);
  doc.setFontSize(9);
  doc.text(`ID: ${emp.id} | CYCLE: ${weekId}`, 20, 52);

  let y = 70;
  rosterDays.forEach(d => {
    doc.setFontSize(10);
    doc.text(`${d.day.toUpperCase()} (${d.date})`, 25, y);
    doc.text(`${d.shift} [${d.time}]`, 120, y);
    y += 10;
  });

  return Buffer.from(doc.output('arraybuffer'));
}
