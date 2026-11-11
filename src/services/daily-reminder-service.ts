'use server';

import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { sendWhatsAppGenericTemplate } from './whatsapp-action';
import { getISTNow, formatWeekId } from '@/lib/date-utils';
import { format, addDays } from 'date-fns';

/**
 * ROC WORKFORCE — DAILY SHIFT REMINDER SERVICE v11.0
 * 
 * Logic Hardening: Strictly uses Singleton ID Protocol for roster lookups.
 * MANUAL OVERRIDE: bypassMasterCheck allows Super Admin to force dispatches.
 */

async function getAuthorizedUser(idToken: string) {
  if (!idToken) throw new Error("Unauthorized.");
  const decoded = await adminAuth.verifyIdToken(idToken);
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

    const configSnap = await adminDb.collection('system_settings').doc('whatsapp_config').get();
    const config = configSnap.data() || {};

    // 1. Logic Gate: Always respect 'whatsappEnabled' regardless of pulse source
    if (!config.whatsappEnabled) return { success: false, error: "WHATSAPP_GATEWAY_DISABLED" };

    if (!bypassMasterCheck) {
      if (!config.masterEnabled) return { success: false, error: "MASTER_DISABLED" };
      if (!config.dailyReminderEnabled) return { success: false, error: "DAILY_STREAM_DISABLED" };
    }

    const templateName = 'roc_daily_two_day_shift_reminder';
    
    const istNow = getISTNow();
    const tomorrow = addDays(istNow, 1);
    const dayAfter = addDays(istNow, 2);
    
    const dates = [tomorrow, dayAfter];
    const dateStrings = dates.map(d => format(d, 'yyyy-MM-dd'));

    const [empSnap, shiftSnap, officeSnap] = await Promise.all([
      adminDb.collection('employees').where('status', '==', 'Active').get(),
      adminDb.collection('shift_master').get(),
      adminDb.collection('offices').where('status', '==', 'Active').get()
    ]);

    const shiftsMap = new Map();
    shiftSnap.docs.forEach(d => shiftsMap.set(d.id, d.data()));
    const activeOffices = new Set(officeSnap.docs.map(d => d.id));

    for (const empDoc of empSnap.docs) {
      const emp = empDoc.data();
      const employeeId = empDoc.id;

      if (!emp.whatsappNumber || emp.whatsappOptIn === false || !activeOffices.has(emp.office)) {
        skippedCount++;
        continue;
      }

      try {
        const jobKey = `daily_${employeeId}_${dateStrings[0]}_${dateStrings[1]}`;
        
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
          const targetDate = dates[i];
          const weekId = formatWeekId(targetDate);
          const rosterId = `active_${weekId}_${emp.office}`;
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

          templateVars.push(`${format(targetDate, 'EEEE, dd MMMM')}`);
          templateVars.push(isOff ? 'Week Off' : (shift?.name || 'Duty'));
          templateVars.push(isOff ? 'Enjoy your day off!' : `${shift?.startTime} - ${shift?.endTime}`);
        }

        if (missingRoster) {
          skippedCount++;
          continue;
        }

        const dispatch = await sendWhatsAppGenericTemplate({
          to: emp.whatsappNumber,
          templateName,
          bodyVariables: [emp.fullName, ...templateVars]
        });

        await adminDb.collection('whatsapp_logs').add({
          jobKey,
          employeeId,
          employeeName: emp.fullName,
          office: emp.office,
          notificationType: 'daily_shift_reminder',
          status: dispatch.success ? 'success' : 'failed',
          messageId: dispatch.messageId || null,
          failureReason: dispatch.error || null,
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
