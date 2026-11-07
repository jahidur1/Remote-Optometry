'use server';

import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { generateRosterPdf, generateWeeklyRosterPdf } from './roster-document-service';
import { sendWhatsAppShiftBriefingWithDocument } from './whatsapp-action';
import { format, addDays } from 'date-fns';
import { getStorage } from 'firebase-admin/storage';
import { formatWeekId, getISTNow, getDatesForWeek, displayWeekRange } from '@/lib/date-utils';

/**
 * ROC WORKFORCE — PREMIUM CLINICAL BRIEFING SERVICE v10.0 (Secure PDF Protocol)
 * 
 * Orchestrates premium document synthesis, private storage, and Meta API dispatch.
 * 
 * PROTOCOL REQUIREMENTS: 
 * 1. Deterministic Idempotency Key (UID + Dates)
 * 2. Private Storage Path: whatsapp-roster-pdfs/{year}/{month}/{employeeId}/
 * 3. Meta Cloud Document API Dispatch (upload -> send)
 * 4. 48-Hour Lifecycle Metadata Enforcement
 */

async function getAuthorizedUser(idToken: string) {
  if (!idToken) throw new Error("Unauthorized: Session pulse missing.");
  const decoded = await adminAuth.verifyIdToken(idToken, true);
  const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userSnap.exists) throw new Error("Registry Error: Identity node not found.");
  return { uid: decoded.uid, ...userSnap.data() } as any;
}

/**
 * getNextTwoDaysData
 * Correctly identifies tomorrow and the day after in Asia/Kolkata.
 */
async function getNextTwoDaysData(employeeId: string, office: string, mockCase?: number) {
  const istNow = getISTNow();
  
  if (mockCase !== undefined) {
    const tomorrow = addDays(istNow, 1);
    const dayAfter = addDays(istNow, 2);
    
    if (mockCase === 1) return [
      { date: format(tomorrow, 'dd MMMM yyyy').toUpperCase(), day: format(tomorrow, 'EEEE').toUpperCase(), shift: 'SUPER OPENING', time: '09:30 AM - 06:30 PM', shiftId: 'SO' },
      { date: format(dayAfter, 'dd MMMM yyyy').toUpperCase(), day: format(dayAfter, 'EEEE').toUpperCase(), shift: 'CLOSING', time: '12:00 PM - 09:00 PM', shiftId: 'C1' }
    ];
    if (mockCase === 2) return [
      { date: format(tomorrow, 'dd MMMM yyyy').toUpperCase(), day: format(tomorrow, 'EEEE').toUpperCase(), shift: 'OPENING', time: '10:00 AM - 07:00 PM', shiftId: 'OP' },
      { date: format(dayAfter, 'dd MMMM yyyy').toUpperCase(), day: format(dayAfter, 'EEEE').toUpperCase(), shift: 'WEEK OFF', time: '--:--', shiftId: 'none' }
    ];
    if (mockCase === 3) return [
      { date: format(tomorrow, 'dd MMMM yyyy').toUpperCase(), day: format(tomorrow, 'EEEE').toUpperCase(), shift: 'WEEK OFF', time: '--:--', shiftId: 'none' },
      { date: format(dayAfter, 'dd MMMM yyyy').toUpperCase(), day: format(dayAfter, 'EEEE').toUpperCase(), shift: 'WEEK OFF', time: '--:--', shiftId: 'none' }
    ];
  }

  const shiftSnap = await adminDb.collection('shift_master').get();
  const shiftsMap = new Map();
  shiftSnap.docs.forEach(d => shiftsMap.set(d.id, d.data()));

  const tomorrow = addDays(istNow, 1);
  const dayAfter = addDays(istNow, 2);
  const dates = [format(tomorrow, 'yyyy-MM-dd'), format(dayAfter, 'yyyy-MM-dd')];
  
  const weekIds = [formatWeekId(tomorrow), formatWeekId(dayAfter)];
  
  const results = [];
  for (let i = 0; i < 2; i++) {
    const rosterId = `active_${weekIds[i]}_${office}`;
    const rosterSnap = await adminDb.collection('published_rosters').doc(rosterId).get();
    const dateStr = dates[i];
    
    const assign = rosterSnap.exists ? rosterSnap.data()?.assignments?.find((a: any) => a.employeeId === employeeId && a.date === dateStr) : null;
    const shift = assign ? shiftsMap.get(assign.shiftId) : null;
    const isOff = !assign || assign.shiftId === 'none';

    results.push({
      date: format(new Date(dateStr), 'dd MMMM yyyy').toUpperCase(),
      day: format(new Date(dateStr), 'EEEE').toUpperCase(),
      shift: isOff ? 'WEEK OFF' : (shift?.name || 'UNASSIGNED'),
      time: isOff ? '--:--' : `${shift?.startTime} - ${shift?.endTime}`,
      shiftId: assign?.shiftId || 'none'
    });
  }

  return results;
}

