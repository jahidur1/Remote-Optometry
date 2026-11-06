"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageCleanupPulse = exports.dailyRosterBriefing = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
exports.dailyRosterBriefing = functions.region('asia-south1').runWith({
    secrets: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'INTERNAL_TRIGGER_KEY'],
    timeoutSeconds: 300,
    memory: '1GB'
}).pubsub
    .schedule('0 22 * * *')
    .timeZone('Asia/Kolkata')
    .onRun(async (context) => {
    const db = admin.firestore();
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
    }
    catch (e) {
        console.error('ROC_PULSE_ERROR:', e.message);
    }
    return { success: true, timestamp: new Date().toISOString() };
});
exports.storageCleanupPulse = functions.region('asia-south1').pubsub
    .schedule('0 * * * *')
    .onRun(async (context) => {
    const bucket = admin.storage().bucket();
    const [files] = await bucket.getFiles({ prefix: 'whatsapp-roster-images/' });
    const now = new Date();
    let purgedCount = 0;
    console.log(`ROC_CLEANUP_INIT: Scanning ${files.length} media assets...`);
    for (const file of files) {
        const [metadata] = await file.getMetadata();
        const expiresAtStr = metadata.metadata?.expiresAt;
        if (expiresAtStr && typeof expiresAtStr === 'string') {
            const expiresAt = new Date(expiresAtStr);
            if (now > expiresAt) {
                try {
                    await file.delete();
                    purgedCount++;
                    console.log(`ROC_CLEANUP_SUCCESS: Purged expired roster image: ${file.name}`);
                }
                catch (e) {
                    console.error(`ROC_CLEANUP_ERROR: Failed to delete ${file.name}:`, e.message);
                }
            }
        }
    }
    console.log(`ROC_CLEANUP_COMPLETE: Decommissioned ${purgedCount} expired assets.`);
    return { purgedCount, timestamp: now.toISOString() };
});
//# sourceMappingURL=index.js.map