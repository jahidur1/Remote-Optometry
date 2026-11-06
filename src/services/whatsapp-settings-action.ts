
'use server';

import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { logAuditServer } from './audit-service';

/**
 * ROC WORKFORCE — WHATSAPP GOVERNANCE ACTIONS
 * 
 * Exclusively available to super_admins.
 */

async function assertSuperAdmin(idToken: string) {
  if (!idToken) throw new Error("Auth pulse missing.");
  const decoded = await adminAuth.verifyIdToken(idToken);
  const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userSnap.exists || userSnap.data()?.role !== 'super_admin') {
    throw new Error("Privileged pulse required.");
  }
  return decoded.uid;
}

export async function getWhatsAppSettingsAction() {
  try {
    const snap = await adminDb.collection('system_settings').doc('whatsapp_config').get();
    const autoSnap = await adminDb.collection('system_settings').doc('whatsapp_automation').get();
    
    return {
      ...(snap.exists ? snap.data() : { enabled: false, logoBase64: '' }),
      automation: autoSnap.exists ? autoSnap.data() : { 
        masterEnabled: false, 
        lastRun: null, 
        successCount: 0, 
        failCount: 0,
        nextRun: 'Today 10:00 PM IST'
      }
    };
  } catch (e) {
    return { enabled: false, logoBase64: '', automation: { masterEnabled: false } };
  }
}

export async function updateWhatsAppSettingsAction(idToken: string, settings: { enabled: boolean, logoBase64: string, masterEnabled?: boolean }) {
  const uid = await assertSuperAdmin(idToken);
  try {
    const batch = adminDb.batch();
    
    const configRef = adminDb.collection('system_settings').doc('whatsapp_config');
    batch.set(configRef, {
      whatsappEnabled: settings.enabled,
      logoBase64: settings.logoBase64,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    if (settings.masterEnabled !== undefined) {
      const autoRef = adminDb.collection('system_settings').doc('whatsapp_automation');
      batch.set(autoRef, {
        masterEnabled: settings.masterEnabled,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }

    await batch.commit();
    await logAuditServer(uid, 'UPDATE_WHATSAPP_GOVERNANCE', 'system', { enabled: settings.enabled, master: settings.masterEnabled });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