/**
 * previewEmployeeRosterAction
 * Generates a real-time weekly PDF preview for administrative validation.
 */
export async function previewEmployeeRosterAction(idToken: string, employeeId: string, weekId?: string, mockCase?: number) {
  try {
    const profile = await getAuthorizedUser(idToken);
    if (profile.role !== 'super_admin' && profile.role !== 'admin') throw new Error("Unauthorized Access.");
    
    let emp: any = { fullName: 'TEST PROFESSIONAL', office: 'HQ_GLOBAL', id: 'EMP-PREVIEW-001' };
    
    if (employeeId !== 'TEST-EMP') {
      const empSnap = await adminDb.collection('employees').doc(employeeId).get();
      if (empSnap.exists) emp = empSnap.data();
    }

    const configSnap = await adminDb.collection('system_settings').doc('whatsapp_config').get();
    const logoBase64 = configSnap.exists ? configSnap.data()?.logoBase64 : null;

    // Correctly fetch assignments for the entire week (7 days)
    const targetWeekId = weekId || formatWeekId(getISTNow());
    const weekDates = getDatesForWeek(targetWeekId);
    const weekRange = displayWeekRange(targetWeekId);

    const shiftSnap = await adminDb.collection('shift_master').get();
    const shiftsMap = new Map();
    shiftSnap.docs.forEach(d => shiftsMap.set(d.id, d.data()));

    const rosterId = `active_${targetWeekId}_${emp.office}`;
    const rosterSnap = await adminDb.collection('published_rosters').doc(rosterId).get();
    const assignments = rosterSnap.exists ? rosterSnap.data()?.assignments || [] : [];

    const rosterDays = weekDates.map(date => {
      const dStr = format(date, 'yyyy-MM-dd');
      const assign = assignments.find((a: any) => a.employeeId === emp.id && a.date === dStr);
      const shift = assign ? shiftsMap.get(assign.shiftId) : null;
      const isOff = !assign || assign.shiftId === 'none';

      return {
        date: format(date, 'dd MMM yyyy').toUpperCase(),
        day: format(date, 'EEEE'),
        shift: isOff ? 'WEEK OFF' : (shift?.name || 'DUTY'),
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

    return { 
      success: true, 
      base64: `data:application/pdf;base64,${pdfBuffer.toString('base64')}`,
      size: `${(pdfBuffer.length / 1024).toFixed(1)} KB`,
      byteSize: pdfBuffer.length
    };
  } catch (e: any) {
    console.error('PREVIEW_PULSE_FAILURE:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * dispatchOfficeBriefingsAction
 * Manual trigger for an entire cluster center.
 */
export async function dispatchOfficeBriefingsAction(idToken: string, officeId: string) {
  try {
    const profile = await getAuthorizedUser(idToken);
    
    // Authorization Scoping
    if (profile.role !== 'super_admin') {
      const authorizedOffices = profile.officeIds || (profile.office ? [profile.office] : []);
      if (!authorizedOffices.includes(officeId)) {
        throw new Error("Unauthorized: Office access restricted.");
      }
    }

    return await runAutomatedRosterBriefing(officeId, true);
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * runAutomatedRosterBriefing
 * 
 * High-intensity orchestration pulse.
 */
export async function runAutomatedRosterBriefing(officeId?: string, bypassMasterCheck = false) {
  const executionId = `exec_${Date.now()}`;
  const start = Date.now();
  let successCount = 0;
  let failCount = 0;

  try {
    const istNow = getISTNow();
    const configSnap = await adminDb.collection('system_settings').doc('whatsapp_config').get();
    const autoSnap = await adminDb.collection('system_settings').doc('whatsapp_automation').get();
    
    // 1. Master Governance Gate
    if (!bypassMasterCheck) {
      if (!configSnap.data()?.whatsappEnabled || !autoSnap.data()?.masterEnabled) {
        return { success: false, error: "AUTOMATION_SUSPENDED: Master toggle is OFF." };
      }
    }

    const automation = autoSnap.exists ? autoSnap.data() : { base64Logo: null };
    
    // Fetch Professionals
    let empBaseQuery = adminDb.collection('employees').where('status', '==', 'Active');
    if (officeId) {
      empBaseQuery = empBaseQuery.where('office', '==', officeId);
    }
    const empSnap = await empBaseQuery.get();

    const tomorrow = addDays(istNow, 1);
    const dayAfter = addDays(istNow, 2);
    const dates = [format(tomorrow, 'yyyy-MM-dd'), format(dayAfter, 'yyyy-MM-dd')];

    const storage = getStorage();
    const bucket = storage.bucket();

    for (const empDoc of empSnap.docs) {
      // Emergency Cut-off: Check if master was disabled mid-execution
      if (!bypassMasterCheck) {
        const liveAutoSnap = await adminDb.collection('system_settings').doc('whatsapp_automation').get();
        if (!liveAutoSnap.data()?.masterEnabled) break;
      }

      const emp = empDoc.data();
      
      // Eligibility Gate
      if (!emp.whatsappNumber || emp.whatsappOptIn === false) continue;

      try {
        // 2. Deterministic Idempotency Lock
        const jobKey = `${empDoc.id}_${dates[0]}_${dates[1]}`;
        const existingJob = await adminDb.collection('whatsapp_logs')
          .where('jobKey', '==', jobKey)
          .where('status', '==', 'success')
          .limit(1).get();
        
        if (!existingJob.empty && !bypassMasterCheck) continue;

        // 3. Document Synthesis
        const nextTwoDays = await getNextTwoDaysData(empDoc.id, emp.office);

        const pdfBuffer = await generateRosterPdf({
          employeeName: emp.fullName,
          employeeId: empDoc.id,
          officeName: emp.office,
          logoBase64: automation?.base64Logo,
          nextTwoDays
        });

        if (pdfBuffer.length === 0) throw new Error("Synthesis Failure: Empty buffer generated.");

        // 4. Secure Storage Registry
        const yearMonth = format(new Date(), 'yyyy/MM');
        const filename = `Team_Remote_Optometry_${empDoc.id}_${dates[0]}_${dates[1]}.pdf`;
        const storagePath = `whatsapp-roster-pdfs/${yearMonth}/${empDoc.id}/${filename}`;
        const file = bucket.file(storagePath);
        
        const generatedAt = new Date().toISOString();
        const expiresAt = addDays(new Date(), 2).toISOString(); // 48-Hour Lifecycle

        await file.save(pdfBuffer, {
          contentType: 'application/pdf',
          metadata: {
            metadata: {
              employeeUid: emp.authUid || 'unmapped',
              employeeId: empDoc.id,
              officeId: emp.office,
              rosterDates: dates.join(','),
              generatedAt,
              expiresAt,
              docSize: `${pdfBuffer.length}`,
              waStatus: 'pending_dispatch',
              cleanupStatus: 'active'
            }
          }
        });

        // 5. Meta Cloud Document API Handshake
        const dispatch = await sendWhatsAppShiftBriefingWithDocument(
          emp.whatsappNumber,
          emp.fullName,
          pdfBuffer,
          filename
        );

        if (dispatch.success) {
          successCount++;
          // 6. Institutional Audit Pulse
          await adminDb.collection('whatsapp_logs').add({
            executionId,
            jobKey,
            employeeId: empDoc.id,
            employeeName: emp.fullName,
            office: emp.office,
            status: 'success',
            docType: 'application/pdf',
            docSize: `${(pdfBuffer.length / 1024).toFixed(1)} KB`,
            byteSize: pdfBuffer.length,
            storagePath,
            messageId: dispatch.messageId,
            timestamp: new Date().toISOString(),
            expiresAt,
            cleanupStatus: 'pending'
          });

          await file.setMetadata({
             metadata: { waStatus: 'sent', messageId: dispatch.messageId }
          });

        } else {
          throw new Error(dispatch.error || "Meta API Rejected Payload");
        }

      } catch (empErr: any) {
        failCount++;
        await adminDb.collection('whatsapp_logs').add({
          executionId,
          employeeId: empDoc.id,
          employeeName: emp.fullName,
          office: emp.office,
          status: 'failed',
          error: empErr.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    if (autoSnap.exists) {
      await adminDb.collection('system_settings').doc('whatsapp_automation').update({
        lastRun: new Date().toISOString(),
        lastStats: { success: successCount, fail: failCount, total: successCount + failCount },
        updatedAt: new Date().toISOString()
      });
    }

    return { success: true, count: successCount, total: successCount + failCount, latency: Date.now() - start };

  } catch (globalErr: any) {
    console.error('CRITICAL_DISPATCH_FAILURE:', globalErr.message);
    return { success: false, error: globalErr.message };
  }
}
