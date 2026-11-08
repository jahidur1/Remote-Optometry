'use server';

import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { sendWhatsAppGenericTemplate } from './whatsapp-action';
import { getISTNow, formatWeekId } from '@/lib/date-utils';
import { format, addDays } from 'date-fns';

/**
 * ROC WORKFORCE — DAILY SHIFT REMINDER SERVICE v10.0
 * 
 * Workflow B: Text-only reminders for the next 2 days.
 * Template: roc_daily_two_day_shift_reminder
 * Variables: {{1}} Name, {{2-4}} Day 1 (Date, Shift, Time), {{5-7}} Day 2 (Date, Shift, Time).
 */

async function getAuthorizedUser(idToken: string) {
  if (!idToken) throw new Error("Unauthorized.");
  const decoded = await adminAuth.verifyIdToken(idToken, true);
  const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userSnap.exists || userSnap.data()?.role?.toLowerCase() !== 'super_admin') {
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

    // 1. Governance Logic Gate Audit
    const configSnap = await adminDb.collection('system_settings').doc('whatsapp_config').get();
    const config = configSnap.data() || {};

    if (!bypassMasterCheck) {
      if (!config.masterEnabled) return { success: false, error: "MASTER_DISABLED" };
      if (!config.whatsappEnabled) return { success: false, error: "WHATSAPP_GATEWAY_DISABLED" };
      if (!config.dailyReminderEnabled) return { success: false, error: "DAILY_STREAM_DISABLED" };
    }

    const templateName = 'roc_daily_two_day_shift_reminder';
    
    // 2. Temporal Logic (Asia/Kolkata)
    const istNow = getISTNow();
    const tomorrow = addDays(istNow, 1);
    const dayAfter = addDays(istNow, 2);
    
    const dates = [tomorrow, dayAfter];
    const dateStrings = dates.map(d => format(d, 'yyyy-MM-dd'));
    const weekIds = dates.map(d => formatWeekId(d));

    // 3. System Load (Registry & Masters)
    const [empSnap, shiftSnap, officeSnap] = await Promise.all([
      adminDb.collection('employees').where('status', '==', 'Active').get(),
      adminDb.collection('shift_master').get(),
      adminDb.collection('offices').where('status', '==', 'Active').get()
    ]);

    const shiftsMap = new Map();
    shiftSnap.docs.forEach(d => shiftsMap.set(d.id, d.data()));
    const activeOffices = new Set(officeSnap.docs.map(d => d.id));

    // 4. Batch Dispatch Matrix
    for (const empDoc of empSnap.docs) {
      const emp = empDoc.data();
      const employeeId = empDoc.id;

      // Institutional Eligibility Filter
      if (!emp.whatsappNumber || emp.whatsappOptIn === false || !activeOffices.has(emp.office)) {
        skippedCount++;
        continue;
      }

      try {
        const jobKey = `daily_${employeeId}_${dateStrings[0]}_${dateStrings[1]}`;
        
        // Idempotency Hub
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

        // Resolve 2-Day Data Trace
        for (let i = 0; i < 2; i++) {
          const rosterId = `active_${weekIds[i]}_${emp.office}`;
          const rosterSnap = await adminDb.collection('published_rosters').doc(rosterId).get();
          
          const assignments = rosterSnap.exists ? rosterSnap.data()?.assignments || [] : [];
          const assign = assignments.find((a: any) => a.employeeId === employeeId && a.date === dateStrings[i]);
          
          if (!rosterSnap.exists || !assign) {
             missingRoster = true;
             break;
          }

          const shiftId = assign.shiftId || 'none';
          const shift = shiftsMap.get(shiftId);
          const isOff = shiftId === 'none';

          // Mapping: {{2,5}} Date -> {{3,6}} Shift -> {{4,7}} Time
          templateVars.push(`${format(dates[i], 'EEEE, dd MMMM')}`);
          templateVars.push(isOff ? 'Week Off' : (shift?.name || 'Duty'));
          templateVars.push(isOff ? 'Enjoy your day off!' : `${shift?.startTime} - ${shift?.endTime}`);
        }

        if (missingRoster) {
          skippedCount++;
          continue;
        }

        // 5. Meta Cloud API Dispatch
        const dispatch = await sendWhatsAppGenericTemplate({
          to: emp.whatsappNumber,
          templateName,
          bodyVariables: [emp.fullName, ...templateVars]
        });

        // 6. Trace Pulse Registry
        await adminDb.collection('whatsapp_logs').add({
          jobKey,
          employeeId,
          employeeName: emp.fullName,
          office: emp.office,
          notificationType: 'daily_shift_reminder',
          status: dispatch.success ? 'success' : 'failed',
          messageId: dispatch.messageId,
          failureReason: dispatch.error,
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
    return { success: false, error: e.message };
  }
}
