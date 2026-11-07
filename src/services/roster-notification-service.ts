
'use server';

import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { generateRosterPdf, generateWeeklyRosterPdf } from './roster-document-service';
import { sendWhatsAppGenericTemplate } from './whatsapp-action';
import { format, addDays } from 'date-fns';
import { getStorage } from 'firebase-admin/storage';
import { formatWeekId, getISTNow, getDatesForWeek, displayWeekRange } from '@/lib/date-utils';

/**
 * ROC WORKFORCE — PREMIUM CLINICAL BRIEFING SERVICE v11.0 (Secure PDF Protocol)
 * 
 * Orchestrates premium document synthesis, private storage, and Meta API dispatch.
 */

async function getAuthorizedUser(idToken: string) {
  if (!idToken) throw new Error("Unauthorized: Session pulse missing.");
  const decoded = await adminAuth.verifyIdToken(idToken);
  const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userSnap.exists) throw new Error("Registry Error: Identity node not found.");
  const profile = userSnap.data()!;
  if (profile.role !== 'super_admin' && profile.role !== 'admin') {
    throw new Error("Privilege Block: Administrative pulse required.");
  }
  return { uid: decoded.uid, ...profile } as any;
}

/**
 * previewEmployeeRosterAction
 */
export async function previewEmployeeRosterAction(idToken: string, employeeId: string, weekId?: string, mockCase?: number) {
  try {
    await getAuthorizedUser(idToken);
    
    let emp: any = { fullName: 'TEST PROFESSIONAL', office: 'HQ_GLOBAL', id: 'EMP-PREVIEW-001' };
    
    if (employeeId !== 'TEST-EMP') {
      const empSnap = await adminDb.collection('employees').doc(employeeId).get();
      if (empSnap.exists) emp = empSnap.data();
    }

    const configSnap = await adminDb.collection('system_settings').doc('whatsapp_config').get();
    const logoBase64 = configSnap.exists ? configSnap.data()?.logoBase64 : null;

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
      size: `${(pdfBuffer.length / 1024).toFixed(1)} KB`
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * sendTestWhatsAppAction
 * Sandbox tool for Meta API verification.
 */
export async function sendTestWhatsAppAction(idToken: string, employeeId: string, type: 'daily' | 'weekly') {
  try {
    const caller = await getAuthorizedUser(idToken);
    
    const empSnap = await adminDb.collection('employees').doc(employeeId).get();
    if (!empSnap.exists) throw new Error("Target Professional not found.");
    const emp = empSnap.data()!;

    if (!emp.whatsappNumber) throw new Error("Meta Alert: Professional mobile endpoint missing.");

    const configSnap = await adminDb.collection('system_settings').doc('whatsapp_config').get();
    const config = configSnap.data() || {};
    
    if (type === 'weekly') {
      const weekId = formatWeekId(getISTNow());
      const weekDates = getDatesForWeek(weekId);
      const weekRange = displayWeekRange(weekId);
      
      const rosterId = `active_${weekId}_${emp.office}`;
      const rosterSnap = await adminDb.collection('published_rosters').doc(rosterId).get();
      const assignments = rosterSnap.exists ? rosterSnap.data()?.assignments || [] : [];
      
      const shiftSnap = await adminDb.collection('shift_master').get();
      const shiftsMap = new Map();
      shiftSnap.docs.forEach(d => shiftsMap.set(d.id, d.data()));

      const rosterDays = weekDates.map(date => {
        const dStr = format(date, 'yyyy-MM-dd');
        const assign = assignments.find((a: any) => a.employeeId === employeeId && a.date === dStr);
        const shift = assign ? shiftsMap.get(assign.shiftId) : null;
        return {
          date: format(date, 'dd MMM yyyy').toUpperCase(),
          day: format(date, 'EEEE'),
          shift: (!assign || assign.shiftId === 'none') ? 'WEEK OFF' : (shift?.name || 'DUTY'),
          time: (!assign || assign.shiftId === 'none') ? '--:--' : `${shift?.startTime} - ${shift?.endTime}`,
          shiftId: assign?.shiftId || 'none'
        };
      });

      const pdfBuffer = await generateWeeklyRosterPdf({
        employeeName: emp.fullName,
        employeeId: emp.id,
        officeName: emp.office,
        weekRange,
        logoBase64: config.logoBase64,
        rosterDays
      });

      const filename = `Test_Roster_${employeeId}.pdf`;
      const dispatch = await sendWhatsAppGenericTemplate({
        to: emp.whatsappNumber,
        templateName: config.weeklyTemplate || 'roc_weekly_roster_pdf',
        headerMedia: { type: 'document', buffer: pdfBuffer, filename },
        bodyVariables: [emp.fullName, format(weekDates[0], 'yyyy-MM-dd'), format(weekDates[6], 'yyyy-MM-dd')]
      });

      return dispatch;
    } else {
      // DAILY TEXT TEST
      const istNow = getISTNow();
      const tomorrow = addDays(istNow, 1);
      const dayAfter = addDays(istNow, 2);
      
      const dispatch = await sendWhatsAppGenericTemplate({
        to: emp.whatsappNumber,
        templateName: config.dailyTemplate || 'roc_daily_two_day_shift_reminder',
        bodyVariables: [
          emp.fullName,
          format(tomorrow, 'EEEE, dd MMM'), 'DUTY', '10:00 AM - 07:00 PM',
          format(dayAfter, 'EEEE, dd MMM'), 'WEEK OFF', 'Enjoy your day off!'
        ]
      });

      return dispatch;
    }
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
