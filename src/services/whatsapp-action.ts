
'use server';

/**
 * @fileOverview Meta WhatsApp Cloud API Server Action.
 * 
 * Handles secure communication with Meta's Graph API using institutional credentials.
 * Support for Image payloads and templates.
 */

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const API_VERSION = 'v21.0';

export type WhatsAppSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

function verifyCredentials() {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    throw new Error('Meta API Error: Credentials not configured in environment.');
  }
}

export async function sendWhatsAppShiftBriefingWithImage(
  to: string,
  employeeName: string,
  imageUrl: string,
  caption: string
): Promise<WhatsAppSendResult> {
  try {
    verifyCredentials();
    const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;
    
    let formattedTo = to.replace(/\D/g, '');
    if (formattedTo.length === 10) formattedTo = `91${formattedTo}`;

    const payload = {
      messaging_product: 'whatsapp',
      to: formattedTo,
      type: 'image',
      image: {
        link: imageUrl,
        caption: caption
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return { success: response.ok, messageId: data.messages?.[0]?.id, error: data.error?.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function sendWhatsAppShiftBriefing(
  to: string,
  employeeName: string,
  shiftName: string,
  shiftTime: string,
  date: string
): Promise<WhatsAppSendResult> {
  try {
    verifyCredentials();
    const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;
    
    let formattedTo = to.replace(/\D/g, '');
    if (formattedTo.length === 10) formattedTo = `91${formattedTo}`;

    const payload = {
      messaging_product: 'whatsapp',
      to: formattedTo,
      type: 'template',
      template: {
        name: 'shift_briefing',
        language: { code: 'en_US' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: employeeName },
              { type: 'text', text: date },
              { type: 'text', text: shiftName },
              { type: 'text', text: shiftTime }
            ]
          }
        ]
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return { success: response.ok, messageId: data.messages?.[0]?.id, error: data.error?.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function sendWhatsAppTestMessage(to: string): Promise<WhatsAppSendResult> {
  try {
    verifyCredentials();
    const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;
    let formattedTo = to.replace(/\D/g, '');
    if (formattedTo.length === 10) formattedTo = `91${formattedTo}`;

    const payload = {
      messaging_product: 'whatsapp',
      to: formattedTo,
      type: 'text',
      text: { body: 'ROC Workforce: System Connectivity Verified. Meta Cloud API is online.' }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return { success: response.ok, messageId: data.messages?.[0]?.id, error: data.error?.message };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
