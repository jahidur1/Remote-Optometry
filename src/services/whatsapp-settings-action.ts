
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
    if (!snap.exists) return { enabled: false, logoBase64: '' };
    return snap.data();
  } catch (e) {
    return { enabled: false, logoBase64: '' };
  }
}

export async function updateWhatsAppSettingsAction(idToken: string, settings: { enabled: boolean, logoBase64: string }) {
  const uid = await assertSuperAdmin(idToken);
  try {
    await adminDb.collection('system_settings').doc('whatsapp_config').set({
      whatsappEnabled: settings.enabled,
      logoBase64: settings.logoBase64,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    await logAuditServer(uid, 'UPDATE_WHATSAPP_GOVERNANCE', 'system', { enabled: settings.enabled });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
