
'use server';

import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { logAuditServer } from './audit-service';

/**
 * ROC WORKFORCE — WHATSAPP GOVERNANCE (PART 2)
 * 
 * Manages institutional branding, master automation toggles, and Meta API telemetry.
 * Restricts modifications to active Super Admin nodes.
 */

async function assertSuperAdmin(idToken: string) {
  if (!idToken) throw new Error("Unauthorized: Identity link missing.");
  const decoded = await adminAuth.verifyIdToken(idToken, true);
  const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userSnap.exists || userSnap.data()?.role !== 'super_admin') {
    throw new Error("Unauthorized: Super Admin pulse required.");
  }
  return decoded.uid;
}

export async function getWhatsAppSettingsAction() {
  try {
    const snap = await adminDb.collection('system_settings').doc('whatsapp_config').get();
    const autoSnap = await adminDb.collection('system_settings').doc('whatsapp_automation').get();
    
    return {
      whatsappEnabled: snap.data()?.whatsappEnabled || false,
      automation: autoSnap.exists ? autoSnap.data() : { 
        masterEnabled: false, 
        base64Logo: '', 
        lastRun: null, 
        lastStats: { success: 0, fail: 0, total: 0 }
      }
    };
  } catch (e) {
    console.error('Governance Fetch Failure:', e);
    return { 
      whatsappEnabled: false, 
      automation: { masterEnabled: false, lastStats: { success: 0, fail: 0, total: 0 } } 
    };
  }
}

export async function updateWhatsAppSettingsAction(idToken: string, updates: { enabled?: boolean, logoBase64?: string, masterEnabled?: boolean }) {
  try {
    const uid = await assertSuperAdmin(idToken);
    const batch = adminDb.batch();
    const now = new Date().toISOString();
    
    // 1. Update Core API Status (whatsapp_config)
    if (updates.enabled !== undefined) {
      batch.set(adminDb.collection('system_settings').doc('whatsapp_config'), {
        whatsappEnabled: updates.enabled,
        updatedAt: now,
        updatedBy: uid
      }, { merge: true });
    }

    // 2. Update Automation Governance (whatsapp_automation)
    const autoUpdates: any = {
      updatedAt: now,
      updatedBy: uid
    };
    if (updates.masterEnabled !== undefined) autoUpdates.masterEnabled = updates.masterEnabled;
    if (updates.logoBase64 !== undefined) {
        autoUpdates.base64Logo = updates.logoBase64;
        autoUpdates.logoUpdatedAt = now;
    }

    batch.set(adminDb.collection('system_settings').doc('whatsapp_automation'), autoUpdates, { merge: true });

    await batch.commit();
    await logAuditServer(uid, 'ADMIN_UPDATE_WHATSAPP_GOVERNANCE', 'system', { 
        enabled: updates.enabled, 
        master: updates.masterEnabled,
        logoUpdated: !!updates.logoBase64
    });

    return { success: true };
  } catch (e: any) {
    console.error('Governance Sync Failure:', e.message);
    return { success: false, error: e.message };
  }
}
