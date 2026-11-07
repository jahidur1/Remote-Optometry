
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { format, addDays } from 'date-fns';

admin.initializeApp();

/**
 * PROTOCOL A (LEGACY/REFACTORING): Automated Roster Briefing (10 PM IST)
 * Hit the Next.js API route for orchestration.
 */
export const dailyRosterBriefing = functions.region('asia-south1').runWith({
  secrets: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'INTERNAL_TRIGGER_KEY'],
  timeoutSeconds: 300,
  memory: '1GB'
}).pubsub
  .schedule('0 22 * * *')
  .timeZone('Asia/Kolkata')
  .onRun(async (context: functions.EventContext) => {
    const APP_URL = process.env.APP_URL || 'https://studio-9087637488-aa952.web.app';
    const SECRET_KEY = process.env.INTERNAL_TRIGGER_KEY || 'roc_internal_pulse';

    try {
      await fetch(`${APP_URL}/api/cron/roster-briefing`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SECRET_KEY}`, 'Content-Type': 'application/json' }
      });
    } catch (e: any) {
      console.error('ROC_PULSE_A_ERROR:', e.message);
    }
    return null;
  });

/**
 * PROTOCOL B: Daily Shift Reminder Pulse (10 AM IST)
 * Sends text-based next 2-day reminders.
 */
export const dailyShiftReminderPulse = functions.region('asia-south1').runWith({
  secrets: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'INTERNAL_TRIGGER_KEY'],
  timeoutSeconds: 300,
  memory: '1GB'
}).pubsub
  .schedule('0 10 * * *')
  .timeZone('Asia/Kolkata')
  .onRun(async (context: functions.EventContext) => {
    const APP_URL = process.env.APP_URL || 'https://studio-9087637488-aa952.web.app';
    const SECRET_KEY = process.env.INTERNAL_TRIGGER_KEY || 'roc_internal_pulse';

    try {
      await fetch(`${APP_URL}/api/cron/daily-reminder`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SECRET_KEY}`, 'Content-Type': 'application/json' }
      });
    } catch (e: any) {
      console.error('ROC_PULSE_B_ERROR:', e.message);
    }
    return null;
  });

/**
 * ROC WORKFORCE — STORAGE LIFECYCLE GUARD (48h EXPR)
 */
export const storageCleanupPulse = functions.region('asia-south1').pubsub
  .schedule('0 * * * *')
  .onRun(async (context: functions.EventContext) => {
    const bucket = admin.storage().bucket();
    const db = admin.firestore();
    const now = new Date();
    const prefixes = ['whatsapp-roster-pdfs/'];
    let purgedCount = 0;

    for (const prefix of prefixes) {
      const [files] = await bucket.getFiles({ prefix });
      for (const file of files) {
        const [metadata] = await file.getMetadata();
        const expiresAtStr = metadata.metadata?.expiresAt;
        if (expiresAtStr && new Date(expiresAtStr) < now) {
          await file.delete();
          purgedCount++;
        }
      }
    }
    return { purgedCount };
  });
