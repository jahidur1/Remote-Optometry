import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { format, addDays, startOfISOWeek } from 'date-fns';
import { jsPDF } from 'jspdf';

admin.initializeApp();

const WHATSAPP_ACCESS_TOKEN = defineSecret('WHATSAPP_ACCESS_TOKEN');
const WHATSAPP_PHONE_NUMBER_ID = defineSecret('WHATSAPP_PHONE_NUMBER_ID');
const WHATSAPP_WEBHOOK_VERIFY_TOKEN = defineSecret('WHATSAPP_WEBHOOK_VERIFY_TOKEN');

const IST_TZ = 'Asia/Kolkata';

/**
 * dailyTwoDayShiftReminder
 * UPDATED TRIGGER: 5:00 PM IST (17:00) daily.
 * Dispatches shift briefings for the next two clinical days.
 */
export const dailyTwoDayShiftReminder = onSchedule({
  schedule: '0 17 * * *',
  timeZone: IST_TZ,
  memory: '512MiB',
  secrets: [WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID],
}, async (event) => {
  const db = admin.firestore();
  
  // 1. Governance Logic Gate
  const configSnap = await db.collection('system_settings').doc('whatsapp_config').get();
  const config = configSnap.data() || {};
  
  if (!config.masterEnabled || !config.dailyReminderEnabled || !config.whatsappEnabled) {
    console.log('DAILY_PULSE_SKIP: Automation switches are OFF in system settings.');
    return;
  }

  // 2. Temporal Logic (IST Context)
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: IST_TZ }));
  const tomorrow = addDays(today, 1);
  const dayAfter = addDays(today, 2);
  const dates = [tomorrow, dayAfter];
  const dateStrings = dates.map(d => format(d, 'yyyy-MM-dd'));

  // 3. Data Load: Active Professionals and Shift Master
  const [empSnap, shiftsSnap] = await Promise.all([
    db.collection('employees').where('status', '==', 'Active').get(),
    db.collection('shift_master').get()
  ]);

  const shiftsMap = new Map();
  shiftsSnap.docs.forEach(d => shiftsMap.set(d.id, d.data()));

  console.log(`DAILY_PULSE_INITIATED: Processing ${empSnap.size} active professionals for dates: ${dateStrings.join(', ')}`);

  for (const empDoc of empSnap.docs) {
    const emp = empDoc.data();
    const employeeId = empDoc.id;

    // Eligibility Check
    if (!emp.whatsappNumber || emp.whatsappOptIn === false) {
      console.log(`PULSE_SKIP [${employeeId}]: No phone or opted out.`);
      continue;
    }

    const templateVars: string[] = [];
    let missingRoster = false;

    // 4. Resolve Roster for the next two days
    for (const dStr of dateStrings) {
      const weekId = formatWeekId(new Date(dStr));
      const rosterId = `active_${weekId}_${emp.office}`;
      const rosterSnap = await db.collection('published_rosters').doc(rosterId).get();
      
      const assignments = rosterSnap.exists ? rosterSnap.data()?.assignments || [] : [];
      const assign = assignments.find((a: any) => a.employeeId === employeeId && a.date === dStr);
      
      if (!rosterSnap.exists || !assign) { 
        missingRoster = true; 
        break; 
      }

      const s = shiftsMap.get(assign.shiftId);
      const isOff = assign.shiftId === 'none';
      
      // Template Variables Mapping (Meta Template Schema):
      // {{1}} Name, {{2,5}} Date, {{3,6}} Shift, {{4,7}} Time
      templateVars.push(`${format(new Date(dStr), 'EEEE, dd MMMM')}`);
      templateVars.push(isOff ? 'Week Off' : (s?.name || 'Duty'));
      templateVars.push(isOff ? 'Enjoy your day off!' : `${s?.startTime} - ${s?.endTime}`);
    }

    if (missingRoster) {
      console.log(`PULSE_SKIP [${employeeId}]: Assignments missing in roster ${emp.office} for cycle dates.`);
      continue;
    }
    
    // 5. Idempotency Hub
    const jobKey = `daily_${employeeId}_${dateStrings[0]}_${dateStrings[1]}`;
    
    try {
      await sendWhatsApp(
        emp.whatsappNumber, 
        'roc_daily_two_day_shift_reminder', 
        [emp.fullName, ...templateVars], 
        jobKey, 
        emp.office, 
        employeeId, 
        'daily_shift_reminder'
      );
    } catch (e: any) {
      console.error(`PULSE_FAILURE [${employeeId}]:`, e.message);
    }
  }
  
  console.log('DAILY_PULSE_COMPLETE');
});

