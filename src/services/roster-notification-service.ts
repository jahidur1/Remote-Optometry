
'use server';

import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { generateRosterImage } from './image-generation-service';
import { sendWhatsAppShiftBriefingWithImage } from './whatsapp-action';
import { format, addDays } from 'date-fns';
import { getStorage } from 'firebase-admin/storage';

/**
 * ROC WORKFORCE — AUTOMATED ROSTER BRIEFING SERVICE
 * 
 * Orchestrates:
 * 1. Data Aggregation (T+1, T+2 shifts)
 * 2. Image Synthesis
 * 3. Meta API Dispatch
 * 4. Storage Purge (48h Lifecycle)
 */

export async function runManualRosterBriefingAction(idToken: string) {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!userSnap.exists || userSnap.data()?.role !== 'super_admin') throw new Error("Unauthorized.");

    const settingsSnap = await adminDb.collection('system_settings').doc('whatsapp_config').get();
    const settings = settingsSnap.data();
    if (!settings?.whatsappEnabled) throw new Error("WhatsApp pulse is currently disabled in governance settings.");

    // Aggregation Pool
    const empSnap = await adminDb.collection('employees').where('status', '==', 'Active').get();
    const activeEmployees = empSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const shiftsSnap = await adminDb.collection('shift_master').get();
    const shiftsMap = new Map();
    shiftsSnap.docs.forEach(d => shiftsMap.set(d.id, d.data()));

    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    const dayAfter = format(addDays(new Date(), 2), 'yyyy-MM-dd');

    let count = 0;
    const bucket = getStorage().bucket();

    for (const emp of activeEmployees as any) {
      if (!emp.whatsappNumber) continue;

      // Fetch assignments for both days from Singleton ID rosters
      // We look at all office rosters for simplicity in this loop
      const rostersSnap = await adminDb.collection('published_rosters')
        .where('office', '==', emp.office)
        .get();

      const assignments: any[] = [];
      rostersSnap.docs.forEach(r => {
        const list = r.data().assignments || [];
        const found = list.filter((a: any) => a.employeeId === emp.id && (a.date === tomorrow || a.date === dayAfter));
        assignments.push(...found);
      });

      const nextTwoDays = [tomorrow, dayAfter].map(date => {
        const assign = assignments.find(a => a.date === date);
        const shift = assign ? shiftsMap.get(assign.shiftId) : null;
        return {
          date: format(new Date(date), 'dd MMM'),
          day: format(new Date(date), 'EEEE'),
          shift: shift ? shift.name : (assign?.shiftId === 'none' ? 'WEEK-OFF' : 'NOT ASSIGNED'),
          time: shift ? `${shift.startTime} - ${shift.endTime}` : '--:--'
        };
      });

      // 1. Generate PNG
      const pngBuffer = await generateRosterImage({
        employeeName: emp.fullName,
        employeeId: emp.id,
        logoBase64: settings.logoBase64,
        nextTwoDays
      });

      // 2. Upload to Firebase Storage
      const fileName = `roster_images/${emp.id}_${Date.now()}.png`;
      const file = bucket.file(fileName);
      await file.save(pngBuffer, {
        contentType: 'image/png',
        metadata: {
          firebaseStorageDownloadTokens: crypto.randomUUID()
        }
      });

      // Make public for WhatsApp download (or use signed URL)
      await file.makePublic();
      const imageUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

      // 3. Dispatch WhatsApp
      const result = await sendWhatsAppShiftBriefingWithImage(
        emp.whatsappNumber,
        emp.fullName,
        imageUrl,
        `Hi ${emp.fullName}, here is your clinical schedule for the next 2 days. Please follow your shift timings and report to Hub ${emp.office}. See you soon!`
      );

      if (result.success) {
        count++;
        // Mask for audit
        const maskedPhone = emp.whatsappNumber.replace(/(\d{2})(\d{6})(\d{2})/, '$1******$3');
        await adminDb.collection('whatsapp_logs').add({
          employeeId: emp.id,
          maskedPhone,
          status: 'success',
          timestamp: new Date().toISOString(),
          type: 'roster_image_briefing'
        });
      }
    }

    // 4. Trigger Automatic Purge Pulse (Clean files older than 48h)
    await purgeOldRosterImages();

    return { success: true, count };
  } catch (e: any) {
    console.error('Roster Briefing Critical Failure:', e.message);
    return { success: false, error: e.message };
  }
}

async function purgeOldRosterImages() {
  const bucket = getStorage().bucket();
  const [files] = await bucket.getFiles({ prefix: 'roster_images/' });
  const cutoff = addDays(new Date(), -2);

  for (const file of files) {
    const [metadata] = await file.getMetadata();
    const created = new Date(metadata.timeCreated);
    if (created < cutoff) {
      await file.delete();
    }
  }
}
