
'use server';

import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { generateRosterImage } from './image-generation-service';
import { sendWhatsAppShiftBriefingWithImage } from './whatsapp-action';
import { format, addDays } from 'date-fns';
import { getStorage } from 'firebase-admin/storage';

/**
 * ROC WORKFORCE — AUTOMATED ROSTER BRIEFING SERVICE v7.0
 * 
 * Orchestrates:
 * 1. Governance Check (Master Toggle)
 * 2. Data Aggregation (T+1, T+2 shifts)
 * 3. Atomic Image Synthesis (< 60KB)
 * 4. Private Storage Persistence
 * 5. Meta API Dispatch
 * 6. Storage Purge (48h Lifecycle)
 */

export async function runManualRosterBriefingAction(idToken: string) {
  const executionId = `run_${Date.now()}`;
  const start = Date.now();
  let successCount = 0;
  let failCount = 0;

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!userSnap.exists || userSnap.data()?.role !== 'super_admin') throw new Error("Unauthorized.");

    // 1. Governance Logic
    const settingsSnap = await adminDb.collection('system_settings').doc('whatsapp_config').get();
    const autoSnap = await adminDb.collection('system_settings').doc('whatsapp_automation').get();
    
    const settings = settingsSnap.data();
    const automation = autoSnap.data();
    
    if (!automation?.masterEnabled) throw new Error("AUTOMATION_DISABLED: Master toggle is OFF.");
    if (!settings?.whatsappEnabled) throw new Error("META_API_DISABLED: WhatsApp connectivity is OFF.");

    // 2. Data Pool Aggregation
    const empSnap = await adminDb.collection('employees').where('status', '==', 'Active').get();
    const shiftsSnap = await adminDb.collection('shift_master').get();
    const shiftsMap = new Map();
    shiftsSnap.docs.forEach(d => shiftsMap.set(d.id, d.data()));

    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    const dayAfter = format(addDays(new Date(), 2), 'yyyy-MM-dd');
    const bucket = getStorage().bucket();

    for (const empDoc of empSnap.docs) {
      const emp = empDoc.data();
      if (!emp.whatsappNumber) continue;

      try {
        // Fetch specific rosters for this professional's office
        const tomorrowRoster = await adminDb.collection('published_rosters')
          .doc(`active_${format(addDays(new Date(), 1), 'yyyyMMdd-yyyyMMdd')}_${emp.office}`).get();
        const dayAfterRoster = await adminDb.collection('published_rosters')
          .doc(`active_${format(addDays(new Date(), 2), 'yyyyMMdd-yyyyMMdd')}_${emp.office}`).get();

        const findShift = (rosterSnap: any, date: string) => {
          if (!rosterSnap.exists) return null;
          return rosterSnap.data().assignments?.find((a: any) => a.employeeId === empDoc.id && a.date === date);
        };

        const nextTwoDays = [tomorrow, dayAfter].map((date, i) => {
          const assign = findShift(i === 0 ? tomorrowRoster : dayAfterRoster, date);
          const shift = assign ? shiftsMap.get(assign.shiftId) : null;
          return {
            date: format(new Date(date), 'dd MMM'),
            day: format(new Date(date), 'EEEE'),
            shift: shift ? shift.name : (assign?.shiftId === 'none' ? 'WEEK-OFF' : 'TBD'),
            time: shift ? `${shift.startTime} - ${shift.endTime}` : '--:--'
          };
        });

        // 3. Image Synthesis Node
        const pngBuffer = await generateRosterImage({
          employeeName: emp.fullName,
          employeeId: empDoc.id,
          logoBase64: settings.logoBase64,
          nextTwoDays
        });

        // 4. Atomic Private Storage
        const filePath = `whatsapp-roster-images/${format(new Date(), 'yyyy/MM')}/${empDoc.id}/${executionId}.png`;
        const file = bucket.file(filePath);
        
        await file.save(pngBuffer, {
          contentType: 'image/png',
          metadata: {
            metadata: {
              employeeId: empDoc.id,
              executionId,
              expiresAt: addDays(new Date(), 2).toISOString()
            }
          }
        });

        // 5. Meta API Dispatch
        const result = await sendWhatsAppShiftBriefingWithImage(
          emp.whatsappNumber,
          emp.fullName,
          await file.getSignedUrl({ action: 'read', expires: Date.now() + 60000 }).then(urls => urls[0]),
          `Hi ${emp.fullName}, here is your clinical schedule for the next 2 days at Hub ${emp.office}. Wishing you a productive day ahead!`
        );

        if (result.success) {
          successCount++;
          await adminDb.collection('whatsapp_logs').add({
            executionId,
            employeeId: empDoc.id,
            status: 'success',
            imgSize: `${(pngBuffer.length / 1024).toFixed(1)} KB`,
            timestamp: new Date().toISOString(),
            messageId: result.messageId
          });
        } else {
          throw new Error(result.error);
        }

      } catch (err: any) {
        failCount++;
        await adminDb.collection('whatsapp_logs').add({
          executionId,
          employeeId: empDoc.id,
          status: 'failed',
          error: err.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    // 6. Cleanup & Stats Pulse
    await adminDb.collection('system_settings').doc('whatsapp_automation').update({
      lastRun: new Date().toISOString(),
      lastStats: { success: successCount, fail: failCount, total: successCount + failCount },
      updatedAt: new Date().toISOString()
    });

    await purgeOldRosterImages();

    return { success: true, count: successCount, failed: failCount };
  } catch (e: any) {
    console.error('CRITICAL_BRIEFING_FAILURE:', e.message);
    return { success: false, error: e.message };
  }
}

async function purgeOldRosterImages() {
  const bucket = getStorage().bucket();
  const [files] = await bucket.getFiles({ prefix: 'whatsapp-roster-images/' });
  const now = new Date();

  for (const file of files) {
    const [metadata] = await file.getMetadata();
    const expiresAt = metadata.metadata?.expiresAt;
    if (expiresAt && new Date(expiresAt) < now) {
      await file.delete();
    }
  }
}
