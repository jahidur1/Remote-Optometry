'use server';

import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { sendWhatsAppGenericTemplate } from './whatsapp-action';
import { getISTNow, formatWeekId } from '@/lib/date-utils';
import { format, addDays } from 'date-fns';
import { logAuditServer } from './audit-service';

/**
 * ROC WORKFORCE — DAILY SHIFT REMINDER SERVICE v5.0
 * 
 * Protocol B: Automated text reminders containing next 2 days' shifts.
 * Constraints: Text-only, zero storage usage, strict 10 AM IST execution.
 */

async function getAuthorizedUser(idToken: string) {
  if (!idToken) throw new Error("Unauthorized.");
  const decoded = await adminAuth.verifyIdToken(idToken, true);
  const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userSnap.exists || userSnap.data()?.role !== 'super_admin') {
    throw new Error("Unauthorized: Super Admin access required for manual pulse.");
  }
  return decoded.uid;
}

export async function runDailyShiftReminders(bypassMasterCheck = false, idToken?: string) {
  const start = Date.now();
  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  try {
    // 1. Authorization Pulse (if manual)
    if (idToken) {
      await getAuthorizedUser(idToken);
    }

    // 2. Governance Check
    const configSnap = await adminDb.collection('system_settings').doc('whatsapp_config').get();
    const config = configSnap.data() || {};

    if (!bypassMasterCheck) {
      if (!config.whatsappEnabled || !config.masterEnabled || !config.dailyReminderEnabled) {
        return { success: false, error: "AUTOMATION_SUSPENDED: Daily triggers are OFF." };
      }
    }

    const templateName = config.dailyTemplate || 'roc_daily_two_day_shift_reminder';
    
    // 3. Temporal Identification (Asia/Kolkata)
    const istNow = getISTNow();
    const tomorrow = addDays(istNow, 1);
    const dayAfter = addDays(istNow, 2);
    
    const dates = [tomorrow, dayAfter];
    const dateStrings = dates.map(d => format(d, 'yyyy-MM-dd'));
    const weekIds = dates.map(d => formatWeekId(d));

    // 4. Data Aggregation
    const [empSnap, shiftSnap] = await Promise.all([
      adminDb.collection('employees').where('status', '==', 'Active').get(),
      adminDb.collection('shift_master').get()
    ]);

    const shiftsMap = new Map();
    shiftSnap.docs.forEach(d => shiftsMap.set(d.id, d.data()));

    // 5. Orchestration Loop
    for (const empDoc of empSnap.docs) {
      const emp = empDoc.data();
      const employeeId = empDoc.id;

      // Eligibility Gate
      if (!emp.whatsappNumber || emp.whatsappOptIn === false) {
        skippedCount++;
        continue;
      }

      try {
        // Idempotency: Prevent duplicate daily pulse
        const jobKey = `${employeeId}_${dateStrings[0]}_${dateStrings[1]}`;
        const existingLog = await adminDb.collection('whatsapp_logs')
          .where('jobKey', '==', jobKey)
          .where('notificationType', '==', 'daily_shift_reminder')
          .where('status', '==', 'success')
          .limit(1).get();

        if (!existingLog.empty && !bypassMasterCheck) {
          skippedCount++;
          continue;
        }

        // Fetch roster data for both days
        const scheduleVars = [];
        let dataMissing = false;

        for (let i = 0; i < 2; i++) {
          const rosterId = `active_${weekIds[i]}_${emp.office}`;
          const rosterSnap = await adminDb.collection('published_rosters').doc(rosterId).get();
          const assignments = rosterSnap.data()?.assignments || [];
          const assign = assignments.find((a: any) => a.employeeId === employeeId && a.date === dateStrings[i]);
          
          const dateLabel = format(dates[i], 'EEEE, dd MMM');
          const shiftId = assign?.shiftId || 'none';
          const shift = shiftsMap.get(shiftId);
          
          const isOff = shiftId === 'none';
          
          scheduleVars.push(dateLabel); // {{2}} / {{5}}
          scheduleVars.push(isOff ? 'WEEK OFF' : (shift?.name || 'UNASSIGNED')); // {{3}} / {{6}}
          scheduleVars.push(isOff ? 'Enjoy your day off!' : `${shift?.startTime} - ${shift?.endTime}`); // {{4}} / {{7}}
          
          if (!isOff && !shift) dataMissing = true;
        }

        if (dataMissing) {
          throw new Error("Registry Error: Shift details missing in master.");
        }

        // 6. Meta Dispatch
        const dispatch = await sendWhatsAppGenericTemplate({
          to: emp.whatsappNumber,
          templateName,
          bodyVariables: [emp.fullName, ...scheduleVars]
        });

        if (dispatch.success) {
          successCount++;
          await adminDb.collection('whatsapp_logs').add({
            jobKey,
            employeeId,
            employeeName: emp.fullName,
            office: emp.office,
            notificationType: 'daily_shift_reminder',
            status: 'success',
            messageId: dispatch.messageId,
            timestamp: new Date().toISOString()
          });
        } else {
          throw new Error(dispatch.error || "Meta Rejected Text Payload");
        }

      } catch (err: any) {
        failCount++;
        await adminDb.collection('whatsapp_logs').add({
          employeeId,
          employeeName: emp.fullName,
          office: emp.office,
          notificationType: 'daily_shift_reminder',
          status: 'failed',
          error: err.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    // 7. Pulse Telementry
    await adminDb.collection('system_settings').doc('whatsapp_config').update({
      'automation.dailyLastRun': new Date().toISOString(),
      'automation.dailyStats': { success: successCount, fail: failCount, skipped: skippedCount }
    });

    return { success: true, stats: { success: successCount, fail: failCount, skipped: skippedCount }, latency: Date.now() - start };

  } catch (e: any) {
    console.error('DAILY_REMINDER_CRITICAL_FAILURE:', e.message);
    return { success: false, error: e.message };
  }
}
