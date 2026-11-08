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
exports.cleanupExpiredRosterPdfs = exports.whatsappStatusWebhook = exports.processWeeklyRosterJobs = exports.startWeeklyRosterCampaign = exports.dailyTwoDayShiftReminder = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const date_fns_1 = require("date-fns");
const jspdf_1 = require("jspdf");
admin.initializeApp();
const WHATSAPP_ACCESS_TOKEN = (0, params_1.defineSecret)('WHATSAPP_ACCESS_TOKEN');
const WHATSAPP_PHONE_NUMBER_ID = (0, params_1.defineSecret)('WHATSAPP_PHONE_NUMBER_ID');
const WHATSAPP_WEBHOOK_VERIFY_TOKEN = (0, params_1.defineSecret)('WHATSAPP_WEBHOOK_VERIFY_TOKEN');
const IST_TZ = 'Asia/Kolkata';
exports.dailyTwoDayShiftReminder = (0, scheduler_1.onSchedule)({
    schedule: '0 10 * * *',
    timeZone: IST_TZ,
    memory: '512MiB',
    secrets: [WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID],
}, async (event) => {
    const db = admin.firestore();
    const configSnap = await db.collection('system_settings').doc('whatsapp_config').get();
    const config = configSnap.data() || {};
    if (!config.masterEnabled || !config.dailyReminderEnabled || !config.whatsappEnabled) {
        console.log('DAILY_PULSE_SKIP: Automation switches are OFF.');
        return;
    }
    const tomorrow = (0, date_fns_1.addDays)(new Date(), 1);
    const dayAfter = (0, date_fns_1.addDays)(new Date(), 2);
    const dates = [tomorrow, dayAfter];
    const dateStrings = dates.map(d => (0, date_fns_1.format)(d, 'yyyy-MM-dd'));
    const empSnap = await db.collection('employees').where('status', '==', 'Active').get();
    const shiftsSnap = await db.collection('shift_master').get();
    const shiftsMap = new Map();
    shiftsSnap.docs.forEach(d => shiftsMap.set(d.id, d.data()));
    for (const empDoc of empSnap.docs) {
        const emp = empDoc.data();
        if (!emp.whatsappNumber || emp.whatsappOptIn === false)
            continue;
        const templateVars = [];
        let missingRoster = false;
        for (const dStr of dateStrings) {
            const weekId = formatWeekId(new Date(dStr));
            const rosterId = `active_${weekId}_${emp.office}`;
            const rosterSnap = await db.collection('published_rosters').doc(rosterId).get();
            const assignments = rosterSnap.exists ? rosterSnap.data()?.assignments || [] : [];
            const assign = assignments.find((a) => a.employeeId === empDoc.id && a.date === dStr);
            if (!rosterSnap.exists || !assign) {
                missingRoster = true;
                break;
            }
            const s = shiftsMap.get(assign.shiftId);
            const isOff = assign.shiftId === 'none';
            templateVars.push(`${(0, date_fns_1.format)(new Date(dStr), 'EEEE, dd MMMM')}`);
            templateVars.push(isOff ? 'Week Off' : (s?.name || 'Duty'));
            templateVars.push(isOff ? 'Enjoy your day off!' : `${s?.startTime} - ${s?.endTime}`);
        }
        if (missingRoster)
            continue;
        const jobKey = `daily_${empDoc.id}_${dateStrings[0]}_${dateStrings[1]}`;
        await sendWhatsApp(emp.whatsappNumber, 'roc_daily_two_day_shift_reminder', [emp.fullName, ...templateVars], jobKey, emp.office, empDoc.id, 'daily_shift_reminder');
    }
});
exports.startWeeklyRosterCampaign = (0, https_1.onCall)({
    memory: '256MiB',
}, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Pulse missing.');
    const { officeId, weekId } = request.data;
    const db = admin.firestore();
    const userSnap = await db.collection('users').doc(request.auth.uid).get();
    const profile = userSnap.data();
    if (!profile || profile.status !== 'Active')
        throw new https_1.HttpsError('permission-denied', 'Account suspended.');
    const campaignId = `camp_${officeId}_${weekId}_${Date.now()}`;
    const empSnap = await db.collection('employees').where('office', '==', officeId).where('status', '==', 'Active').get();
    await db.collection('weekly_roster_campaigns').doc(campaignId).set({
        id: campaignId,
        officeId,
        weekId,
        status: 'processing',
        stats: { total: empSnap.size, pending: empSnap.size, success: 0, failed: 0 },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        actorId: request.auth.uid
    });
    const batch = db.batch();
    empSnap.docs.forEach(doc => {
        const jobRef = db.collection('whatsapp_jobs').doc();
        batch.set(jobRef, {
            campaignId,
            employeeId: doc.id,
            officeId,
            weekId,
            status: 'pending',
            type: 'weekly_pdf',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });
    await batch.commit();
    return { success: true, campaignId };
});
exports.processWeeklyRosterJobs = (0, firestore_1.onDocumentCreated)({
    document: 'whatsapp_jobs/{jobId}',
    secrets: [WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID],
    memory: '1GiB',
}, async (event) => {
    const job = event.data?.data();
    if (!job || job.status !== 'pending')
        return;
    const db = admin.firestore();
    const jobRef = event.data?.ref;
    await jobRef?.update({ status: 'processing', startedAt: admin.firestore.FieldValue.serverTimestamp() });
    try {
        const configSnap = await db.collection('system_settings').doc('whatsapp_config').get();
        const config = configSnap.data() || {};
        if (!config.masterEnabled)
            throw new Error("AUTOMATION_DISABLED");
        const [empSnap, shiftsSnap, rosterSnap] = await Promise.all([
            db.collection('employees').doc(job.employeeId).get(),
            db.collection('shift_master').get(),
            db.collection('published_rosters').doc(`active_${job.weekId}_${job.officeId}`).get()
        ]);
        const emp = empSnap.data();
        if (!emp || !rosterSnap.exists)
            throw new Error("Roster or Professional missing.");
        const shiftsMap = new Map();
        shiftsSnap.docs.forEach(d => shiftsMap.set(d.id, d.data()));
        const startStr = job.weekId.split('-')[0];
        const start = new Date(startStr.slice(0, 4) + '-' + startStr.slice(4, 6) + '-' + startStr.slice(6, 8));
        const weekDates = Array.from({ length: 7 }, (_, i) => (0, date_fns_1.addDays)(start, i));
        const rosterDays = weekDates.map(date => {
            const dStr = (0, date_fns_1.format)(date, 'yyyy-MM-dd');
            const assignments = rosterSnap.data()?.assignments || [];
            const assign = assignments.find((a) => a.employeeId === job.employeeId && a.date === dStr);
            const s = assign ? shiftsMap.get(assign.shiftId) : null;
            const isOff = !assign || assign.shiftId === 'none';
            return {
                date: (0, date_fns_1.format)(date, 'dd MMM yyyy').toUpperCase(),
                day: (0, date_fns_1.format)(date, 'EEEE'),
                shift: isOff ? 'WEEK OFF' : (s?.name || 'DUTY'),
                time: isOff ? '--:--' : `${s?.startTime} - ${s?.endTime}`,
                shiftId: assign?.shiftId || 'none'
            };
        });
        const pdfBuffer = await generateWeeklyPdf(emp, job.weekId, rosterDays, config.logoBase64);
        const mediaId = await uploadToMeta(pdfBuffer, 'Roster.pdf');
        const jobKey = `weekly_${job.employeeId}_${job.weekId}`;
        const result = await sendWhatsAppDocument(emp.whatsappNumber, mediaId, 'roc_weekly_roster_pdf', [emp.fullName, (0, date_fns_1.format)(weekDates[0], 'dd MMM yyyy'), (0, date_fns_1.format)(weekDates[6], 'dd MMM yyyy')], jobKey, job.officeId, job.employeeId);
        await jobRef?.update({ status: 'success', messageId: result.id, completedAt: admin.firestore.FieldValue.serverTimestamp() });
        await db.collection('weekly_roster_campaigns').doc(job.campaignId).update({
            'stats.pending': admin.firestore.FieldValue.increment(-1),
            'stats.success': admin.firestore.FieldValue.increment(1)
        });
    }
    catch (e) {
        await jobRef?.update({ status: 'failed', error: e.message });
        await db.collection('weekly_roster_campaigns').doc(job.campaignId).update({
            'stats.pending': admin.firestore.FieldValue.increment(-1),
            'stats.failed': admin.firestore.FieldValue.increment(1)
        });
    }
});
exports.whatsappStatusWebhook = (0, https_1.onRequest)({
    secrets: [WHATSAPP_WEBHOOK_VERIFY_TOKEN],
}, async (req, res) => {
    if (req.method === 'GET') {
        const verifyToken = WHATSAPP_WEBHOOK_VERIFY_TOKEN.value();
        if (req.query['hub.verify_token'] === verifyToken) {
            res.status(200).send(req.query['hub.challenge']);
            return;
        }
        res.status(403).send('Forbidden');
        return;
    }
    const db = admin.firestore();
    const statuses = req.body?.entry?.[0]?.changes?.[0]?.value?.statuses;
    if (statuses) {
        for (const s of statuses) {
            const q = await db.collection('whatsapp_logs').where('messageId', '==', s.id).limit(1).get();
            if (!q.empty) {
                await q.docs[0].ref.update({ deliveryStatus: s.status, statusTimestamp: new Date(parseInt(s.timestamp) * 1000).toISOString() });
            }
        }
    }
    res.sendStatus(200);
});
exports.cleanupExpiredRosterPdfs = (0, scheduler_1.onSchedule)('every hour', async (event) => {
    const bucket = admin.storage().bucket();
    const [files] = await bucket.getFiles({ prefix: 'weekly-roster-pdfs/' });
    const now = new Date();
    for (const file of files) {
        const [metadata] = await file.getMetadata();
        if (!metadata || !metadata.timeCreated)
            continue;
        const created = new Date(metadata.timeCreated);
        if ((now.getTime() - created.getTime()) / (1000 * 60 * 60) > 48)
            await file.delete();
    }
});
async function sendWhatsApp(to, template, vars, jobKey, office, employeeId, type) {
    const url = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID.value()}/messages`;
    let formattedTo = to.replace(/\D/g, '');
    if (formattedTo.length === 10)
        formattedTo = `91${formattedTo}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN.value()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messaging_product: "whatsapp",
            to: formattedTo,
            type: "template",
            template: { name: template, language: { code: "en" }, components: [{ type: "body", parameters: vars.map(v => ({ type: "text", text: String(v) })) }] }
        })
    });
    const data = await res.json();
    await admin.firestore().collection('whatsapp_logs').add({
        jobKey, to: formattedTo, template, office, employeeId, notificationType: type,
        messageId: data.messages?.[0]?.id || null, status: res.ok ? 'success' : 'failed', timestamp: new Date().toISOString()
    });
}
async function uploadToMeta(buffer, name) {
    const url = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID.value()}/media`;
    const fd = new FormData();
    fd.append('file', new Blob([new Uint8Array(buffer)]), name);
    fd.append('type', 'application/pdf');
    fd.append('messaging_product', 'whatsapp');
    const res = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${ACCESS_TOKEN.value()}` }, body: fd });
    const data = await res.json();
    if (!res.ok)
        throw new Error(data.error?.message || 'Meta Upload Failed');
    return data.id;
}
async function sendWhatsAppDocument(to, mediaId, template, vars, jobKey, office, employeeId) {
    const url = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID.value()}/messages`;
    let formattedTo = to.replace(/\D/g, '');
    if (formattedTo.length === 10)
        formattedTo = `91${formattedTo}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN.value()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messaging_product: "whatsapp",
            to: formattedTo,
            type: "template",
            template: {
                name: template,
                language: { code: "en" },
                components: [
                    { type: "header", parameters: [{ type: "document", document: { id: mediaId, filename: "Weekly_Roster.pdf" } }] },
                    { type: "body", parameters: vars.map(v => ({ type: "text", text: String(v) })) }
                ]
            }
        })
    });
    const data = await res.json();
    await admin.firestore().collection('whatsapp_logs').add({
        jobKey, to: formattedTo, template, office, employeeId, notificationType: 'weekly_pdf',
        messageId: data.messages?.[0]?.id || null, status: res.ok ? 'success' : 'failed', timestamp: new Date().toISOString()
    });
    return { id: data.messages?.[0]?.id };
}
async function generateWeeklyPdf(emp, weekId, rosterDays, logoBase64) {
    const doc = new jspdf_1.jsPDF();
    doc.setFontSize(20);
    doc.setTextColor('#102A43');
    doc.text('TEAM REMOTE OPTOMETRY', 20, 20);
    doc.setFontSize(10);
    doc.text('WEEKLY WORKFORCE SCHEDULE', 20, 26);
    doc.setFontSize(14);
    doc.text(`HELLO, ${emp.fullName.toUpperCase()}`, 20, 45);
    doc.setFontSize(9);
    doc.text(`ID: ${emp.id} | CYCLE: ${weekId}`, 20, 52);
    let y = 70;
    rosterDays.forEach(d => {
        doc.setFontSize(10);
        doc.text(`${d.day.toUpperCase()} (${d.date})`, 25, y);
        doc.text(`${d.shift} [${d.time}]`, 120, y);
        y += 10;
    });
    return Buffer.from(doc.output('arraybuffer'));
}
function formatWeekId(date) {
    const monday = (0, date_fns_1.startOfISOWeek)(date);
    const sunday = (0, date_fns_1.addDays)(monday, 6);
    return `${(0, date_fns_1.format)(monday, 'yyyyMMdd')}-${(0, date_fns_1.format)(sunday, 'yyyyMMdd')}`;
}
//# sourceMappingURL=index.js.map