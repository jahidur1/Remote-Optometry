'use server';

/**
 * @fileOverview Meta WhatsApp Cloud API Server Action.
 * 
 * Handles secure communication with Meta's Graph API using institutional credentials.
 */

const PHONE_NUMBER_ID = '1143569695505848';
const ACCESS_TOKEN = 'EAASX13nmmYgBRmCXnh6JLT56PQdMrqQTA5CQM9ITn988OHZBv0KltEsJIndy2ZCxBAEfAZAtlCGaEFJWLhl8F7kYMxkAbWrEZAnDIPZCYFwtHCos5Gq6NU7s1yFDZAgW65FTZCJLPICNgKsiM4ZCMzPlh8giYYsO5nnCA60ZBB9Btry6iv2ZAedsVs2xYG0wVBbAZDZD';
const API_VERSION = 'v21.0';

export type WhatsAppSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

/**
 * Sends a WhatsApp message via Meta Cloud API.
 * Uses a template-based approach as required for business-initiated conversations.
 */
export async function sendWhatsAppShiftBriefing(
  to: string,
  employeeName: string,
  shiftName: string,
  shiftTime: string,
  date: string
): Promise<WhatsAppSendResult> {
  const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  
  // Format phone number (remove +, ensure country code)
  const formattedTo = to.replace(/\D/g, '');

  const payload = {
    messaging_product: 'whatsapp',
    to: formattedTo,
    type: 'template',
    template: {
      name: 'shift_briefing', // This template must exist and be approved in your Meta App Dashboard
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

  try {
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
      console.error('Meta API Error:', data);
      return { 
        success: false, 
        error: data.error?.message || 'Failed to dispatch via Meta API' 
      };
    }

    return { 
      success: true, 
      messageId: data.messages?.[0]?.id 
    };
  } catch (err: any) {
    console.error('WhatsApp Action Failure:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Simple text message for testing connectivity.
 */
export async function sendWhatsAppTestMessage(to: string): Promise<WhatsAppSendResult> {
  const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const formattedTo = to.replace(/\D/g, '');

  const payload = {
    messaging_product: 'whatsapp',
    to: formattedTo,
    type: 'text',
    text: { body: 'ROC Workforce: Meta Cloud API Connection Verified. System is ready for shift briefings.' }
  };

  try {
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
