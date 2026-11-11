'use server';

import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { sendWhatsAppGenericTemplate } from './whatsapp-action';
import { generateRosterImage } from './image-generation-service';
import { getISTNow, formatWeekId } from '@/lib/date-utils';
import { format, addDays } from 'date-fns';

/**
 * ROC WORKFORCE — DAILY SHIFT BRIEFING SERVICE v13.0
 * 
 * Logic Hardening: Strictly uses Singleton ID Protocol for roster lookups.
 * MANUAL OVERRIDE: bypassMasterCheck allows Super Admin to force dispatches regardless of system switches.
 * PREMIUM VISUALS: Manual pulses now attach a generated schedule image header.
 */

async function getAuthorizedUser(idToken: string) {
  if (!idToken) throw new Error("Unauthorized.");
  const decoded = await adminAuth.verifyIdToken(idToken);
  const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userSnap.exists) throw new Error("Unauthorized: Identity node not found.");
  const profile = userSnap.data()!;
  
  if (profile.status !== 'Active') throw new Error("Unauthorized: Account suspended.");
  
  return { uid: decoded.uid, ...profile } as any;
}

export async function runDailyShiftReminders(bypassMasterCheck = false, idToken?: string) {
  const start = Date.now();
  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  try {
    if (idToken) {
        const caller = await getAuthorizedUser(idToken);
        if (caller.role !== 'super_admin' && caller.role !== 'admin') {
            throw new Error("Unauthorized: Administrative pulse required.");
        }
    }

    const configSnap = await adminDb.collection('system_settings').doc('whatsapp_config').get();
    const config = configSnap.data() || {};

    // Logic Gate: If manual override (bypassMasterCheck), we skip automation logic switches
    if (!bypassMasterCheck) {
      if (!config.masterEnabled || !config.dailyReminderEnabled || !config.whatsappEnabled) {
        return { success: false, error: "AUTOMATION_DISABLED_IN_SETTINGS" };
      }
    } else {
        if (!config.whatsappEnabled) return { success: false, error: "META_GATEWAY_OFF" };
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

      // Filter: Missing Phone, Opt-Out, or Decommissioned Office
      if (!emp.whatsappNumber || emp.whatsappOptIn === false || !activeOffices.has(emp.office)) {
        skippedCount++;
        continue;
      }

      try {
        const jobKey = `daily_${employeeId}_${dateStrings[0]}_${dateStrings[1]}`;
        
        // Idempotency: Skip ONLY for automated triggers to prevent spam.
        // Manual triggers (bypassMasterCheck) FORCE a resend.
        if (!bypassMasterCheck) {
            const existingLog = await adminDb.collection('whatsapp_logs')
              .where('jobKey', '==', jobKey)
              .where('status', '==', 'success')
              .limit(1).get();

            if (!existingLog.empty) {
              skippedCount++;
              continue;
            }
        }

        const templateVars: string[] = [];
        const rosterDaysForImage: any[] = [];
        let missingRoster = false;

        for (let i = 0; i < 2; i++) {
          const targetDate = dates[i];
          const weekId = formatWeekId(targetDate);
          const rosterId = `active_${weekId}_${emp.office}`;
          const rosterSnap = await adminDb.collection('published_rosters').doc(rosterId).get();
          
          const assignments = rosterSnap.exists ? rosterSnap.data()?.assignments || [] : [];
          const assign = assignments.find((a: any) => String(a.employeeId) === String(employeeId) && a.date === dateStrings[i]);
          
          if (!rosterSnap.exists || !assign) {
             missingRoster = true;
             break;
          }

          const shiftId = assign.shiftId || 'none';
          const shift = shiftsMap.get(shiftId);
          const isOff = shiftId === 'none';

          const dateDisplay = format(targetDate, 'EEEE, dd MMMM');
          const shiftName = isOff ? 'Week Off' : (shift?.name || 'Duty');
          const shiftTime = isOff ? 'Enjoy your day off!' : `${shift?.startTime} - ${shift?.endTime}`;

          templateVars.push(dateDisplay);
          templateVars.push(shiftName);
          templateVars.push(shiftTime);

          rosterDaysForImage.push({
            date: format(targetDate, 'dd MMM yyyy').toUpperCase(),
            day: format(targetDate, 'EEEE'),
            shift: shiftName.toUpperCase(),
            time: isOff ? '--:--' : shiftTime,
            shiftId
          });
        }

        if (missingRoster) {
          skippedCount++;
          continue;
        }

        // Synthesize Premium Visual Briefing
        const imageBuffer = await generateRosterImage({
          employeeName: emp.fullName,
          employeeId: emp.id,
          logoBase64: config.logoBase64,
          nextTwoDays: rosterDaysForImage
        });

        const dispatch = await sendWhatsAppGenericTemplate({
          to: emp.whatsappNumber,
          templateName,
          headerMedia: { type: 'image', buffer: imageBuffer, filename: 'Briefing.png' },
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
          timestamp: new Date().toISOString(),
          source: bypassMasterCheck ? 'manual_admin_trigger' : 'automated_scheduler'
        });

        if (dispatch.success) successCount++; else failCount++;

      } catch (err: any) {
        console.error(`PULSE_JOB_FAIL [${employeeId}]:`, err.message);
        failCount++;
      }
    }

    return { 
      success: true, 
      stats: { success: successCount, fail: failCount, skipped: skippedCount },
      latencyMs: Date.now() - start
    };

  } catch (e: any) {
    console.error('DAILY_DISPATCH_CRITICAL:', e.message);
    return { success: false, error: e.message };
  }
}
