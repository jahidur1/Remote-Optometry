
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { generateRosterImage } from './image-generation-service';
import { sendWhatsAppShiftBriefingWithImage } from './whatsapp-action';
import { format, addDays } from 'date-fns';
import { getStorage } from 'firebase-admin/storage';
import { formatWeekId } from '@/lib/date-utils';

/**
 * ROC WORKFORCE — AUTOMATED ROSTER BRIEFING SERVICE (PART 1)
 * 
 * Scheduled Pulse: 10:00 PM IST
 * Protocol:
 * 1. Target T+1 and T+2 shifts.
 * 2. Synthesize individual < 60KB images.
 * 3. Secure in private Storage node.
 * 4. Dispatch via Meta Cloud API.
 * 5. Lifecycle Purge (48h).
 */

export async function runAutomatedRosterBriefing() {
  const executionId = `scheduled_10pm_${Date.now()}`;
  const start = Date.now();
  let successCount = 0;
  let failCount = 0;

  try {
    // 1. Global Governance Check
    const autoSnap = await adminDb.collection('system_settings').doc('whatsapp_automation').get();
    const configSnap = await adminDb.collection('system_settings').doc('whatsapp_config').get();
    
    const automation = autoSnap.data();
    const config = configSnap.data();
    
    if (!automation?.masterEnabled) return { success: false, error: "AUTOMATION_SUSPENDED: Master switch is OFF." };
    if (!config?.whatsappEnabled) return { success: false, error: "API_RESTRICTED: Meta connectivity is disabled." };

    // 2. Aggregate Clinical Pools
    const empSnap = await adminDb.collection('employees').where('status', '==', 'Active').get();
    const shiftSnap = await adminDb.collection('shift_master').get();
    const shiftsMap = new Map();
    shiftSnap.docs.forEach(d => shiftsMap.set(d.id, d.data()));

    const tomorrow = addDays(new Date(), 1);
    const dayAfter = addDays(new Date(), 2);
    
    const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
    const dayAfterStr = format(dayAfter, 'yyyy-MM-dd');
    
    const tomorrowWeekId = formatWeekId(tomorrow);
    const dayAfterWeekId = formatWeekId(dayAfter);

    const bucket = getStorage().bucket();

    // 3. Sequential Processing (Strict per-employee isolation)
    for (const empDoc of empSnap.docs) {
      const emp = empDoc.data();
      if (!emp.whatsappNumber) continue;

      try {
        // Idempotency: Avoid double-sends for same dates/version
        const jobKey = `${empDoc.id}_${tomorrowStr}_${dayAfterStr}`;
        const existingJob = await adminDb.collection('whatsapp_logs')
          .where('jobKey', '==', jobKey)
          .where('status', '==', 'success')
          .limit(1).get();
        
        if (!existingJob.empty) continue;

        // Fetch rosters for this professional's office
        const tomRosterId = `active_${tomorrowWeekId}_${emp.office}`;
        const datRosterId = `active_${dayAfterWeekId}_${emp.office}`;

        const [r1, r2] = await Promise.all([
          adminDb.collection('published_rosters').doc(tomRosterId).get(),
          adminDb.collection('published_rosters').doc(datRosterId).get()
        ]);

        const findAssign = (snap: any, date: string) => 
          snap.exists ? snap.data().assignments?.find((a: any) => a.employeeId === empDoc.id && a.date === date) : null;

        const nextTwoDays = [tomorrowStr, dayAfterStr].map((date, idx) => {
          const assign = findAssign(idx === 0 ? r1 : r2, date);
          const shift = assign ? shiftsMap.get(assign.shiftId) : null;
          return {
            date: format(new Date(date), 'dd MMM yyyy'),
            day: format(new Date(date), 'EEEE'),
            shift: shift ? shift.name : (assign?.shiftId === 'none' ? 'WEEK-OFF' : 'NOT_PUBLISHED'),
            time: shift ? `${shift.startTime} - ${shift.endTime}` : '--:--'
          };
        });

        // 4. Image Synthesis & Storage Node
        const pngBuffer = await generateRosterImage({
          employeeName: emp.fullName,
          employeeId: empDoc.id,
          logoBase64: config.logoBase64,
          nextTwoDays
        });

        const storagePath = `whatsapp-roster-images/${format(new Date(), 'yyyy/MM')}/${empDoc.id}/${executionId}.png`;
        const file = bucket.file(storagePath);
        
        await file.save(pngBuffer, {
          contentType: 'image/png',
          metadata: {
            metadata: {
              employeeUid: emp.authUid || 'UNMAPPED',
              employeeId: empDoc.id,
              expiresAt: addDays(new Date(), 2).toISOString(),
              imageSize: `${(pngBuffer.length / 1024).toFixed(1)}KB`
            }
          }
        });

        // 5. Meta API Pulse
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
            imageSize: `${(pngBuffer.length / 1024).toFixed(1)} KB`,
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

    // 6. Finalize Telemetry
    await adminDb.collection('system_settings').doc('whatsapp_automation').update({
      lastRun: new Date().toISOString(),
      lastStats: { success: successCount, fail: failCount, total: successCount + failCount },
      updatedAt: new Date().toISOString()
    });

    // 7. Lifecycle Purge
    await purgeExpiredRosterMedia();

    return { success: true, processed: successCount + failCount, successCount };

  } catch (globalErr: any) {
    console.error('WhatsApp Orchestration Crash:', globalErr.message);
    return { success: false, error: globalErr.message };
  }
}

/**
 * Identifies and deletes Storage objects older than 48 hours.
 */
async function purgeExpiredRosterMedia() {
  const bucket = getStorage().bucket();
  const [files] = await bucket.getFiles({ prefix: 'whatsapp-roster-images/' });
  const now = new Date();

  for (const file of files) {
    const [meta] = await file.getMetadata();
    const expiry = meta.metadata?.expiresAt;
    if (expiry && new Date(expiry) < now) {
      await file.delete();
    }
  }
}
