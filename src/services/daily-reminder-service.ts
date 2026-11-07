'use server';

import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { sendWhatsAppGenericTemplate } from './whatsapp-action';
import { getISTNow, formatWeekId } from '@/lib/date-utils';
import { format, addDays } from 'date-fns';

/**
 * ROC WORKFORCE — DAILY SHIFT REMINDER SERVICE v7.0
 * 
 * Protocol: 10 PM IST Automated Text Reminders for next 2 days.
 * Variables: {{1}} Name, {{2-4}} Day 1, {{5-7}} Day 2.
 */

async function getAuthorizedUser(idToken: string) {
  if (!idToken) throw new Error("Unauthorized.");
  const decoded = await adminAuth.verifyIdToken(idToken, true);
  const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userSnap.exists || userSnap.data()?.role !== 'super_admin') {
    throw new Error("Unauthorized: Super Admin access required.");
  }
  return decoded.uid;
}

export async function runDailyShiftReminders(bypassMasterCheck = false, idToken?: string) {
  const start = Date.now();
  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  try {
    if (idToken) await getAuthorizedUser(idToken);

    // 1. Unified Logic Gate Check
    const configSnap = await adminDb.collection('system_settings').doc('whatsapp_config').get();
    const config = configSnap.data() || {};

    if (!bypassMasterCheck) {
      if (!config.masterEnabled) return { success: false, error: "MASTER_DISABLED" };
      if (!config.whatsappEnabled) return { success: false, error: "WHATSAPP_GATEWAY_DISABLED" };
      if (!config.dailyReminderEnabled) return { success: false, error: "DAILY_STREAM_DISABLED" };
    }

    const templateName = config.dailyTemplate || 'roc_daily_two_day_shift_reminder';
    
    // 2. Temporal Logic (IST)
    const istNow = getISTNow();
    const tomorrow = addDays(istNow, 1);
    const dayAfter = addDays(istNow, 2);
    
    const dates = [tomorrow, dayAfter];
    const dateStrings = dates.map(d => format(d, 'yyyy-MM-dd'));
    const weekIds = dates.map(d => formatWeekId(d));

    // 3. Registry Load
    const [empSnap, shiftSnap, officeSnap] = await Promise.all([
      adminDb.collection('employees').where('status', '==', 'Active').get(),
      adminDb.collection('shift_master').get(),
      adminDb.collection('offices').where('status', '==', 'Active').get()
    ]);

    const shiftsMap = new Map();
    shiftSnap.docs.forEach(d => shiftsMap.set(d.id, d.data()));
    const activeOffices = new Set(officeSnap.docs.map(d => d.id));

    // 4. Batch Dispatch Loop
    for (const empDoc of empSnap.docs) {
      const emp = empDoc.data();
      const employeeId = empDoc.id;

      // Master Check Re-evaluation (Emergency Stop mid-loop)
      if (!bypassMasterCheck) {
         const liveCheck = await adminDb.collection('system_settings').doc('whatsapp_config').get();
         if (!liveCheck.data()?.masterEnabled) break;
      }

      // Opt-in & Registry Compliance Check
      if (!emp.whatsappNumber || emp.whatsappOptIn === false || !activeOffices.has(emp.office)) {
        skippedCount++;
        continue;
      }

      try {
        const jobKey = `daily_${employeeId}_${dateStrings[0]}_${dateStrings[1]}`;
        
        // Idempotency Gate
        const existingLog = await adminDb.collection('whatsapp_logs')
          .where('jobKey', '==', jobKey)
          .where('status', '==', 'success')
          .limit(1).get();

        if (!existingLog.empty && !bypassMasterCheck) {
          skippedCount++;
          continue;
        }

        const templateVars: string[] = [];
        let missingRoster = false;

        for (let i = 0; i < 2; i++) {
          const rosterId = `active_${weekIds[i]}_${emp.office}`;
          const rosterSnap = await adminDb.collection('published_rosters').doc(rosterId).get();
          
          const assignments = rosterSnap.exists ? rosterSnap.data()?.assignments || [] : [];
          const assign = assignments.find((a: any) => a.employeeId === employeeId && a.date === dateStrings[i]);
          
          if (!rosterSnap.exists || !assign) {
             // If roster is missing, we skip to maintain data integrity
             missingRoster = true;
             break;
          }

          const shiftId = assign.shiftId || 'none';
          const shift = shiftsMap.get(shiftId);
          const isOff = shiftId === 'none';

          templateVars.push(`${format(dates[i], 'EEEE')}, ${format(dates[i], 'dd MMM')}`); // {{2}} or {{5}}
          templateVars.push(isOff ? 'WEEK OFF' : (shift?.name || 'DUTY')); // {{3}} or {{6}}
          templateVars.push(isOff ? 'Enjoy your day off!' : `${shift?.startTime} - ${shift?.endTime}`); // {{4}} or {{7}}
        }

        if (missingRoster) {
          skippedCount++;
          continue;
        }

        // 5. Meta API Pulse Dispatch
        const dispatch = await sendWhatsAppGenericTemplate({
          to: emp.whatsappNumber,
          templateName,
          bodyVariables: [emp.fullName, ...templateVars]
        });

        // 6. Trace Registry Pulse
        await adminDb.collection('whatsapp_logs').add({
          jobKey,
          employeeId,
          employeeName: emp.fullName,
          office: emp.office,
          notificationType: 'daily_shift_reminder',
          templateId: templateName,
          status: dispatch.success ? 'success' : 'failed',
          apiStatus: dispatch.apiStatus,
          messageId: dispatch.messageId,
          failureReason: dispatch.error,
          submissionTimestamp: new Date().toISOString(),
          timestamp: new Date().toISOString()
        });

        if (dispatch.success) successCount++; else failCount++;

      } catch (err: any) {
        failCount++;
      }
    }

    return { 
      success: true, 
      stats: { success: successCount, fail: failCount, skipped: skippedCount },
      latencyMs: Date.now() - start
    };

  } catch (e: any) {
    console.error('DAILY_PULSE_CRITICAL_FAILURE:', e.message);
    return { success: false, error: e.message };
  }
}