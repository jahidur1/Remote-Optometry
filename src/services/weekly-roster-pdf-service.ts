'use server';

import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { generateWeeklyRosterPdf } from './roster-document-service';
import { getDatesForWeek, displayWeekRange } from '@/lib/date-utils';
import { format } from 'date-fns';
import { getStorage } from 'firebase-admin/storage';
import { logAuditServer } from './audit-service';
import { sendWhatsAppGenericTemplate } from './whatsapp-action';

/**
 * ROC WORKFORCE — WEEKLY ROSTER PDF SERVICE v3.0
 * 
 * Orchestrates high-fidelity full-week document synthesis, secure storage,
 * and bulk administrative dispatch campaigns.
 */

async function getAuthorizedUser(idToken: string) {
  if (!idToken) throw new Error("Unauthorized: Identity link missing.");
  const decoded = await adminAuth.verifyIdToken(idToken, true);
  const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userSnap.exists) throw new Error("Registry Error: Identity node not found.");
  const profile = userSnap.data()!;
  
  if (profile.status !== 'Active') throw new Error("Access Denied: Account suspended.");
  if (!['admin', 'super_admin'].includes(profile.role)) throw new Error("Unauthorized Pulse.");
  
  return { uid: decoded.uid, ...profile } as any;
}

/**
 * previewWeeklyRosterAction
 * Synthesizes a 7-day PDF for real-time administrative review.
 */
