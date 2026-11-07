'use server';

import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { generateWeeklyRosterPdf } from './roster-document-service';
import { getDatesForWeek, displayWeekRange } from '@/lib/date-utils';
import { format } from 'date-fns';
import { getStorage } from 'firebase-admin/storage';
import { sendWhatsAppGenericTemplate } from './whatsapp-action';

/**
 * ROC WORKFORCE — WEEKLY ROSTER PDF SERVICE v5.0
 * 
 * Orchestrates bulk distribution with Meta Document API and multi-switch logic gates.
 */

async function getAuthorizedUser(idToken: string) {
  if (!idToken) throw new Error("Unauthorized.");
  const decoded = await adminAuth.verifyIdToken(idToken, true);
  const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userSnap.exists) throw new Error("Identity not found.");
  return { uid: decoded.uid, ...userSnap.data() } as any;
}

export async function initiateWeeklyRosterCampaignAction(idToken: string, officeId: string, weekId: string) {
  try {
    const caller = await getAuthorizedUser(idToken);
    
    // 1. Logic Gate Check (Switch Enforcement)
    const configSnap = await adminDb.collection('system_settings').doc('whatsapp_config').get();
    const config = configSnap.data() || {};

    if (!config.masterEnabled) throw new Error("MASTER_AUTOMATION_DISABLED");
    if (!config.weeklyEnabled) throw new Error("WEEKLY_CAMPAIGNS_DISABLED");
    if (!config.whatsappEnabled) throw new Error("WHATSAPP_INTEGRATION_DISABLED");

    const campaignId = `camp_${officeId}_${weekId}_${Date.now()}`;
    const weekDates = getDatesForWeek(weekId);
    const weekRange = displayWeekRange(weekId);

    const [empSnap, rosterSnap, shiftSnap] = await Promise.all([
      adminDb.collection('employees').where('office', '==', officeId).where('status', '==', 'Active').get(),
      adminDb.collection('published_rosters').doc(`active_${weekId}_${officeId}`).get(),
      adminDb.collection('shift_master').get()
    ]);

    if (!rosterSnap.exists) throw new Error("Roster not published for this cycle.");
    
    const assignments = rosterSnap.data()?.assignments || [];
    const shiftsMap = new Map();
    shiftSnap.docs.forEach(d => shiftsMap.set(d.id, d.data()));
    
    const templateName = config.weeklyTemplate || 'roc_weekly_roster_pdf';

    const eligibleEmployees = empSnap.docs.filter(doc => {
      const emp = doc.data();
      return !!emp.whatsappNumber && emp.whatsappOptIn !== false && assignments.some((a: any) => a.employeeId === doc.id);
    });

    const campaignRef = adminDb.collection('weekly_roster_campaigns').doc(campaignId);
    await campaignRef.set({
      id: campaignId,
      officeId,
      weekId,
      status: 'processing',
      stats: { total: eligibleEmployees.length, pending: eligibleEmployees.length, success: 0, failed: 0 },
      createdAt: new Date().toISOString(),
      actorId: caller.uid
    });

    const storage = getStorage();
    const bucket = storage.bucket();

    for (const empDoc of eligibleEmployees) {
      // Re-check Master Switch before each professional dispatch (Real-time responsiveness)
      const liveConfig = await adminDb.collection('system_settings').doc('whatsapp_config').get();
      if (!liveConfig.data()?.masterEnabled) break;

      const emp = empDoc.data();
      const employeeId = empDoc.id;

      try {
        const jobKey = `weekly_${employeeId}_${weekId}`;
        
        // Idempotency check: notificationType required in query
        const existing = await adminDb.collection('whatsapp_logs')
          .where('jobKey', '==', jobKey)
          .where('notificationType', '==', 'weekly_roster_pdf')
          .where('status', '==', 'success')
          .limit(1).get();

        if (!existing.empty) {
           await campaignRef.update({ 'stats.pending': adminDb.FieldValue.increment(-1), 'stats.success': adminDb.FieldValue.increment(1) });
           continue;
        }

        const rosterDays = weekDates.map(date => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const assign = assignments.find((a: any) => a.employeeId === employeeId && a.date === dateStr);
          const shift = assign ? shiftsMap.get(assign.shiftId) : null;
          return {
            date: format(date, 'dd MMM yyyy').toUpperCase(),
            day: format(date, 'EEEE'),
            shift: (!assign || assign.shiftId === 'none') ? 'WEEK OFF' : (shift?.name || 'DUTY'),
            time: (!assign || assign.shiftId === 'none') ? '--:--' : `${shift?.startTime} - ${shift?.endTime}`,
            shiftId: assign?.shiftId || 'none'
          };
        });

        // Document Synthesis
        const pdfBuffer = await generateWeeklyRosterPdf({
          employeeName: emp.fullName,
          employeeId,
          officeName: officeId,
          weekRange,
          logoBase64: config.logoBase64,
          rosterDays
        });

        const filename = `Roster_${employeeId}_${weekId}.pdf`;
        const storagePath = `weekly-roster-pdfs/${officeId}/${weekId}/${employeeId}/${filename}`;
        await bucket.file(storagePath).save(pdfBuffer, { contentType: 'application/pdf' });

        // Meta Cloud Document API Pulse
        const dispatch = await sendWhatsAppGenericTemplate({
          to: emp.whatsappNumber,
          templateName,
          headerMedia: { type: 'document', buffer: pdfBuffer, filename },
          bodyVariables: [emp.fullName, format(weekDates[0], 'yyyy-MM-dd'), format(weekDates[6], 'yyyy-MM-dd')]
        });

        await adminDb.collection('whatsapp_logs').add({
          jobKey,
          employeeId,
          office: officeId,
          notificationType: 'weekly_roster_pdf',
          templateId: templateName,
          status: dispatch.success ? 'success' : 'failed',
          messageId: dispatch.messageId,
          apiStatus: dispatch.apiStatus,
          storagePath,
          timestamp: new Date().toISOString()
        });

        if (dispatch.success) {
           await campaignRef.update({ 'stats.pending': adminDb.FieldValue.increment(-1), 'stats.success': adminDb.FieldValue.increment(1) });
        } else {
           throw new Error(dispatch.error);
        }
      } catch (e) {
        await campaignRef.update({ 'stats.pending': adminDb.FieldValue.increment(-1), 'stats.failed': adminDb.FieldValue.increment(1) });
      }
    }

    await campaignRef.update({ status: 'completed', completedAt: new Date().toISOString() });
    return { success: true, campaignId };

  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

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
    const configSnap = await adminDb.collection('system_settings').doc('whatsapp_config').get();
    
    // Synthesis logic (Standard 7-day map)
    const rosterDays = weekDates.map(d => ({ 
      date: format(d, 'dd MMM yyyy').toUpperCase(), 
      day: format(d, 'EEEE'), 
      shift: 'DUTY', 
      time: '10:00 AM - 07:00 PM', 
      shiftId: 'OP' 
    }));

    const pdfBuffer = await generateWeeklyRosterPdf({
      employeeName: emp.fullName,
      employeeId: emp.id,
      weekRange: weekRangeStr,
      logoBase64: configSnap.data()?.logoBase64,
      rosterDays
    });

    return { 
      success: true, 
      base64: `data:application/pdf;base64,${pdfBuffer.toString('base64')}`, 
      size: `${(pdfBuffer.length / 1024).toFixed(1)} KB` 
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}