export const startWeeklyRosterCampaign = onCall({
  memory: '256MiB',
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Pulse missing.');
  
  const { officeId, weekId } = request.data;
  const db = admin.firestore();
  
  const userSnap = await db.collection('users').doc(request.auth.uid).get();
  const profile = userSnap.data();
  if (!profile || profile.status !== 'Active') throw new HttpsError('permission-denied', 'Account suspended.');

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
    
    if (!config.masterEnabled) throw new Error("AUTOMATION_DISABLED");

    const [empSnap, shiftsSnap, rosterSnap] = await Promise.all([
      db.collection('employees').doc(job.employeeId).get(),
      db.collection('shift_master').get(),
      db.collection('published_rosters').doc(`active_${job.weekId}_${job.officeId}`).get()
    ]);

    const emp = empSnap.data();
    if (!emp || !rosterSnap.exists) throw new Error("Roster or Professional missing.");

    const shiftsMap = new Map();
    shiftsSnap.docs.forEach(d => shiftsMap.set(d.id, d.data()));

    const startStr = job.weekId.split('-')[0];
    const start = new Date(startStr.slice(0, 4) + '-' + startStr.slice(4, 6) + '-' + startStr.slice(6, 8));
    const weekDates = Array.from({ length: 7 }, (_, i) => addDays(start, i));

    const rosterDays = weekDates.map(date => {
      const dStr = format(date, 'yyyy-MM-dd');
      const assignments = rosterSnap.data()?.assignments || [];
      const assign = assignments.find((a: any) => a.employeeId === job.employeeId && a.date === dStr);
      const s = assign ? shiftsMap.get(assign.shiftId) : null;
      const isOff = !assign || assign.shiftId === 'none';
      return {
        date: format(date, 'dd MMM yyyy').toUpperCase(),
        day: format(date, 'EEEE'),
        shift: isOff ? 'WEEK OFF' : (s?.name || 'DUTY'),
        time: isOff ? '--:--' : `${s?.startTime} - ${s?.endTime}`,
        shiftId: assign?.shiftId || 'none'
      };
    });

    const pdfBuffer = await generateWeeklyPdf(emp as any, job.weekId, rosterDays, config.logoBase64);
    const mediaId = await uploadToMeta(pdfBuffer, 'Roster.pdf');
    const jobKey = `weekly_${job.employeeId}_${job.weekId}`;
    
    const result = await sendWhatsAppDocument(emp.whatsappNumber, mediaId, 'roc_weekly_roster_pdf', [emp.fullName, format(weekDates[0], 'dd MMM yyyy'), format(weekDates[6], 'dd MMM yyyy')], jobKey, job.officeId, job.employeeId);

    await jobRef?.update({ status: 'success', messageId: result.id, completedAt: admin.firestore.FieldValue.serverTimestamp() });
    await db.collection('weekly_roster_campaigns').doc(job.campaignId).update({
      'stats.pending': admin.firestore.FieldValue.increment(-1),
      'stats.success': admin.firestore.FieldValue.increment(1)
    });
  } catch (e: any) {
    await jobRef?.update({ status: 'failed', error: e.message });
    await db.collection('weekly_roster_campaigns').doc(job.campaignId).update({
      'stats.pending': admin.firestore.FieldValue.increment(-1),
      'stats.failed': admin.firestore.FieldValue.increment(1)
    });
  }
});

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
        await q.docs[0].ref.update({ deliveryStatus: s.status, statusTimestamp: new Date(parseInt(s.timestamp) * 1000).toISOString() });
      }
    }
  }
  res.sendStatus(200);
});

export const cleanupExpiredRosterPdfs = onSchedule('every hour', async (event) => {
  const bucket = admin.storage().bucket();
  const [files] = await bucket.getFiles({ prefix: 'weekly-roster-pdfs/' });
  const now = new Date();
  for (const file of files) {
    const [metadata] = await file.getMetadata();
    if (!metadata || !metadata.timeCreated) continue;
    const created = new Date(metadata.timeCreated as string);
    if ((now.getTime() - created.getTime()) / (1000 * 60 * 60) > 48) await file.delete();
  }
});

async function sendWhatsApp(to: string, template: string, vars: string[], jobKey: string, office: string, employeeId: string, type: string) {
  const url = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID.value()}/messages`;
  let formattedTo = to.replace(/\D/g, '');
  if (formattedTo.length === 10) formattedTo = `91${formattedTo}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN.value()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: formattedTo,
      type: "template",
      template: { name: template, language: { code: "en" }, components: [{ type: "body", parameters: vars.map(v => ({ type: "text", text: String(v) })) }] }
    })
  });
  const data: any = await res.json();
  await admin.firestore().collection('whatsapp_logs').add({
    jobKey, to: formattedTo, template, office, employeeId, notificationType: type,
    messageId: data.messages?.[0]?.id || null, status: res.ok ? 'success' : 'failed', timestamp: new Date().toISOString()
  });
}

async function uploadToMeta(buffer: Buffer, name: string) {
  const url = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID.value()}/media`;
  const fd = new FormData();
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
  let formattedTo = to.replace(/\D/g, '');
  if (formattedTo.length === 10) formattedTo = `91${formattedTo}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN.value()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: formattedTo,
      type: "template",
      template: {
        name: template,
        language: { code: "en" },
        components: [
          { type: "header", parameters: [{ type: "document", document: { id: mediaId, filename: "Weekly_Roster.pdf" } }] },
          { type: "body", parameters: vars.map(v => ({ type: "text", text: String(v) })) }
        ]
      }
    })
  });
  const data: any = await res.json();
  await admin.firestore().collection('whatsapp_logs').add({
    jobKey, to: formattedTo, template, office, employeeId, notificationType: 'weekly_pdf',
    messageId: data.messages?.[0]?.id || null, status: res.ok ? 'success' : 'failed', timestamp: new Date().toISOString()
  });
  return { id: data.messages?.[0]?.id };
}

async function generateWeeklyPdf(emp: any, weekId: string, rosterDays: any[], logoBase64?: string) {
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

function formatWeekId(date: Date): string {
  const monday = startOfISOWeek(date);
  const sunday = addDays(monday, 6);
  return `${format(monday, 'yyyyMMdd')}-${format(sunday, 'yyyyMMdd')}`;
}
