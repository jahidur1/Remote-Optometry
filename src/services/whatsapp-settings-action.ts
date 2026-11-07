
'use server';

import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { logAuditServer } from './audit-service';
import { getTemplateStatus } from './whatsapp-action';

/**
 * ROC WORKFORCE — WHATSAPP GOVERNANCE v7.0
 * 
 * Manages institutional switches, template approval traces, and activity monitoring.
 * SECURITY: SUPER_ADMIN restricted.
 */

async function assertSuperAdmin(idToken: string) {
  if (!idToken) throw new Error("Unauthorized: Session Link Missing.");
  const decoded = await adminAuth.verifyIdToken(idToken); // Standard verification
  const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
  
  if (!userSnap.exists || userSnap.data()?.role !== 'super_admin') {
    throw new Error("Privilege Block: Super Admin access required for governance modifications.");
  }
  
  return { uid: decoded.uid, profile: userSnap.data() };
}

export async function getWhatsAppSettingsAction() {
  try {
    const configSnap = await adminDb.collection('system_settings').doc('whatsapp_config').get();
    const data = configSnap.data() || {};

    const weeklyTemplate = data.weeklyTemplate || 'roc_weekly_roster_pdf';
    const dailyTemplate = data.dailyTemplate || 'roc_daily_two_day_shift_reminder';

    // Real-time verification Pulse via Meta Graph API
    const [weeklyStatus, dailyStatus] = await Promise.all([
      getTemplateStatus(weeklyTemplate),
      getTemplateStatus(dailyTemplate)
    ]);

    return {
      whatsappEnabled: data.whatsappEnabled ?? false,
      masterEnabled: data.masterEnabled ?? false,
      weeklyEnabled: data.weeklyEnabled ?? false,
      dailyReminderEnabled: data.dailyReminderEnabled ?? false,
      weeklyTemplate,
      dailyTemplate,
      logoBase64: data.logoBase64 || null,
      templateHealth: {
        weekly: weeklyStatus,
        daily: dailyStatus
      },
      updatedAt: data.updatedAt || null,
      updatedBy: data.updatedBy || 'SYSTEM_DEFAULT'
    };
  } catch (e: any) {
    console.error('GOVERNANCE_FETCH_FAILURE:', e.message);
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
    const caller = await assertSuperAdmin(idToken);
    
    const configRef = adminDb.collection('system_settings').doc('whatsapp_config');
    const oldSnap = await configRef.get();
    const oldData = oldSnap.data() || {};

    // Strictly whitelist modifiable fields
    const whitelist = ['whatsappEnabled', 'masterEnabled', 'weeklyEnabled', 'dailyReminderEnabled', 'weeklyTemplate', 'dailyTemplate', 'logoBase64'];
    const filteredUpdates: any = {};
    
    Object.keys(updates).forEach(key => {
      if (whitelist.includes(key)) filteredUpdates[key] = updates[key];
    });

    const payload = {
      ...filteredUpdates,
      updatedAt: new Date().toISOString(),
      updatedBy: caller.uid
    };

    await configRef.set(payload, { merge: true });
    
    // Institutional Audit Protocol - Log detailed differences
    await logAuditServer(caller.uid, 'UPDATE_WHATSAPP_CONFIG', 'system_governance', {
      changedFields: Object.keys(filteredUpdates),
      previousState: oldData,
      newState: payload
    });

    return { success: true };
  } catch (e: any) {
    console.error('GOVERNANCE_UPDATE_FAILURE:', e.message);
    return { success: false, error: e.message };
  }
}
