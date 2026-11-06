'use server';

/**
 * @fileOverview Meta WhatsApp Cloud API Service.
 * 
 * Implements the official Media API workflow:
 * 1. Upload binary buffer to Meta Media endpoint.
 * 2. Dispatch Template Message using the returned Media ID.
 * 
 * PROTOCOL: Institutional Roster Briefing (2-Day Window)
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

/**
 * TASK 1: Validates that Meta credentials are available in the current execution context.
 * Secrets must be provisioned via `firebase functions:secrets:set` for backend tasks.
 */
function verifyCredentials() {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    throw new Error('META_AUTH_ERROR: Meta API credentials not detected. Ensure WHATSAPP_ACCESS_TOKEN is set in secrets/env.');
  }
}

/**
 * uploadToMetaMedia
 * Uploads a roster image buffer to Meta's Media API to generate a temporary Media ID.
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
  if (!response.ok) {
    console.error('META_MEDIA_UPLOAD_CONFLICT:', data);
    throw new Error(`Meta Media Upload Failed: ${data.error?.message || 'API_REJECTED'}`);
  }
  
  return data.id;
}

/**
 * sendWhatsAppShiftBriefingWithImage
 * Dispatches a Shift Briefing Template with an image header.
 * Targeting approved template: roc_two_day_roster_notification
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
        name: 'roc_two_day_roster_notification',
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
    
    if (!response.ok) {
        console.error('META_MESSAGE_DISPATCH_CONFLICT:', data);
        return { success: false, error: data.error?.message || 'API_REJECTED' };
    }

    return { 
      success: true, 
      messageId: data.messages?.[0]?.id, 
      mediaId
    };

  } catch (err: any) {
    console.error('WHATSAPP_ORCHESTRATION_FAILURE:', err.message);
    return { success: false, error: err.message };
  }
}
