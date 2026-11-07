'use server';

import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { logAuditServer } from './audit-service';

/**
 * ROC WORKFORCE — WHATSAPP GOVERNANCE v2.0
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

    return {
      whatsappEnabled: data.whatsappEnabled || false,
      masterEnabled: data.masterEnabled || false,
      dailyReminderEnabled: data.dailyReminderEnabled || false,
      weeklyTemplate: data.weeklyTemplate || 'roc_weekly_roster_pdf',
      dailyTemplate: data.dailyTemplate || 'roc_daily_two_day_shift_reminder',
      automation: {
        lastRun: data.automation?.lastRun || null,
        dailyLastRun: data.automation?.dailyLastRun || null,
        dailyStats: data.automation?.dailyStats || { success: 0, fail: 0, skipped: 0 }
      }
    };
  } catch (e) {
    return { whatsappEnabled: false, masterEnabled: false, dailyReminderEnabled: false };
  }
}

export async function updateWhatsAppSettingsAction(idToken: string, updates: any) {
  try {
    const uid = await assertSuperAdmin(idToken);
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
