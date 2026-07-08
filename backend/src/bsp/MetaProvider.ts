import { BSPProvider, NormalizedInboundMessage, SendResult, SessionMessageContent, TemplateStatus, ProviderConfig, TemplateButton } from './BSPProvider';
import crypto from 'crypto';

export class MetaProvider implements BSPProvider {
  
  async sendSessionMessage(params: {
    tenantId: string;
    to: string;
    content: SessionMessageContent;
    providerConfig: ProviderConfig;
  }): Promise<SendResult> {
    const { tenantId, to, content, providerConfig } = params;
    
    console.log(`[Meta] Sending session message to ${to}`, { tenantId, to });
    
    // For Meta, we need the Phone Number ID and the Access Token
    const accessToken = providerConfig.access_token_encrypted || process.env.META_ACCESS_TOKEN;
    const phoneNumberId = providerConfig.phone_number_id || process.env.META_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      throw new Error(`[Meta] Missing API credentials for tenant ${tenantId}. Message sending failed.`);
    }

    // Map internal content format to Meta format
    const metaMessage: Record<string, unknown> = {
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

    const responseData = await response.json() as { messages?: Array<{ id: string }> };

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
    headerType?: 'text' | 'image' | 'video' | 'document';
    headerContent?: string;
    footer?: string;
    buttons?: TemplateButton[];
    providerConfig: ProviderConfig;
  }): Promise<{ bspTemplateId: string; status: 'approved' | 'pending' | 'rejected' }> {
    const { tenantId, name, category, body, providerConfig } = params;
    console.log(`[Meta] Submitting template: ${name}`, { tenantId });
    
    const accessToken = providerConfig.access_token_encrypted || process.env.META_ACCESS_TOKEN;
    const wabaId = providerConfig.waba_id;

    if (!accessToken || !wabaId) {
      throw new Error(`[Meta] Missing WABA ID or Access Token for tenant ${tenantId}. Template submission failed.`);
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

    const responseData = await response.json() as { id?: string; status?: string };

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
    providerConfig: ProviderConfig;
  }): Promise<SendResult> {
    const { tenantId, to, templateId, templateParams, providerConfig } = params;
    
    console.log(`[Meta] Sending template message to ${to}`, { tenantId, to, templateId });
    
    const accessToken = providerConfig.access_token_encrypted || process.env.META_ACCESS_TOKEN;
    const phoneNumberId = providerConfig.phone_number_id || process.env.META_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      throw new Error(`[Meta] Missing API credentials for tenant ${tenantId}. Template sending failed.`);
    }

    // Map parameters to Meta's expected format
    // This assumes simple text parameters. For media/buttons, more complex mapping is needed.
    const parameters = templateParams.map(param => ({
      type: 'text',
      text: param
    }));

    const metaMessage: Record<string, unknown> = {
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

    const responseData = await response.json() as { messages?: Array<{ id: string }> };

    return {
      bspMessageId: responseData?.messages?.[0]?.id || `meta-${Date.now()}`,
      status: 'submitted'
    };
  }

  parseInboundWebhook(rawPayload: Record<string, unknown> | unknown): NormalizedInboundMessage[] {
    const messages: NormalizedInboundMessage[] = [];
    
    // Type assertion for nested traversal
    const payload = rawPayload as Record<string, any>;
    
    if (payload.object === 'whatsapp_business_account' && Array.isArray(payload.entry)) {
      for (const entry of payload.entry) {
        if (Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            const value = change.value;
            if (value && Array.isArray(value.messages) && value.messages.length > 0) {
              
              // Map the contacts to get the customer name
              const contactsMap: Record<string, string> = {};
              if (Array.isArray(value.contacts)) {
                for (const contact of value.contacts) {
                  contactsMap[contact.wa_id] = contact.profile?.name || 'Customer';
                }
              }
              
              const toPhoneNumberId = value.metadata?.phone_number_id;

              for (const msg of value.messages) {
                // Ignore unsupported message types for now (like reactions, unsupported, etc.)
                let textContent = '';
                let mediaUrlContent = '';
                const type: string = msg.type;

                if (type === 'text') {
                  textContent = msg.text?.body;
                } else if (['audio', 'image', 'document', 'video'].includes(type)) {
                  // Media messages usually give an ID that we have to fetch the URL for. 
                  mediaUrlContent = msg[type]?.id;
                }

                messages.push({
                  waMessageId: msg.id,
                  fromPhone: msg.from,
                  toPhoneNumberId: toPhoneNumberId || entry.id, // entry.id is WABA ID, but phone_number_id is better
                  type: type as any, // Cast to our subset
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
    }

    return messages;
  }

  verifyWebhookAuth(headers: Record<string, string>, verifyToken: string): boolean {
    // For Meta POST webhooks, signature verification is handled in webhooks.ts
    // using X-Hub-Signature-256 + META_APP_SECRET. This method is only called
    // for Gupshup-style token checks. For Meta, we return true here because
    // the HMAC check happens at the route level.
    // The actual verification lives in webhooks.ts lines 54-67.
    return true;
  }

  async listTemplates(providerConfig: ProviderConfig): Promise<TemplateStatus[]> {
    const accessToken = providerConfig.access_token_encrypted || process.env.META_ACCESS_TOKEN;
    const wabaId = providerConfig.waba_id;

    if (!accessToken || !wabaId) {
      console.warn('[Meta] Missing credentials for listTemplates');
      return [];
    }

    try {
      const response = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/message_templates`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (!response.ok) throw new Error(`Meta API error: ${response.statusText}`);
      const data = (await response.json()) as any;
      return (data.data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        status: t.status.toLowerCase() === 'approved' ? 'approved' :
                t.status.toLowerCase() === 'rejected' ? 'rejected' : 'pending',
        category: t.category.toLowerCase()
      }));
    } catch (e) {
      console.error('[Meta] listTemplates error:', e);
      return [];
    }
  }

  async getAccountHealth(providerConfig: ProviderConfig): Promise<{ tier: number; qualityRating: 'green' | 'yellow' | 'red' }> {
    const accessToken = providerConfig.access_token_encrypted || process.env.META_ACCESS_TOKEN;
    const phoneNumberId = providerConfig.phone_number_id || process.env.META_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      return { tier: 1, qualityRating: 'green' };
    }

    try {
      const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}?fields=quality_rating,tier`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (!response.ok) throw new Error(`Meta API error: ${response.statusText}`);
      const data = (await response.json()) as any;
      const tierMap: any = { 'TIER_1': 1, 'TIER_2': 2, 'TIER_3': 3, 'TIER_4': 4 };
      const ratingMap: any = { 'GREEN': 'green', 'YELLOW': 'yellow', 'RED': 'red' };
      return {
        tier: tierMap[data.tier] || 1,
        qualityRating: ratingMap[data.quality_rating] || 'green'
      };
    } catch (e) {
      console.error('[Meta] getAccountHealth error:', e);
      return { tier: 1, qualityRating: 'green' };
    }
  }
}
