
'use server';

/**
 * @fileOverview Meta WhatsApp Cloud API Server Action.
 * 
 * Handles secure communication with Meta's Graph API using institutional credentials.
 * Credentials must be provided via environment variables.
 */

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const API_VERSION = 'v21.0';

export type WhatsAppSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

/**
 * Validates that API credentials are provisioned in the environment.
 */
function verifyCredentials() {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    throw new Error('Meta API Error: WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN not configured in environment.');
  }
}

/**
 * Sends a WhatsApp message via Meta Cloud API using an approved template.
 */
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
    
    // Normalize phone: remove +, ensure country code (default +91)
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

    if (!response.ok) {
      return { 
        success: false, 
        error: data.error?.message || 'Meta API Dispatch Failed' 
      };
    }

    return { 
      success: true, 
      messageId: data.messages?.[0]?.id 
    };
  } catch (err: any) {
    console.error('WhatsApp Action critical failure:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Verification of API connectivity using a simple text message.
 */
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
    return { 
      success: response.ok, 
      messageId: data.messages?.[0]?.id,
      error: data.error?.message 
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
