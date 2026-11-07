'use server';

import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { logAuditServer } from './audit-service';
import { getTemplateStatus } from './whatsapp-action';

/**
 * ROC WORKFORCE — WHATSAPP GOVERNANCE v3.0
 * 
 * Manages institutional switches and template approval traces.
 */

async function assertSuperAdmin(idToken: string) {
  if (!idToken) throw new Error("Unauthorized.");
  const decoded = await adminAuth.verifyIdToken(idToken, true);
  const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userSnap.exists || userSnap.data()?.role !== 'super_admin') {
    throw new Error("Unauthorized.");
  }
  return decoded.uid;
}

export async function getWhatsAppSettingsAction() {
  try {
    const configSnap = await adminDb.collection('system_settings').doc('whatsapp_config').get();
    const data = configSnap.data() || {};

    const weeklyTemplate = data.weeklyTemplate || 'roc_weekly_roster_pdf';
    const dailyTemplate = data.dailyTemplate || 'roc_daily_two_day_shift_reminder';

    // Verify Actual Meta Status
    const weeklyStatus = await getTemplateStatus(weeklyTemplate);
    const dailyStatus = await getTemplateStatus(dailyTemplate);

    return {
      whatsappEnabled: data.whatsappEnabled ?? false,
      masterEnabled: data.masterEnabled ?? false,
      weeklyEnabled: data.weeklyEnabled ?? false,
      dailyReminderEnabled: data.dailyReminderEnabled ?? false,
      weeklyTemplate,
      dailyTemplate,
      templateHealth: {
        weekly: weeklyStatus,
        daily: dailyStatus
      },
      automation: {
        lastRun: data.automation?.lastRun || null,
        dailyLastRun: data.automation?.dailyLastRun || null,
        dailyStats: data.automation?.dailyStats || { success: 0, fail: 0, skipped: 0 }
      }
    };
  } catch (e) {
    return { 
      whatsappEnabled: false, 
      masterEnabled: false, 
      weeklyEnabled: false,
      dailyReminderEnabled: false,
      templateHealth: { weekly: 'UNKNOWN', daily: 'UNKNOWN' }
    };
  }
}

export async function updateWhatsAppSettingsAction(idToken: string, updates: any) {
  try {
    const uid = await assertSuperAdmin(idToken);
    
    // Defensive Logic: If Master is disabled, certain child switches can't be true (policy only)
    // But we preserve raw settings for flexibility.

    await adminDb.collection('system_settings').doc('whatsapp_config').set({
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: uid
    }, { merge: true });
    
    await logAuditServer(uid, 'UPDATE_WHATSAPP_CONFIG', 'system', updates);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
