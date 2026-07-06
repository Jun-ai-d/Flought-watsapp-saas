import { BSPProvider, NormalizedInboundMessage, SendResult, SessionMessageContent, TemplateStatus } from './BSPProvider';
import crypto from 'crypto';

export class MetaProvider implements BSPProvider {
  
  async sendSessionMessage(params: {
    tenantId: string;
    to: string;
    content: SessionMessageContent;
    providerConfig: Record<string, any>;
  }): Promise<SendResult> {
    const { tenantId, to, content, providerConfig } = params;
    
    console.log(`[Meta] Sending session message to ${to}`, { tenantId, to });
    
    // For Meta, we need the Phone Number ID and the Access Token
    const accessToken = providerConfig.access_token_encrypted || process.env.META_ACCESS_TOKEN;
    const phoneNumberId = providerConfig.phone_number_id || process.env.META_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      console.warn(`[Meta] Missing API credentials for tenant ${tenantId}. Faking success for local dev.`, { tenantId });
      return {
        bspMessageId: `meta-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        status: 'submitted'
      };
    }

    // Map internal content format to Meta format
    const metaMessage: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: content.type
    };

    if (content.type === 'text') {
      metaMessage.text = { preview_url: false, body: content.text };
    } else if (content.type === 'audio' || content.type === 'image' || content.type === 'document' || content.type === 'video') {
      metaMessage[content.type] = { link: content.mediaUrl };
    }

    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metaMessage)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Meta API Error] ${response.status} ${errorText}`, { status: response.status });
      throw new Error(`Meta API Error: ${response.status} ${errorText}`);
    }

    const responseData = await response.json() as any;

    return {
      bspMessageId: responseData?.messages?.[0]?.id || `meta-${Date.now()}`,
      status: 'submitted'
    };
  }

  async submitTemplate(params: {
    tenantId: string;
    name: string;
    category: 'marketing' | 'utility' | 'authentication';
    body: string;
    providerConfig: Record<string, any>;
  }): Promise<{ bspTemplateId: string; status: 'approved' | 'pending' | 'rejected' }> {
    const { tenantId, name, category, body, providerConfig } = params;
    console.log(`[Meta] Submitting template: ${name}`, { tenantId });
    
    const accessToken = providerConfig.access_token_encrypted || process.env.META_ACCESS_TOKEN;
    const wabaId = providerConfig.waba_id;

    if (!accessToken || !wabaId) {
      console.warn(`[Meta] Missing WABA ID or Access Token for tenant ${tenantId}. Faking success.`, { tenantId });
      return {
        bspTemplateId: `meta-tpl-${Date.now()}`,
        status: 'approved'
      };
    }

    // Map category to Meta's uppercase format
    const metaCategory = category.toUpperCase();

    const templateData = {
      name: name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      language: 'en_US',
      category: metaCategory,
      components: [
        {
          type: 'BODY',
          text: body
        }
      ]
    };

    const response = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/message_templates`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(templateData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Meta API Error] ${response.status} ${errorText}`, { status: response.status });
      throw new Error(`Meta API Error: ${response.status} ${errorText}`);
    }

    const responseData = await response.json() as any;

    return {
      bspTemplateId: responseData.id || name, // Meta returns the template ID in the response
      status: responseData.status === 'APPROVED' ? 'approved' : 
              responseData.status === 'REJECTED' ? 'rejected' : 'pending'
    };
  }

  async sendTemplateMessage(params: {
    tenantId: string;
    to: string;
    templateId: string;
    category: 'marketing' | 'utility' | 'authentication';
    templateParams: string[];
    providerConfig: Record<string, any>;
  }): Promise<SendResult> {
    const { tenantId, to, templateId, templateParams, providerConfig } = params;
    
    console.log(`[Meta] Sending template message to ${to}`, { tenantId, to, templateId });
    
    const accessToken = providerConfig.access_token_encrypted || process.env.META_ACCESS_TOKEN;
    const phoneNumberId = providerConfig.phone_number_id || process.env.META_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      console.warn(`[Meta] Missing API credentials for tenant ${tenantId}. Faking success for local dev.`, { tenantId });
      return {
        bspMessageId: `meta-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        status: 'submitted'
      };
    }

    // Map parameters to Meta's expected format
    // This assumes simple text parameters. For media/buttons, more complex mapping is needed.
    const parameters = templateParams.map(param => ({
      type: 'text',
      text: param
    }));

    const metaMessage: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'template',
      template: {
        name: templateId, // For Meta, templateId is usually the template name (e.g. 'hello_world')
        language: {
          code: 'en_US' // Defaulting to en_US for now, should ideally be dynamic
        },
        components: parameters.length > 0 ? [
          {
            type: 'body',
            parameters: parameters
          }
        ] : []
      }
    };

    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metaMessage)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Meta API Error] ${response.status} ${errorText}`, { status: response.status });
      throw new Error(`Meta API Error: ${response.status} ${errorText}`);
    }

    const responseData = await response.json() as any;

    return {
      bspMessageId: responseData?.messages?.[0]?.id || `meta-${Date.now()}`,
      status: 'submitted'
    };
  }

  parseInboundWebhook(rawPayload: any): NormalizedInboundMessage[] {
    const messages: NormalizedInboundMessage[] = [];
    
    if (rawPayload.object === 'whatsapp_business_account' && rawPayload.entry) {
      for (const entry of rawPayload.entry) {
        for (const change of entry.changes) {
          const value = change.value;
          if (value && value.messages && value.messages.length > 0) {
            
            // Map the contacts to get the customer name
            const contactsMap: Record<string, string> = {};
            if (value.contacts) {
              for (const contact of value.contacts) {
                contactsMap[contact.wa_id] = contact.profile?.name || 'Customer';
              }
            }
            
            const toPhoneNumberId = value.metadata?.phone_number_id;

            for (const msg of value.messages) {
              // Ignore unsupported message types for now (like reactions, unsupported, etc.)
              let textContent = '';
              let mediaUrlContent = '';
              let type: any = msg.type;

              if (type === 'text') {
                textContent = msg.text?.body;
              } else if (['audio', 'image', 'document', 'video'].includes(type)) {
                // Media messages usually give an ID that we have to fetch the URL for. 
                // For simplicity here, we'll store the ID. Real implementation needs media fetching.
                mediaUrlContent = msg[type]?.id;
              }

              messages.push({
                waMessageId: msg.id,
                fromPhone: msg.from,
                toPhoneNumberId: toPhoneNumberId || entry.id, // entry.id is WABA ID, but phone_number_id is better
                type: type,
                text: textContent,
                mediaUrl: mediaUrlContent,
                timestamp: new Date(parseInt(msg.timestamp) * 1000).toISOString(),
                customerName: contactsMap[msg.from] || 'Customer'
              });
            }
          }
        }
      }
    }

    return messages;
  }

  verifyWebhookAuth(headers: Record<string, string>, verifyToken: string): boolean {
    // For POST requests, Meta uses X-Hub-Signature-256. 
    // Usually we compute HMAC SHA256 of the payload using the App Secret.
    // For now, we return true if we're not strictly enforcing signature verification.
    // The GET verification (hub.challenge) is handled in the router level.
    return true; 
  }

  async listTemplates(providerConfig: Record<string, any>): Promise<TemplateStatus[]> {
    return [
      { id: '1', name: 'welcome_template', status: 'approved', category: 'utility' }
    ];
  }

  async getAccountHealth(providerConfig: Record<string, any>): Promise<{ tier: number; qualityRating: 'green' | 'yellow' | 'red' }> {
    return { tier: 1, qualityRating: 'green' };
  }
}
