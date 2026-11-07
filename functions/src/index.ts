import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { runDailyShiftReminders } from '../../src/services/daily-reminder-service';

admin.initializeApp();

/**
 * ROC WORKFORCE — DAILY SHIFT REMINDER PULSE
 * 
 * Executes every day at 10:00 PM Asia/Kolkata.
 * Orchestrates text-only WhatsApp briefings for the next two calendar days.
 */
export const dailyShiftReminderPulse = onSchedule({
  schedule: '0 22 * * *',
  timeZone: 'Asia/Kolkata',
  memory: '512MiB',
  timeoutSeconds: 540,
}, async (event) => {
  console.log('ROC_SCHEDULER_PULSE: Initiating 10:00 PM Daily Reminders.');
  try {
    const result = await runDailyShiftReminders();
    console.log('ROC_SCHEDULER_SUCCESS:', result);
  } catch (error) {
    console.error('ROC_SCHEDULER_CRITICAL_FAILURE:', error);
  }
});
