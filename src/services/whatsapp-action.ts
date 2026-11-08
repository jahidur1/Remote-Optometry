'use server';

/**
 * @fileOverview Meta WhatsApp Cloud API Service — Institutional Protocol v8.0.
 * 
 * Orchestrates template verification, binary media uploads, and multi-stream dispatch.
 * UPDATED: Template status check is now non-blocking to prevent "UNKNOWN" status conflicts.
 */

const PHONE_NUMBER_ID = process.env.WHAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHAPP_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
const WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const API_VERSION = 'v21.0';

export type WhatsAppSendResult = {
  success: boolean;
  messageId?: string;
  mediaId?: string;
  error?: string;
  apiStatus?: number;
};

function verifyCredentials() {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    throw new Error('META_AUTH_ERROR: Meta API credentials not detected in server environment.');
  }
}

/**
 * getTemplateStatus
 * Queries the Meta Graph API to verify the approval state of a specific template.
 */
export async function getTemplateStatus(templateName: string): Promise<'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'UNKNOWN'> {
  if (!WABA_ID || !ACCESS_TOKEN) return 'UNKNOWN';

  try {
    const response = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${WABA_ID}/message_templates?name=${templateName}`,
      {
        headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
      }
    );

    const data = await response.json();
    if (!response.ok || !data.data || data.data.length === 0) return 'UNKNOWN';

    // Find the English (en) version or return first available
    const template = data.data.find((t: any) => t.language === 'en') || data.data[0];
    return template.status;
  } catch (e) {
    console.error('TEMPLATE_STATUS_FETCH_FAILURE:', e);
    return 'UNKNOWN';
  }
}

/**
 * uploadToMetaMedia
 */
async function uploadToMetaMedia(buffer: Buffer, fileName: string, contentType: string = 'application/pdf'): Promise<string> {
  verifyCredentials();
  
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: contentType });
  formData.append('file', blob, fileName);
  formData.append('type', contentType);
  formData.append('messaging_product', 'whatsapp');

  const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/media`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Meta Media Upload Failed: ${data.error?.message || 'API_REJECTED'}`);
  }
  
  return data.id;
}

/**
 * sendWhatsAppGenericTemplate
 * Universal dispatcher for ROC institutional workflows.
 */
export async function sendWhatsAppGenericTemplate(input: {
  to: string;
  templateName: string;
  languageCode?: string;
  headerMedia?: { type: 'document' | 'image'; buffer: Buffer; filename: string };
  bodyVariables: string[];
}): Promise<WhatsAppSendResult> {
  try {
    verifyCredentials();
    const { to, templateName, languageCode = 'en', headerMedia, bodyVariables } = input;

    // 1. NON-BLOCKING Approval Check
    // We log the status but proceed with the dispatch attempt. 
    // The Meta Send API will return an authoritative error if the template isn't usable.
    const status = await getTemplateStatus(templateName);
    if (status !== 'APPROVED') {
       console.warn(`META_STATUS_PULSE: Template ${templateName} is ${status}. Attempting dispatch anyway.`);
    }

    let mediaId: string | undefined;
    if (headerMedia) {
      mediaId = await uploadToMetaMedia(headerMedia.buffer, headerMedia.filename);
    }

    let formattedTo = to.replace(/\D/g, '');
    if (formattedTo.length === 10) formattedTo = `91${formattedTo}`;

    const components: any[] = [];

    // Header Logic
    if (headerMedia && mediaId) {
      components.push({
        type: 'header',
        parameters: [{
          type: headerMedia.type,
          [headerMedia.type]: { id: mediaId, filename: headerMedia.filename }
        }]
      });
    }

    // Body Logic (Mapping body variables {{1}}, {{2}}, etc)
    if (bodyVariables.length > 0) {
      components.push({
        type: 'body',
        parameters: bodyVariables.map(v => ({ type: 'text', text: String(v) }))
      });
    }

    const payload = {
      messaging_product: 'whatsapp',
      to: formattedTo,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components
      }
    };

    const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error?.message || 'API_REJECTED', apiStatus: response.status };
    }

    return { 
      success: true, 
      messageId: data.messages?.[0]?.id, 
      mediaId,
      apiStatus: response.status
    };

  } catch (err: any) {
    console.error('WHATSAPP_DISPATCH_FAILURE:', err.message);
    return { success: false, error: err.message };
  }
}
