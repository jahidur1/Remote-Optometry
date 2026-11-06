import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { format, addDays } from 'date-fns';

admin.initializeApp();

/**
 * ROC WORKFORCE — AUTOMATED ROSTER BRIEFING (10 PM IST)
 * 
 * Deterministic scheduler that triggers the clinical briefing pulse.
 * Orchestrates: Identity fetching, Roster lookup, and Dispatch initiation.
 */
export const dailyRosterBriefing = functions.region('asia-south1').runWith({
  secrets: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'INTERNAL_TRIGGER_KEY'],
  timeoutSeconds: 300,
  memory: '1GB'
}).pubsub
  .schedule('0 22 * * *')
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
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

    console.log('ROC_PULSE_INIT: Orchestrating daily clinical briefings...');
    
    /**
     * NOTE: We call the internal briefing orchestration logic.
     * We use a fetch pulse to the main application's secure endpoint 
     * to reuse the complex image generation (Satori/Resvg) logic.
     */
    const fetch = require('node-fetch');
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
 * ROC WORKFORCE — STORAGE LIFECYCLE GUARD
 * 
 * Periodically purges roster images older than 48 hours to maintain 
 * institutional registry hygiene and minimize storage overhead.
 */
export const storageCleanupPulse = functions.region('asia-south1').pubsub
  .schedule('0 * * * *') // Runs every hour
  .onRun(async (context) => {
    const bucket = admin.storage().bucket();
    const [files] = await bucket.getFiles({ prefix: 'whatsapp-roster-images/' });
    const now = new Date();
    let purgedCount = 0;

    console.log(`ROC_CLEANUP_INIT: Scanning ${files.length} media assets...`);

    for (const file of files) {
      const [metadata] = await file.getMetadata();
      const expiresAtStr = metadata.metadata?.expiresAt;

      if (expiresAtStr) {
        const expiresAt = new Date(expiresAtStr);
        if (now > expiresAt) {
          try {
            await file.delete();
            purgedCount++;
            console.log(`ROC_CLEANUP_SUCCESS: Purged expired roster image: ${file.name}`);
          } catch (e: any) {
            console.error(`ROC_CLEANUP_ERROR: Failed to delete ${file.name}:`, e.message);
          }
        }
      }
    }

    console.log(`ROC_CLEANUP_COMPLETE: Decommissioned ${purgedCount} expired assets.`);
    return { purgedCount, timestamp: now.toISOString() };
  });
