'use server';

import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { generateWeeklyRosterPdf } from './roster-document-service';
import { getDatesForWeek, displayWeekRange } from '@/lib/date-utils';
import { format } from 'date-fns';
import { getStorage } from 'firebase-admin/storage';

/**
 * ROC WORKFORCE — WEEKLY ROSTER PDF SERVICE v1.0
 * 
 * Orchestrates full-week document synthesis and storage.
 */

async function getAuthorizedUser(idToken: string) {
  if (!idToken) throw new Error("Unauthorized.");
  const decoded = await adminAuth.verifyIdToken(idToken, true);
  const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userSnap.exists) throw new Error("Identity node not found.");
  return { uid: decoded.uid, ...userSnap.data() } as any;
}

/**
 * previewWeeklyRosterAction
 * Synthesizes a 7-day PDF for administrative review.
 */
export async function previewWeeklyRosterAction(idToken: string, employeeId: string, weekId: string, mockCase?: number) {
  try {
    const profile = await getAuthorizedUser(idToken);
    if (profile.role !== 'super_admin' && profile.role !== 'admin') throw new Error("Unauthorized.");

    let emp: any = { fullName: 'TEST PROFESSIONAL', office: 'HQ_GLOBAL', id: 'EMP-W-001' };
    if (employeeId !== 'TEST-EMP') {
      const empSnap = await adminDb.collection('employees').doc(employeeId).get();
      if (empSnap.exists) emp = empSnap.data();
    }

    const weekDates = getDatesForWeek(weekId);
    const weekRangeStr = displayWeekRange(weekId);

    const shiftSnap = await adminDb.collection('shift_master').get();
    const shiftsMap = new Map();
    shiftSnap.docs.forEach(d => shiftsMap.set(d.id, d.data()));

    const autoSnap = await adminDb.collection('system_settings').doc('whatsapp_automation').get();
    const logoBase64 = autoSnap.exists ? autoSnap.data()?.base64Logo : null;

    // 1. Aggregate 7 Days of Data
    const rosterId = `active_${weekId}_${emp.office}`;
    const rosterSnap = await adminDb.collection('published_rosters').doc(rosterId).get();
    const publishedAssignments = rosterSnap.exists ? rosterSnap.data()?.assignments || [] : [];

    const rosterDays = weekDates.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const assign = publishedAssignments.find((a: any) => a.employeeId === emp.id && a.date === dateStr);
      
      // MOCK DATA OVERRIDES FOR QA
      if (mockCase !== undefined) {
         if (mockCase === 1) { // Mixed Shifts
            const shifts = ['SO', 'OP', 'MD', 'C1', 'C2', 'SC', 'none'];
            const sId = shifts[weekDates.indexOf(date)];
            const s = shiftsMap.get(sId);
            return {
              date: format(date, 'dd MMM yyyy').toUpperCase(),
              day: format(date, 'EEEE'),
              shift: sId === 'none' ? 'WEEK OFF' : (s?.name || 'UNASSIGNED'),
              time: sId === 'none' ? '--:--' : `${s?.startTime} - ${s?.endTime}`,
              shiftId: sId
            };
         }
         if (mockCase === 2) { // Standard Week
            const isOff = weekDates.indexOf(date) === 6;
            const s = shiftsMap.get('OP');
            return {
              date: format(date, 'dd MMM yyyy').toUpperCase(),
              day: format(date, 'EEEE'),
              shift: isOff ? 'WEEK OFF' : 'OPENING',
              time: isOff ? '--:--' : '10:00 AM - 07:00 PM',
              shiftId: isOff ? 'none' : 'OP'
            };
         }
         if (mockCase === 3) { // High Availability (Double Off)
            const isOff = weekDates.indexOf(date) > 4;
            const s = shiftsMap.get('C1');
            return {
              date: format(date, 'dd MMM yyyy').toUpperCase(),
              day: format(date, 'EEEE'),
              shift: isOff ? 'WEEK OFF' : 'CLOSING',
              time: isOff ? '--:--' : '12:00 PM - 09:00 PM',
              shiftId: isOff ? 'none' : 'C1'
            };
         }
      }

      const shift = assign ? shiftsMap.get(assign.shiftId) : null;
      const isOff = !assign || assign.shiftId === 'none';

      return {
        date: format(date, 'dd MMM yyyy').toUpperCase(),
        day: format(date, 'EEEE'),
        shift: isOff ? 'WEEK OFF' : (shift?.name || 'UNASSIGNED'),
        time: isOff ? '--:--' : `${shift?.startTime} - ${shift?.endTime}`,
        shiftId: assign?.shiftId || 'none'
      };
    });

    // 2. Synthesis
    const pdfBuffer = await generateWeeklyRosterPdf({
      employeeName: emp.fullName,
      employeeId: emp.id,
      officeName: emp.office,
      weekRange: weekRangeStr,
      logoBase64,
      rosterDays
    });

    return { 
      success: true, 
      base64: `data:application/pdf;base64,${pdfBuffer.toString('base64')}`,
      size: `${(pdfBuffer.length / 1024).toFixed(1)} KB`
    };

  } catch (e: any) {
    console.error('WEEKLY_PREVIEW_FAILURE:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * dispatchWeeklyRosterAction
 * Orchestrates bulk PDF generation and secure storage upload.
 */
export async function dispatchWeeklyRosterAction(idToken: string, officeId: string, weekId: string) {
  try {
    const profile = await getAuthorizedUser(idToken);
    
    // 1. Authorization Gate
    if (profile.role !== 'super_admin') {
      const allowed = profile.officeIds || (profile.office ? [profile.office] : []);
      if (!allowed.includes(officeId)) throw new Error("Unauthorized for this cluster.");
    }

    const weekRange = displayWeekRange(weekId);
    const storage = getStorage();
    const bucket = storage.bucket();

    // 2. Fetch Registry Data
    const [empSnap, rosterSnap, shiftSnap, autoSnap] = await Promise.all([
      adminDb.collection('employees').where('office', '==', officeId).where('status', '==', 'Active').get(),
      adminDb.collection('published_rosters').doc(`active_${weekId}_${officeId}`).get(),
      adminDb.collection('shift_master').get(),
      adminDb.collection('system_settings').doc('whatsapp_automation').get()
    ]);

    if (!rosterSnap.exists) throw new Error("No published roster found for this week.");
    
    const assignments = rosterSnap.data()?.assignments || [];
    const shiftsMap = new Map();
    shiftSnap.docs.forEach(d => shiftsMap.set(d.id, d.data()));
    const logoBase64 = autoSnap.data()?.base64Logo;
    const weekDates = getDatesForWeek(weekId);

    let count = 0;

    // 3. Batch Loop
    for (const empDoc of empSnap.docs) {
      const emp = empDoc.data();
      
      const rosterDays = weekDates.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const assign = assignments.find((a: any) => a.employeeId === emp.id && a.date === dateStr);
        const shift = assign ? shiftsMap.get(assign.shiftId) : null;
        const isOff = !assign || assign.shiftId === 'none';
        return {
          date: format(date, 'dd MMM yyyy').toUpperCase(),
          day: format(date, 'EEEE'),
          shift: isOff ? 'WEEK OFF' : (shift?.name || 'UNASSIGNED'),
          time: isOff ? '--:--' : `${shift?.startTime} - ${shift?.endTime}`,
          shiftId: assign?.shiftId || 'none'
        };
      });

      const pdfBuffer = await generateWeeklyRosterPdf({
        employeeName: emp.fullName,
        employeeId: emp.id,
        officeName: emp.office,
        weekRange,
        logoBase64,
        rosterDays
      });

      // 4. Secure Registry Upload
      const filename = `Team_Remote_Optometry_${emp.id}_${weekId}.pdf`;
      const path = `weekly-roster-pdfs/${officeId}/${weekId}/${emp.id}/${filename}`;
      const file = bucket.file(path);

      await file.save(pdfBuffer, {
        contentType: 'application/pdf',
        metadata: {
          metadata: {
            employeeId: emp.id,
            weekId,
            docType: 'weekly_roster',
            generatedAt: new Date().toISOString()
          }
        }
      });
      count++;
    }

    return { success: true, count };

  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
