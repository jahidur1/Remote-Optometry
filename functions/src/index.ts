
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { format, addDays } from 'date-fns';

admin.initializeApp();

/**
 * ROC WORKFORCE — AUTOMATED ROSTER BRIEFING (10 PM IST)
 * 
 * Cron: 0 22 * * * (Asia/Kolkata)
 * Orchestrates: Identity fetching, PDF synthesis, Private storage, and Meta dispatch.
 */
export const dailyRosterBriefing = functions.region('asia-south1').runWith({
  secrets: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'INTERNAL_TRIGGER_KEY'],
  timeoutSeconds: 300,
  memory: '1GB'
}).pubsub
  .schedule('0 22 * * *')
  .timeZone('Asia/Kolkata')
  .onRun(async (context: functions.EventContext) => {
    const db = admin.firestore();
    
    // 1. Governance Pulse Check
    const autoSnap = await db.collection('system_settings').doc('whatsapp_automation').get();
    const configSnap = await db.collection('system_settings').doc('whatsapp_config').get();
    
    if (!autoSnap.exists || !autoSnap.data()?.masterEnabled) {
      console.log('ROC_PULSE_SKIP: Master automation toggle is OFF.');
      return null;
    }

    if (!configSnap.exists || !configSnap.data()?.whatsappEnabled) {
      console.log('ROC_PULSE_SKIP: Meta API integration is DISABLED.');
      return null;
    }

    console.log('ROC_PULSE_INIT: Orchestrating daily clinical briefings (PDF Protocol)...');
    
    const APP_URL = process.env.APP_URL || 'https://studio-9087637488-aa952.web.app';
    const SECRET_KEY = process.env.INTERNAL_TRIGGER_KEY || 'roc_internal_pulse';

    try {
      const response = await fetch(`${APP_URL}/api/cron/roster-briefing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      console.log('ROC_PULSE_COMPLETE:', result);
    } catch (e: any) {
      console.error('ROC_PULSE_ERROR:', e.message);
    }
    
    return { success: true, timestamp: new Date().toISOString() };
  });

/**
 * ROC WORKFORCE — STORAGE LIFECYCLE GUARD (48h EXPR)
 * 
 * Periodically purges roster PDFs older than 48 hours to maintain 
 * institutional registry hygiene and minimize storage overhead.
 */
export const storageCleanupPulse = functions.region('asia-south1').pubsub
  .schedule('0 * * * *') // Runs hourly
  .onRun(async (context: functions.EventContext) => {
    const bucket = admin.storage().bucket();
    const db = admin.firestore();
    const now = new Date();
    
    // Scan both legacy images and new PDF protocol paths
    const prefixes = ['whatsapp-roster-images/', 'whatsapp-roster-pdfs/'];
    let purgedCount = 0;

    for (const prefix of prefixes) {
      const [files] = await bucket.getFiles({ prefix });
      console.log(`ROC_CLEANUP_INIT: Scanning ${files.length} assets in ${prefix}...`);

      for (const file of files) {
        const [metadata] = await file.getMetadata();
        const expiresAtStr = metadata.metadata?.expiresAt;

        if (expiresAtStr && typeof expiresAtStr === 'string') {
          const expiresAt = new Date(expiresAtStr);
          if (now > expiresAt) {
            try {
              await file.delete();
              purgedCount++;
              
              // Update log registry if storagePath matches
              const logSnap = await db.collection('whatsapp_logs')
                .where('storagePath', '==', file.name)
                .limit(1).get();
              
              if (!logSnap.empty) {
                await logSnap.docs[0].ref.update({ cleanupStatus: 'purged', purgedAt: now.toISOString() });
              }

              console.log(`ROC_CLEANUP_SUCCESS: Purged expired asset: ${file.name}`);
            } catch (e: any) {
              console.error(`ROC_CLEANUP_ERROR: Failed to delete ${file.name}:`, e.message);
            }
          }
        }
      }
    }

    console.log(`ROC_CLEANUP_COMPLETE: Decommissioned ${purgedCount} expired clinical assets.`);
    return { purgedCount, timestamp: now.toISOString() };
  });
