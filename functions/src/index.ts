
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

export const dailyTwoDayShiftReminder = onSchedule({
  schedule: '0 22 * * *',
  timeZone: IST_TZ,
  memory: '512MiB',
  secrets: [WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID],
}, async (event) => {
  const db = admin.firestore();
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
      const assignments = rosterSnap.exists ? rosterSnap.data()?.assignments || [] : [];
      const assign = assignments.find((a: any) => a.employeeId === empDoc.id && a.date === dStr);
      
      if (!assign) { missingRoster = true; break; }
      const s = shiftsMap.get(assign.shiftId);
      const isOff = assign.shiftId === 'none';
      templateVars.push(`${format(new Date(dStr), 'EEEE')}, ${format(new Date(dStr), 'dd MMM')}`);
      templateVars.push(isOff ? 'WEEK OFF' : (s?.name || 'DUTY'));
      templateVars.push(isOff ? 'Enjoy your day off!' : `${s?.startTime} - ${s?.endTime}`);
    }

    if (missingRoster) continue;
    await sendWhatsApp(emp.whatsappNumber, config.dailyTemplate || 'roc_daily_two_day_shift_reminder', templateVars, emp.office, empDoc.id);
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

async function sendWhatsApp(to: string, template: string, vars: string[], office: string, employeeId: string) {
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
      template: { name: template, language: { code: "en" }, components: [{ type: "body", parameters: vars.map(v => ({ type: "text", text: v })) }] }
    })
  });
  const data: any = await res.json();
  await admin.firestore().collection('whatsapp_logs').add({
    to: formattedTo, template, office, employeeId, notificationType: 'daily_shift_reminder',
    messageId: data.messages?.[0]?.id || null, status: res.ok ? 'success' : 'failed', timestamp: new Date().toISOString()
  });
}

function formatWeekId(date: Date): string {
  const monday = startOfISOWeek(date);
  const sunday = addDays(monday, 6);
  return `${format(monday, 'yyyyMMdd')}-${format(sunday, 'yyyyMMdd')}`;
}
