
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

admin.initializeApp();

/**
 * PROTOCOL B: Daily Shift Reminder Pulse (10 AM IST)
 * Sends text-based next 2-day reminders as per the new architecture requirements.
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
