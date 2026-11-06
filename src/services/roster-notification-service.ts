
'use server';

import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { generateRosterImage } from './image-generation-service';
import { sendWhatsAppShiftBriefingWithImage } from './whatsapp-action';
import { format, addDays, startOfISOWeek } from 'date-fns';
import { getStorage } from 'firebase-admin/storage';
import { formatWeekId } from '@/lib/date-utils';

/**
 * ROC WORKFORCE — AUTOMATED ROSTER BRIEFING SERVICE (PART 1)
 * 
 * Scheduled Pulse: 10:00 PM IST
 * Protocol:
 * 1. Target T+1 and T+2 shifts from published rosters.
 * 2. Synthesize individual < 60KB PNG images.
 * 3. Secure in private Storage node with strict lifecycle metadata.
 * 4. Dispatch via Meta Cloud API using Template Workflow.
 * 5. Automate 48-hour retention purge.
 */

/**
 * runManualRosterBriefingAction
 * High-intensity trigger for testing the Part 1 infrastructure.
 */
export async function runManualRosterBriefingAction(idToken: string) {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
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
  const start = Date.now();
  let successCount = 0;
  let failCount = 0;

  try {
    // 1. Governance Audit
    const configSnap = await adminDb.collection('system_settings').doc('whatsapp_config').get();
    const autoSnap = await adminDb.collection('system_settings').doc('whatsapp_automation').get();
    
    const config = configSnap.exists ? configSnap.data() : { whatsappEnabled: false };
    const automation = autoSnap.exists ? autoSnap.data() : { masterEnabled: false };
    
    if (!automation?.masterEnabled) return { success: false, error: "AUTOMATION_SUSPENDED: Master toggle is OFF." };

    // 2. Resource Aggregation
    const empSnap = await adminDb.collection('employees').where('status', '==', 'Active').get();
    const shiftSnap = await adminDb.collection('shift_master').get();
    const shiftsMap = new Map();
    shiftSnap.docs.forEach(d => shiftsMap.set(d.id, d.data()));

    // Calculate Target Dates: Tomorrow and Day After
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
        // Idempotency check: Don't repeat for the same dates in this execution cycle
        const jobKey = `${empDoc.id}_${dates[0]}_${dates[1]}`;
        const existingJob = await adminDb.collection('whatsapp_logs')
          .where('jobKey', '==', jobKey)
          .where('status', '==', 'success')
          .limit(1).get();
        
        if (!existingJob.empty) continue;

        // Retrieve relevant rosters
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
          
          // Check for Week-Off via the assignments (published roster source of truth)
          const isOff = assign?.shiftId === 'none' || !assign;

          return {
            date: format(new Date(date), 'dd MMM yyyy'),
            day: format(new Date(date), 'EEEE'),
            shift: isOff ? 'WEEK-OFF' : (shift?.name || 'UNASSIGNED'),
            time: isOff ? '--:--' : `${shift?.startTime} - ${shift?.endTime}`
          };
        });

        // 4. Image Synthesis (Stateless Buffer)
        const pngBuffer = await generateRosterImage({
          employeeName: emp.fullName,
          employeeId: empDoc.id,
          logoBase64: automation.base64Logo,
          nextTwoDays
        });

        // 5. Private Storage Pulse
        const year = format(new Date(), 'yyyy');
        const month = format(new Date(), 'MM');
        const storagePath = `whatsapp-roster-images/${year}/${month}/${empDoc.id}/${executionId}.png`;
        const file = bucket.file(storagePath);
        
        await file.save(pngBuffer, {
          contentType: 'image/png',
          metadata: {
            metadata: {
              employeeUid: emp.authUid || 'UNMAPPED',
              employeeId: empDoc.id,
              expiresAt: addDays(new Date(), 2).toISOString(), // 48h Retention
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

    // 7. Telemetry Update
    await adminDb.collection('system_settings').doc('whatsapp_automation').update({
      lastRun: new Date().toISOString(),
      lastStats: { success: successCount, fail: failCount, total: successCount + failCount },
      updatedAt: new Date().toISOString()
    });

    // 8. Lifecycle Purge Pulse
    await purgeExpiredRosterMedia();

    return { success: true, count: successCount, total: successCount + failCount };

  } catch (globalErr: any) {
    console.error('WhatsApp Orchestration Crash:', globalErr.message);
    return { success: false, error: globalErr.message };
  }
}

/**
 * purgeExpiredRosterMedia
 * Explicitly deletes Firebase Storage objects older than 48 hours.
 */
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
        console.error(`Cleanup Failure: ${file.name}`, e);
      }
    }
  }
}
