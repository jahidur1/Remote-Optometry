
'use server';

/**
 * @fileOverview Meta WhatsApp Cloud API Service.
 * 
 * Implements the official Media API workflow:
 * 1. Upload binary buffer to Meta Media endpoint.
 * 2. Dispatch Template Message using the returned Media ID.
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
    throw new Error('META_AUTH_ERROR: Meta API credentials not configured in environment secrets.');
  }
}

/**
 * Uploads a roster image buffer to Meta's Media API.
 */
async function uploadToMetaMedia(buffer: Buffer, fileName: string): Promise<string> {
  verifyCredentials();
  
  const formData = new FormData();
  const blob = new Blob([buffer], { type: 'image/png' });
  formData.append('file', blob, fileName);
  formData.append('type', 'image/png');
  formData.append('messaging_product', 'whatsapp');

  const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/media`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
    },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Meta Media Upload Failed: ${data.error?.message || 'Unknown'}`);
  
  return data.id;
}

/**
 * Dispatches a Shift Briefing Template with an image header.
 */
export async function sendWhatsAppShiftBriefingWithImage(
  to: string,
  employeeName: string,
  imageBuffer: Buffer,
  fileName: string
): Promise<WhatsAppSendResult> {
  try {
    // 1. Meta Media Handshake
    const mediaId = await uploadToMetaMedia(imageBuffer, fileName);

    // 2. Template Dispatch
    let formattedTo = to.replace(/\D/g, '');
    if (formattedTo.length === 10) formattedTo = `91${formattedTo}`;

    const payload = {
      messaging_product: 'whatsapp',
      to: formattedTo,
      type: 'template',
      template: {
        name: 'shift_briefing_with_image', // This template must be approved in Meta Business Manager
        language: { code: 'en_US' },
        components: [
          {
            type: 'header',
            parameters: [{ type: 'image', image: { id: mediaId } }]
          },
          {
            type: 'body',
            parameters: [
              { type: 'text', text: employeeName }
            ]
          }
        ]
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
    return { 
      success: response.ok, 
      messageId: data.messages?.[0]?.id, 
      mediaId,
      error: data.error?.message 
    };

  } catch (err: any) {
    console.error('WhatsApp Dispatch Failure:', err.message);
    return { success: false, error: err.message };
  }
}