export async function previewWeeklyRosterAction(idToken: string, employeeId: string, weekId: string, mockCase?: number) {
  try {
    const caller = await getAuthorizedUser(idToken);

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

    const autoSnap = await adminDb.collection('system_settings').doc('whatsapp_config').get();
    const logoBase64 = autoSnap.data()?.logoBase64 || null;

    const rosterId = `active_${weekId}_${emp.office}`;
    const rosterSnap = await adminDb.collection('published_rosters').doc(rosterId).get();
    const publishedAssignments = rosterSnap.exists ? (rosterSnap.data()?.assignments || []) : [];

    const rosterDays = weekDates.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      
      if (mockCase !== undefined) {
         if (mockCase === 1) {
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
         if (mockCase === 2) {
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
         if (mockCase === 3) {
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

      const assign = publishedAssignments.find((a: any) => a.employeeId === emp.id && a.date === dateStr);
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
      weekRange: weekRangeStr,
      logoBase64,
      rosterDays
    });

    await logAuditServer(caller.uid, 'PREVIEW_WEEKLY_ROSTER', emp.id, { weekId, mock: !!mockCase });

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
 * initiateWeeklyRosterCampaignAction
 * Orchestrates office-wise bulk distribution with strict idempotency and concurrency limits.
 */
export async function initiateWeeklyRosterCampaignAction(idToken: string, officeId: string, weekId: string) {
  try {
    const caller = await getAuthorizedUser(idToken);
    
    // Authorization Scoping
    if (caller.role !== 'super_admin') {
      const allowed = caller.officeIds || (caller.office ? [caller.office] : []);
      if (!allowed.includes(officeId)) throw new Error("Unauthorized cluster access.");
    }

    const campaignId = `camp_${officeId}_${weekId}_${Date.now()}`;
    const weekDates = getDatesForWeek(weekId);
    const weekRange = displayWeekRange(weekId);
    const startDateStr = format(weekDates[0], 'yyyy-MM-dd');
    const endDateStr = format(weekDates[6], 'yyyy-MM-dd');

    // 1. Core Data Aggregation
    const [empSnap, rosterSnap, shiftSnap, configSnap] = await Promise.all([
      adminDb.collection('employees').where('office', '==', officeId).where('status', '==', 'Active').get(),
      adminDb.collection('published_rosters').doc(`active_${weekId}_${officeId}`).get(),
      adminDb.collection('shift_master').get(),
      adminDb.collection('system_settings').doc('whatsapp_config').get()
    ]);

    if (!rosterSnap.exists) throw new Error("Registry Error: No published roster found for this cycle.");
    
    const assignments = rosterSnap.data()?.assignments || [];
    const shiftsMap = new Map();
    shiftSnap.docs.forEach(d => shiftsMap.set(d.id, d.data()));
    const config = configSnap.data() || {};
    const templateName = config.weeklyTemplate || 'roc_weekly_roster_pdf';
    const logoBase64 = config.logoBase64 || null;

    // 2. Identify Eligible Batch
    const eligibleEmployees = empSnap.docs.filter(doc => {
      const emp = doc.data();
      const hasWA = !!emp.whatsappNumber;
      const hasOptIn = emp.whatsappOptIn !== false;
      const hasRoster = assignments.some((a: any) => a.employeeId === doc.id);
      return hasWA && hasOptIn && hasRoster;
    });

    const campaignRef = adminDb.collection('weekly_roster_campaigns').doc(campaignId);
    await campaignRef.set({
      id: campaignId,
      officeId,
      weekId,
      weekRange,
      status: 'processing',
      stats: { total: eligibleEmployees.length, pending: eligibleEmployees.length, pdfGenerated: 0, submitted: 0, failed: 0, success: 0 },
      createdAt: new Date().toISOString(),
      actorId: caller.uid
    });

    const storage = getStorage();
    const bucket = storage.bucket();

    // 3. Batch Orchestration Loop (Sequential for stability/rate-limits)
    for (const empDoc of eligibleEmployees) {
      const emp = empDoc.data();
      const employeeId = empDoc.id;

      try {
        // Idempotency: Verify no previous successful weekly send for this specific cycle
        const existingLog = await adminDb.collection('whatsapp_logs')
          .where('employeeId', '==', employeeId)
          .where('weekId', '==', weekId)
          .where('notificationType', '==', 'weekly_roster_pdf')
          .where('status', '==', 'success')
          .limit(1).get();

        if (!existingLog.empty) {
          await campaignRef.update({ 'stats.pending': adminDb.FieldValue.increment(-1), 'stats.success': adminDb.FieldValue.increment(1) });
          continue;
        }

        // A. Synthesis
        const rosterDays = weekDates.map(date => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const assign = assignments.find((a: any) => a.employeeId === employeeId && a.date === dateStr);
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
          employeeId: employeeId,
          officeName: officeId,
          weekRange,
          logoBase64,
          rosterDays
        });

        // B. Cloud Persistence
        const filename = `Team_Remote_Optometry_${employeeId}_${weekId}.pdf`;
        const storagePath = `weekly-roster-pdfs/${officeId}/${weekId}/${employeeId}/${filename}`;
        await bucket.file(storagePath).save(pdfBuffer, { contentType: 'application/pdf' });

        // C. Meta Handshake
        const dispatch = await sendWhatsAppGenericTemplate({
          to: emp.whatsappNumber,
          templateName,
          headerMedia: { type: 'document', buffer: pdfBuffer, filename },
          bodyVariables: [emp.fullName, startDateStr, endDateStr]
        });

        if (dispatch.success) {
           await adminDb.collection('whatsapp_logs').add({
             employeeId,
             employeeName: emp.fullName,
             office: officeId,
             weekId,
             notificationType: 'weekly_roster_pdf',
             status: 'success',
             messageId: dispatch.messageId,
             timestamp: new Date().toISOString()
           });
           await campaignRef.update({ 
             'stats.pending': adminDb.FieldValue.increment(-1), 
             'stats.pdfGenerated': adminDb.FieldValue.increment(1), 
             'stats.submitted': adminDb.FieldValue.increment(1),
             'stats.success': adminDb.FieldValue.increment(1)
           });
        } else {
           throw new Error(dispatch.error || "Meta Rejected Payload");
        }

      } catch (empErr: any) {
        await campaignRef.update({ 'stats.pending': adminDb.FieldValue.increment(-1), 'stats.failed': adminDb.FieldValue.increment(1) });
        await adminDb.collection('whatsapp_logs').add({
          employeeId,
          employeeName: emp.fullName,
          office: officeId,
          weekId,
          notificationType: 'weekly_roster_pdf',
          status: 'failed',
          error: empErr.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    await campaignRef.update({ status: 'completed', completedAt: new Date().toISOString() });
    await logAuditServer(caller.uid, 'FINISH_WEEKLY_DISTRIBUTION', officeId, { weekId, count: eligibleEmployees.length });

    return { success: true, campaignId, count: eligibleEmployees.length };

  } catch (e: any) {
    console.error('BULK_DISTRIBUTION_FAILURE:', e.message);
    return { success: false, error: e.message };
  }
}
