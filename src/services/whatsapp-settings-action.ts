
'use server';

import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { logAuditServer } from './audit-service';

/**
 * ROC WORKFORCE — WHATSAPP GOVERNANCE (PART 1)
 * 
 * Manages the backend configuration for automated briefings.
 * Restricts modifications to active Super Admin nodes.
 */

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
    return { whatsappEnabled: false, automation: { masterEnabled: false } };
  }
}

export async function updateWhatsAppSettingsAction(idToken: string, updates: { enabled: boolean, logoBase64?: string, masterEnabled?: boolean }) {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!userSnap.exists || userSnap.data()?.role !== 'super_admin') {
      throw new Error("Unauthorized: Elevated credentials required.");
    }

    const batch = adminDb.batch();
    
    // 1. Update Core API Status
    batch.set(adminDb.collection('system_settings').doc('whatsapp_config'), {
      whatsappEnabled: updates.enabled,
      updatedAt: new Date().toISOString(),
      updatedBy: decoded.uid
    }, { merge: true });

    // 2. Update Automation Governance
    const autoUpdates: any = {
      updatedAt: new Date().toISOString(),
      updatedBy: decoded.uid
    };
    if (updates.masterEnabled !== undefined) autoUpdates.masterEnabled = updates.masterEnabled;
    if (updates.logoBase64 !== undefined) {
        autoUpdates.base64Logo = updates.logoBase64;
        autoUpdates.logoUpdatedAt = new Date().toISOString();
    }

    batch.set(adminDb.collection('system_settings').doc('whatsapp_automation'), autoUpdates, { merge: true });

    await batch.commit();
    await logAuditServer(decoded.uid, 'ADMIN_UPDATE_WHATSAPP_GOVERNANCE', 'system', { 
        enabled: updates.enabled, 
        master: updates.masterEnabled 
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
