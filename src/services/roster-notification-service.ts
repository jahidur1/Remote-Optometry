'use server';

import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { generateRosterPdf } from './roster-document-service';
import { sendWhatsAppShiftBriefingWithDocument } from './whatsapp-action';
import { format, addDays } from 'date-fns';
import { getStorage } from 'firebase-admin/storage';
import { formatWeekId, getISTNow } from '@/lib/date-utils';

/**
 * ROC WORKFORCE — PREMIUM CLINICAL BRIEFING SERVICE v8.0 (PDF)
 * 
 * Orchestrates premium document synthesis and Meta API dispatch.
 * PROTOCOL: Secure Document Registry & Metadata Archiving.
 */

async function getAuthorizedUser(idToken: string) {
  if (!idToken) throw new Error("Unauthorized.");
  const decoded = await adminAuth.verifyIdToken(idToken, true);
  const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userSnap.exists) throw new Error("Profile not found.");
  return { uid: decoded.uid, ...userSnap.data() } as any;
}

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

export async function previewEmployeeRosterAction(idToken: string, employeeId: string, mockCase?: number) {
  try {
    const profile = await getAuthorizedUser(idToken);
    if (profile.role !== 'super_admin' && profile.role !== 'admin') throw new Error("Unauthorized.");
    
    let emp: any = { fullName: 'TEST PROFESSIONAL', office: 'HQ_GLOBAL', id: 'EMP-PREVIEW-001' };
    
    if (employeeId !== 'TEST-EMP') {
      const empSnap = await adminDb.collection('employees').doc(employeeId).get();
      if (empSnap.exists) emp = empSnap.data();
    }

    const autoSnap = await adminDb.collection('system_settings').doc('whatsapp_automation').get();
    const logoBase64 = autoSnap.exists ? autoSnap.data()?.base64Logo : null;

    const nextTwoDays = await getNextTwoDaysData(emp.id, emp.office, mockCase);

    const pdfBuffer = await generateRosterPdf({
      employeeName: emp.fullName,
      employeeId: emp.id,
      officeName: emp.office,
      logoBase64,
      nextTwoDays
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

export async function dispatchOfficeBriefingsAction(idToken: string, officeId: string) {
  try {
    const profile = await getAuthorizedUser(idToken);
    
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

export async function runAutomatedRosterBriefing(officeId?: string, bypassMasterCheck = false) {
  const executionId = `exec_${Date.now()}`;
  let successCount = 0;
  let failCount = 0;

  try {
    const istNow = getISTNow();
    const configSnap = await adminDb.collection('system_settings').doc('whatsapp_config').get();
    const autoSnap = await adminDb.collection('system_settings').doc('whatsapp_automation').get();
    
    if (!bypassMasterCheck) {
      if (!configSnap.data()?.whatsappEnabled || !autoSnap.data()?.masterEnabled) {
        throw new Error("AUTOMATION_SUSPENDED: Master Pulse is OFF.");
      }
    }

    const automation = autoSnap.exists ? autoSnap.data() : { base64Logo: null };
    
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
      const emp = empDoc.data();
      if (!emp.whatsappNumber) continue;

      try {
        const jobKey = `${empDoc.id}_${dates[0]}_${dates[1]}`;
        const existingJob = await adminDb.collection('whatsapp_logs')
          .where('jobKey', '==', jobKey)
          .where('status', '==', 'success')
          .limit(1).get();
        
        if (!existingJob.empty && !bypassMasterCheck) continue;

        const nextTwoDays = await getNextTwoDaysData(empDoc.id, emp.office);

        const pdfBuffer = await generateRosterPdf({
          employeeName: emp.fullName,
          employeeId: empDoc.id,
          officeName: emp.office,
          logoBase64: automation?.base64Logo,
          nextTwoDays
        });

        // 1. SAVE TO INSTITUTIONAL REGISTRY
        const storagePath = `whatsapp-roster-documents/${format(new Date(), 'yyyy/MM')}/${empDoc.id}/${executionId}.pdf`;
        const file = bucket.file(storagePath);
        
        await file.save(pdfBuffer, {
          contentType: 'application/pdf',
          metadata: {
            metadata: {
              employeeUid: emp.authUid || 'none',
              employeeId: empDoc.id,
              rosterDates: dates.join(','),
              expiresAt: addDays(new Date(), 2).toISOString(),
              docSize: `${pdfBuffer.length}`,
              generationStatus: 'success',
              dispatchTime: new Date().toISOString()
            }
          }
        });

        // 2. DISPATCH VIA META CLOUD API
        const dispatch = await sendWhatsAppShiftBriefingWithDocument(
          emp.whatsappNumber,
          emp.fullName,
          pdfBuffer,
          `Team_Remote_Optometry_${empDoc.id}_${dates[0]}_${dates[1]}.pdf`
        );

        if (dispatch.success) {
          successCount++;
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

    return { success: true, count: successCount, total: successCount + failCount };

  } catch (globalErr: any) {
    return { success: false, error: globalErr.message };
  }
}
