
'use server';

import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { generateRosterImage } from './image-generation-service';
import { sendWhatsAppShiftBriefingWithImage } from './whatsapp-action';
import { format, addDays } from 'date-fns';
import { getStorage } from 'firebase-admin/storage';
import { formatWeekId } from '@/lib/date-utils';

/**
 * ROC WORKFORCE — AUTOMATED ROSTER BRIEFING SERVICE (PART 2)
 * 
 * Orchestrates image synthesis, Storage lifecycle, and Meta API dispatch.
 * Strictly enforces 60KB image size and 48H retention.
 */

export async function runManualRosterBriefingAction(idToken: string) {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!userSnap.exists || userSnap.data()?.role !== 'super_admin') {
      throw new Error("Unauthorized: Super Admin credentials required for automation pulse.");
    }

    return await runAutomatedRosterBriefing();
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function runAutomatedRosterBriefing() {
  const executionId = `exec_${Date.now()}`;
  let successCount = 0;
  let failCount = 0;

  try {
    // 1. Governance Verification
    const configSnap = await adminDb.collection('system_settings').doc('whatsapp_config').get();
    const autoSnap = await adminDb.collection('system_settings').doc('whatsapp_automation').get();
    
    const config = configSnap.exists ? configSnap.data() : { whatsappEnabled: false };
    const automation = autoSnap.exists ? autoSnap.data() : { masterEnabled: false };
    
    if (!config?.whatsappEnabled || !automation?.masterEnabled) {
      throw new Error("AUTOMATION_SUSPENDED: Pulse is globally OFF.");
    }

    // 2. Data Aggregation
    const empSnap = await adminDb.collection('employees').where('status', '==', 'Active').get();
    const shiftSnap = await adminDb.collection('shift_master').get();
    const shiftsMap = new Map();
    shiftSnap.docs.forEach(d => shiftsMap.set(d.id, d.data()));

    const tomorrow = addDays(new Date(), 1);
    const dayAfter = addDays(new Date(), 2);
    
    const dates = [format(tomorrow, 'yyyy-MM-dd'), format(dayAfter, 'yyyy-MM-dd')];
    const weekIds = [formatWeekId(tomorrow), formatWeekId(dayAfter)];

    const bucket = getStorage().bucket();

    // 3. Orchestration Loop
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

        // 4. Deterministic Image Synthesis (< 60KB enforced)
        const pngBuffer = await generateRosterImage({
          employeeName: emp.fullName,
          employeeId: empDoc.id,
          logoBase64: automation.base64Logo,
          nextTwoDays
        });

        // 5. Private Registry Pulse
        const year = format(new Date(), 'yyyy');
        const month = format(new Date(), 'MM');
        const storagePath = `whatsapp-roster-images/${year}/${month}/${empDoc.id}/${executionId}.png`;
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

        // 6. Meta API Dispatch
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

    // 7. Telemetry Registry Sync
    await adminDb.collection('system_settings').doc('whatsapp_automation').update({
      lastRun: new Date().toISOString(),
      lastStats: { success: successCount, fail: failCount, total: successCount + failCount },
      updatedAt: new Date().toISOString()
    });

    await purgeExpiredRosterMedia();

    return { success: true, count: successCount, total: successCount + failCount };

  } catch (globalErr: any) {
    console.error('Automation Orchestration Conflict:', globalErr.message);
    return { success: false, error: globalErr.message };
  }
}

async function purgeExpiredRosterMedia() {
  const bucket = getStorage().bucket();
  const [files] = await bucket.getFiles({ prefix: 'whatsapp-roster-images/' });
  const now = new Date();

  for (const file of files) {
    const [meta] = await file.getMetadata();
    const expiry = meta.metadata?.expiresAt;
    if (expiry && new Date(expiry) < now) {
      try {
        await file.delete();
      } catch (e) {
        console.error(`Cleanup failure: ${file.name}`, e);
      }
    }
  }
}
