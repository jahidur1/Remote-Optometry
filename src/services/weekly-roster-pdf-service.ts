
'use server';

import { adminDb, adminAuth, FieldValue } from '@/lib/firebase-admin';
import { generateWeeklyRosterPdf } from './roster-document-service';
import { getDatesForWeek, displayWeekRange } from '@/lib/date-utils';
import { format } from 'date-fns';
import { sendWhatsAppGenericTemplate } from './whatsapp-action';

/**
 * ROC WORKFORCE — WEEKLY ROSTER PDF SERVICE v18.0
 * 
 * Orchestrates bulk distribution with Meta Document API.
 * UPDATED: Fixed 'FieldValue.increment' import to resolve campaign tracking conflict.
 */

async function getAuthorizedUser(idToken: string) {
  if (!idToken) throw new Error("Unauthorized.");
  const decoded = await adminAuth.verifyIdToken(idToken, true);
  const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userSnap.exists) throw new Error("Identity not found.");
  const profile = userSnap.data()!;
  if (profile.status !== 'Active' || !['admin', 'super_admin'].includes(profile.role?.toLowerCase())) {
    throw new Error("Unauthorized: Elevated pulse required.");
  }
  return { uid: decoded.uid, ...profile } as any;
}

export async function initiateWeeklyRosterCampaignAction(idToken: string, officeId: string, weekId: string) {
  try {
    const caller = await getAuthorizedUser(idToken);
    
    const configSnap = await adminDb.collection('system_settings').doc('whatsapp_config').get();
    const config = configSnap.data() || {};

    if (!config.masterEnabled) throw new Error("MASTER_AUTOMATION_DISABLED");

    const campaignId = `camp_${officeId}_${weekId}_${Date.now()}`;
    const weekDates = getDatesForWeek(weekId);
    const weekRange = displayWeekRange(weekId);

    const [empSnap, rosterSnap, shiftSnap] = await Promise.all([
      adminDb.collection('employees').where('office', '==', officeId).where('status', '==', 'Active').get(),
      adminDb.collection('published_rosters').doc(`active_${weekId}_${officeId}`).get(),
      adminDb.collection('shift_master').get()
    ]);

    if (!rosterSnap.exists) throw new Error("Registry Alert: Roster not published for this cycle.");
    
    const assignments = rosterSnap.data()?.assignments || [];
    const shiftsMap = new Map();
    shiftSnap.docs.forEach(d => shiftsMap.set(d.id, d.data()));
    
    const eligibleEmployees = empSnap.docs.filter(doc => {
      const emp = doc.data();
      return !!emp.whatsappNumber && assignments.some((a: any) => a.employeeId === doc.id);
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

    for (const empDoc of eligibleEmployees) {
      const emp = empDoc.data();
      const employeeId = empDoc.id;

      try {
        const jobKey = `weekly_${employeeId}_${weekId}`;
        const rosterDays = weekDates.map(date => {
          const dStr = format(date, 'yyyy-MM-dd');
          const assign = assignments.find((a: any) => a.employeeId === employeeId && a.date === dStr);
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
          employeeId,
          officeName: officeId,
          weekRange,
          logoBase64: config.logoBase64,
          rosterDays
        });

        const dispatch = await sendWhatsAppGenericTemplate({
          to: emp.whatsappNumber,
          templateName: 'roc_weekly_roster_pdf',
          headerMedia: { type: 'document', buffer: pdfBuffer, filename: `Roster_${weekId}.pdf` },
          bodyVariables: [
            emp.fullName, 
            format(weekDates[0], 'dd MMM yyyy'), 
            format(weekDates[6], 'dd MMM yyyy')
          ]
        });

        if (dispatch.success) {
           await campaignRef.update({ 
             'stats.pending': FieldValue.increment(-1), 
             'stats.success': FieldValue.increment(1) 
           });
           await adminDb.collection('whatsapp_logs').add({ 
             jobKey, 
             employeeId, 
             employeeName: emp.fullName,
             office: officeId, 
             status: 'success', 
             notificationType: 'weekly_pdf',
             timestamp: new Date().toISOString() 
           });
        } else throw new Error(dispatch.error);

      } catch (e: any) {
        console.error(`CAMPAIGN_JOB_FAIL [${employeeId}]:`, e.message);
        await campaignRef.update({ 
          'stats.pending': FieldValue.increment(-1), 
          'stats.failed': FieldValue.increment(1) 
        });
      }
    }

    await campaignRef.update({ status: 'completed', completedAt: new Date().toISOString() });
    return { success: true, campaignId };
  } catch (e: any) {
    console.error('CAMPAIGN_CRITICAL_CONFLICT:', e.message);
    return { success: false, error: e.message };
  }
}
