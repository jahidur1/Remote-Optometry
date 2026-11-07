
import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { format, addDays } from 'date-fns';
import { jsPDF } from 'jspdf';
import * as crypto from 'crypto';

admin.initializeApp();

// --- SECRETS REGISTRY ---
const WHATSAPP_ACCESS_TOKEN = defineSecret('WHATSAPP_ACCESS_TOKEN');
const WHATSAPP_PHONE_NUMBER_ID = defineSecret('WHATSAPP_PHONE_NUMBER_ID');
const WHATSAPP_BUSINESS_ACCOUNT_ID = defineSecret('WHATSAPP_BUSINESS_ACCOUNT_ID');
const WHATSAPP_WEBHOOK_VERIFY_TOKEN = defineSecret('WHATSAPP_WEBHOOK_VERIFY_TOKEN');

const IST_TZ = 'Asia/Kolkata';

/**
 * 1. dailyTwoDayShiftReminder
 * Every day at 10:00 PM IST (22:00)
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
  if (!config.masterEnabled || !config.dailyReminderEnabled) return;

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
      const assign = rosterSnap.exists ? rosterSnap.data()?.assignments?.find((a: any) => a.employeeId === empDoc.id && a.date === dStr) : null;
      
      if (!assign) { missingRoster = true; break; }
      
      const s = shiftsMap.get(assign.shiftId);
      const isOff = assign.shiftId === 'none';
      templateVars.push(`${format(new Date(dStr), 'EEEE')}, ${format(new Date(dStr), 'dd MMM')}`);
      templateVars.push(isOff ? 'WEEK OFF' : (s?.name || 'DUTY'));
      templateVars.push(isOff ? 'Enjoy your day off!' : `${s?.startTime} - ${s?.endTime}`);
    }

    if (missingRoster) continue;

    await sendWhatsApp(emp.whatsappNumber, config.dailyTemplate || 'roc_daily_two_day_shift_reminder', templateVars);
  }
});

/**
 * 2. startWeeklyRosterCampaign
 * Triggered from Master Matrix
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
    if (!authorized.includes(officeId)) throw new Error("Unauthorized cluster.");
  }

  const campaignId = `camp_${officeId}_${weekId}_${Date.now()}`;
  const empSnap = await db.collection('employees').where('office', '==', officeId).where('status', '==', 'Active').get();
  
  await db.collection('weekly_roster_campaigns').doc(campaignId).set({
    id: campaignId,
    officeId,
    weekId,
    status: 'processing',
    stats: { total: empSnap.size, pending: empSnap.size, success: 0, failed: 0 },
    createdAt: admin.firestore.FieldValue.serverTimestamp()
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
 * Concurrency limited queue worker
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
    const empSnap = await db.collection('employees').doc(job.employeeId).get();
    const emp = empSnap.data();
    if (!emp) throw new Error("Employee lost.");

    // PDF Synthesis Logic (Abridged for Index)
    const pdfBuffer = await generatePersonalizedPdf(emp, job.weekId);
    
    // Storage & Meta Logic
    const bucket = admin.storage().bucket();
    const filePath = `weekly-roster-pdfs/${job.officeId}/${job.weekId}/${job.employeeId}/Roster.pdf`;
    await bucket.file(filePath).save(pdfBuffer, { contentType: 'application/pdf' });
    
    const mediaId = await uploadToMeta(pdfBuffer, 'Roster.pdf');
    const result = await sendWhatsAppDocument(emp.whatsappNumber, mediaId, 'roc_weekly_roster_pdf', [emp.fullName, job.weekId]);

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

/**
 * 4. whatsappStatusWebhook
 * Meta Callback Node
 */
export const whatsappStatusWebhook = onRequest({
  secrets: [WHATSAPP_WEBHOOK_VERIFY_TOKEN],
}, async (req, res) => {
  if (req.method === 'GET') {
    const verifyToken = WHATSAPP_WEBHOOK_VERIFY_TOKEN.value();
    if (req.query['hub.verify_token'] === verifyToken) {
      return res.status(200).send(req.query['hub.challenge']);
    }
    return res.status(403).send('Forbidden');
  }

  const db = admin.firestore();
  const statuses = req.body?.entry?.[0]?.changes?.[0]?.value?.statuses;
  
  if (statuses) {
    for (const s of statuses) {
      const q = await db.collectionGroup('whatsapp_logs').where('messageId', '==', s.id).limit(1).get();
      if (!q.empty) {
        await q.docs[0].ref.update({ status: s.status, statusTimestamp: s.timestamp });
      }
    }
  }

  res.sendStatus(200);
});

/**
 * 5. retryFailedWhatsAppJobs
 * Scheduled recovery pulse
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
 * Purge 48h lifecycle objects
 */
export const cleanupExpiredRosterPdfs = onSchedule('every hour', async (event) => {
  const bucket = admin.storage().bucket();
  const [files] = await bucket.getFiles({ prefix: 'weekly-roster-pdfs/' });
  const now = new Date();

  for (const file of files) {
    const [metadata] = await file.getMetadata();
    const created = new Date(metadata.timeCreated);
    const diffHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

    if (diffHours > 48) {
      await file.delete();
    }
  }
});

// --- HELPER PULSES ---

function formatWeekId(date: Date): string {
  const day = date.getDay() || 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - day + 1);
  return format(monday, 'yyyyMMdd');
}

async function sendWhatsApp(to: string, template: string, vars: string[]) {
  const url = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID.value()}/messages`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN.value()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/\D/g, ''),
      type: "template",
      template: { name: template, language: { code: "en" }, components: [{ type: "body", parameters: vars.map(v => ({ type: "text", text: v })) }] }
    })
  });
}

async function uploadToMeta(buffer: Buffer, name: string): Promise<string> {
  const url = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID.value()}/media`;
  const fd = new FormData();
  fd.append('file', new Blob([buffer]), name);
  fd.append('type', 'application/pdf');
  fd.append('messaging_product', 'whatsapp');
  const res = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN.value()}` }, body: fd });
  const data = await res.json();
  return data.id;
}

async function sendWhatsAppDocument(to: string, mediaId: string, template: string, vars: string[]) {
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
  return await res.json();
}

async function generatePersonalizedPdf(emp: any, weekId: string): Promise<Buffer> {
  const doc = new jsPDF();
  doc.setFontSize(20);
  doc.text(`WEEKLY ROSTER: ${emp.fullName}`, 20, 20);
  doc.setFontSize(12);
  doc.text(`Identity Trace: ${emp.id}`, 20, 30);
  return Buffer.from(doc.output('arraybuffer'));
}
