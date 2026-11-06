'use server';

import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { generateRosterImage } from './image-generation-service';
import { sendWhatsAppShiftBriefingWithImage } from './whatsapp-action';
import { format, addDays } from 'date-fns';
import { getStorage } from 'firebase-admin/storage';
import { formatWeekId } from '@/lib/date-utils';

/**
 * ROC WORKFORCE — AUTOMATED ROSTER BRIEFING SERVICE
 * 
 * Orchestrates image synthesis, Storage lifecycle, and Meta API dispatch.
 * STRICT REQUIREMENT: Final image size MUST be <= 60KB.
 */

async function assertSuperAdmin(idToken: string) {
  if (!idToken) throw new Error("Unauthorized.");
  const decoded = await adminAuth.verifyIdToken(idToken, true);
  const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userSnap.exists || userSnap.data()?.role !== 'super_admin') {
    throw new Error("Unauthorized.");
  }
  return decoded.uid;
}

export async function previewEmployeeRosterAction(idToken: string, employeeId: string) {
  try {
    await assertSuperAdmin(idToken);
    
    const empSnap = await adminDb.collection('employees').doc(employeeId).get();
    if (!empSnap.exists) throw new Error("Professional not found in registry.");
    const emp = empSnap.data()!;

    const autoSnap = await adminDb.collection('system_settings').doc('whatsapp_automation').get();
    const logoBase64 = autoSnap.exists ? autoSnap.data()?.base64Logo : null;

    const shiftSnap = await adminDb.collection('shift_master').get();
    const shiftsMap = new Map();
    shiftSnap.docs.forEach(d => shiftsMap.set(d.id, d.data()));

    const tomorrow = addDays(new Date(), 1);
    const dayAfter = addDays(new Date(), 2);
    const dates = [format(tomorrow, 'yyyy-MM-dd'), format(dayAfter, 'yyyy-MM-dd')];
    const weekIds = [formatWeekId(tomorrow), formatWeekId(dayAfter)];

    const tomRosterId = `active_${weekIds[0]}_${emp.office}`;
    const datRosterId = `active_${weekIds[1]}_${emp.office}`;

    const [r1, r2] = await Promise.all([
      adminDb.collection('published_rosters').doc(tomRosterId).get(),
      adminDb.collection('published_rosters').doc(datRosterId).get()
    ]);

    const findAssignment = (snap: any, date: string) => 
      snap.exists ? snap.data().assignments?.find((a: any) => a.employeeId === employeeId && a.date === date) : null;

    const nextTwoDays = dates.map((date, idx) => {
      const assign = findAssignment(idx === 0 ? r1 : r2, date);
      const shift = assign ? shiftsMap.get(assign.shiftId) : null;
      const isOff = assign?.shiftId === 'none' || !assign;

      return {
        date: format(new Date(date), 'dd MMM yyyy'),
        day: format(new Date(date), 'EEEE'),
        shift: isOff ? 'WEEK-OFF' : (shift?.name || 'UNASSIGNED'),
        time: isOff ? '--:--' : `${shift?.startTime} - ${shift?.endTime}`
      };
    });

    const pngBuffer = await generateRosterImage({
      employeeName: emp.fullName,
      employeeId: employeeId,
      logoBase64,
      nextTwoDays
    });

    return { 
      success: true, 
      base64: `data:image/png;base64,${pngBuffer.toString('base64')}`,
      size: `${(pngBuffer.length / 1024).toFixed(1)} KB`
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function runManualRosterBriefingAction(idToken: string) {
  try {
    await assertSuperAdmin(idToken);
    return await runAutomatedRosterBriefing();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * CORE ORCHESTRATION LOGIC
 * Can be triggered via Server Action (UI) or Cloud Function (Scheduler).
 */
export async function runAutomatedRosterBriefing() {
  const executionId = `exec_${Date.now()}`;
  let successCount = 0;
  let failCount = 0;

  try {
    const configSnap = await adminDb.collection('system_settings').doc('whatsapp_config').get();
    const autoSnap = await adminDb.collection('system_settings').doc('whatsapp_automation').get();
    
    if (!configSnap.data()?.whatsappEnabled || !autoSnap.data()?.masterEnabled) {
      throw new Error("AUTOMATION_SUSPENDED: Master Pulse is OFF.");
    }

    const automation = autoSnap.data()!;
    const empSnap = await adminDb.collection('employees').where('status', '==', 'Active').get();
    const shiftSnap = await adminDb.collection('shift_master').get();
    const shiftsMap = new Map();
    shiftSnap.docs.forEach(d => shiftsMap.set(d.id, d.data()));

    const tomorrow = addDays(new Date(), 1);
    const dayAfter = addDays(new Date(), 2);
    const dates = [format(tomorrow, 'yyyy-MM-dd'), format(dayAfter, 'yyyy-MM-dd')];
    const weekIds = [formatWeekId(tomorrow), formatWeekId(dayAfter)];

    const bucket = getStorage().bucket();

    for (const empDoc of empSnap.docs) {
      const emp = empDoc.data();
      if (!emp.whatsappNumber) continue;

      try {
        const jobKey = `${empDoc.id}_${dates[0]}_${dates[1]}`;
        const existingJob = await adminDb.collection('whatsapp_logs')
          .where('jobKey', '==', jobKey)
          .where('status', '==', 'success')
          .limit(1).get();
        
        if (!existingJob.empty) continue;

        const tomRosterId = `active_${weekIds[0]}_${emp.office}`;
        const datRosterId = `active_${weekIds[1]}_${emp.office}`;

        const [r1, r2] = await Promise.all([
          adminDb.collection('published_rosters').doc(tomRosterId).get(),
          adminDb.collection('published_rosters').doc(datRosterId).get()
        ]);

        const findAssignment = (snap: any, date: string) => 
          snap.exists ? snap.data().assignments?.find((a: any) => a.employeeId === empDoc.id && a.date === date) : null;

        const nextTwoDays = dates.map((date, idx) => {
          const assign = findAssignment(idx === 0 ? r1 : r2, date);
          const shift = assign ? shiftsMap.get(assign.shiftId) : null;
          const isOff = assign?.shiftId === 'none' || !assign;

          return {
            date: format(new Date(date), 'dd MMM yyyy'),
            day: format(new Date(date), 'EEEE'),
            shift: isOff ? 'WEEK-OFF' : (shift?.name || 'UNASSIGNED'),
            time: isOff ? '--:--' : `${shift?.startTime} - ${shift?.endTime}`
          };
        });

        const pngBuffer = await generateRosterImage({
          employeeName: emp.fullName,
          employeeId: empDoc.id,
          logoBase64: automation.base64Logo,
          nextTwoDays
        });

        const storagePath = `whatsapp-roster-images/${format(new Date(), 'yyyy/MM')}/${empDoc.id}/${executionId}.png`;
        const file = bucket.file(storagePath);
        
        await file.save(pngBuffer, {
          contentType: 'image/png',
          metadata: {
            metadata: {
              employeeId: empDoc.id,
              expiresAt: addDays(new Date(), 2).toISOString(),
              imageSize: `${(pngBuffer.length / 1024).toFixed(1)}KB`
            }
          }
        });

        const dispatch = await sendWhatsAppShiftBriefingWithImage(
          emp.whatsappNumber,
          emp.fullName,
          pngBuffer,
          `${empDoc.id}_roster.png`
        );

        if (dispatch.success) {
          successCount++;
          await adminDb.collection('whatsapp_logs').add({
            executionId,
            jobKey,
            employeeId: empDoc.id,
            status: 'success',
            imgSize: `${(pngBuffer.length / 1024).toFixed(1)} KB`,
            messageId: dispatch.messageId,
            timestamp: new Date().toISOString()
          });
        } else {
          throw new Error(dispatch.error);
        }

      } catch (empErr: any) {
        failCount++;
        await adminDb.collection('whatsapp_logs').add({
          executionId,
          employeeId: empDoc.id,
          status: 'failed',
          error: empErr.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    await adminDb.collection('system_settings').doc('whatsapp_automation').update({
      lastRun: new Date().toISOString(),
      lastStats: { success: successCount, fail: failCount, total: successCount + failCount },
      updatedAt: new Date().toISOString()
    });

    return { success: true, count: successCount, total: successCount + failCount };

  } catch (globalErr: any) {
    console.error('Automation Conflict:', globalErr.message);
    return { success: false, error: globalErr.message };
  }
}
