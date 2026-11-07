'use server';

/**
 * @fileOverview Meta WhatsApp Cloud API Service — Generic Protocol.
 * 
 * Supports both Document (PDF) and Text-only templates.
 */

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const API_VERSION = 'v21.0';

export type WhatsAppSendResult = {
  success: boolean;
  messageId?: string;
  mediaId?: string;
  error?: string;
};

function verifyCredentials() {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    throw new Error('META_AUTH_ERROR: Meta API credentials not detected. Ensure WHATSAPP_ACCESS_TOKEN is set in secrets/env.');
  }
}

/**
 * uploadToMetaMedia
 */
async function uploadToMetaMedia(buffer: Buffer, fileName: string, contentType: string = 'application/pdf'): Promise<string> {
  verifyCredentials();
  
  const formData = new FormData();
  const blob = new Blob([buffer], { type: contentType });
  formData.append('file', blob, fileName);
  formData.append('type', contentType);
  formData.append('messaging_product', 'whatsapp');

  const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/media`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
    },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('META_MEDIA_UPLOAD_CONFLICT:', data);
    throw new Error(`Meta Media Upload Failed: ${data.error?.message || 'API_REJECTED'}`);
  }
  
  return data.id;
}

/**
 * sendWhatsAppGenericTemplate
 * Universal dispatcher for any approved Meta template.
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

    let mediaId: string | undefined;
    if (headerMedia) {
      mediaId = await uploadToMetaMedia(headerMedia.buffer, headerMedia.filename);
    }

    let formattedTo = to.replace(/\D/g, '');
    if (formattedTo.length === 10) formattedTo = `91${formattedTo}`;

    const components: any[] = [];

    // 1. Header (If Media)
    if (headerMedia && mediaId) {
      components.push({
        type: 'header',
        parameters: [{
          type: headerMedia.type,
          [headerMedia.type]: { id: mediaId, filename: headerMedia.filename }
        }]
      });
    }

    // 2. Body Variables
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
      return { success: false, error: data.error?.message || 'API_REJECTED' };
    }

    return { 
      success: true, 
      messageId: data.messages?.[0]?.id, 
      mediaId 
    };

  } catch (err: any) {
    console.error('WHATSAPP_GENERIC_DISPATCH_FAILURE:', err.message);
    return { success: false, error: err.message };
  }
}
