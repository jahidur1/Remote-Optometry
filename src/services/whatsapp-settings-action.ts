
'use server';

import { adminAuth, adminDb } from '@/lib/firebase-admin';

/**
 * ROC WORKFORCE — WHATSAPP GOVERNANCE (PART 1)
 * 
 * Secure internal actions for configuration management.
 */

export async function getWhatsAppSettingsAction() {
  try {
    const snap = await adminDb.collection('system_settings').doc('whatsapp_config').get();
    const autoSnap = await adminDb.collection('system_settings').doc('whatsapp_automation').get();
    
    return {
      ...(snap.exists ? snap.data() : { whatsappEnabled: false, logoBase64: '' }),
      automation: autoSnap.exists ? autoSnap.data() : { 
        masterEnabled: false, 
        lastRun: null, 
        lastStats: { success: 0, fail: 0, total: 0 }
      }
    };
  } catch (e) {
    return { whatsappEnabled: false, logoBase64: '', automation: { masterEnabled: false } };
  }
}
