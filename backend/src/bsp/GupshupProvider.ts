import { BSPProvider, NormalizedInboundMessage, SendResult, SessionMessageContent, TemplateStatus, ProviderConfig, TemplateButton } from './BSPProvider';
import crypto from 'crypto';

export class GupshupProvider implements BSPProvider {
  
  async sendSessionMessage(params: {
    tenantId: string;
    to: string;
    content: SessionMessageContent;
    providerConfig: ProviderConfig;
  }): Promise<SendResult> {
    const { tenantId, to, content, providerConfig } = params;
    
    console.log(`[Gupshup] Sending session message to ${to}`);
    const apiKey = providerConfig.gupshup_api_key as string | undefined || process.env.GUPSHUP_API_KEY;
    const appId = providerConfig.gupshup_app_id as string | undefined || process.env.GUPSHUP_APP_ID;

    if (!apiKey || !appId) {
      throw new Error(`[Gupshup] Missing API credentials for tenant ${tenantId}. Message sending failed.`);
    }

    const response = await fetch(`https://api.gupshup.io/wa/api/v1/msg`, {
      method: 'POST',
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/x-www-form-urlencoded',
        'apikey': apiKey
      },
      body: new URLSearchParams({
        channel: 'whatsapp',
        source: appId,
        destination: to,
        'src.name': appId,
        message: JSON.stringify(content)
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gupshup API Error: ${response.status} ${errorText}`);
    }

    const responseData = await response.json() as { messageId?: string };

    return {
      bspMessageId: responseData?.messageId || `gs-${Date.now()}`,
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
    return {
      bspTemplateId: '',
      status: 'rejected' as const
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
    console.error('[Gupshup] sendTemplateMessage is not implemented. Returning failure.');
    return {
      bspMessageId: `gs-unsupported-${Date.now()}`,
      status: 'failed',
      error: 'Template messaging is not supported for Gupshup provider'
    };
  }

  parseInboundWebhook(rawPayload: Record<string, unknown> | unknown): NormalizedInboundMessage[] {
    const messages: NormalizedInboundMessage[] = [];
    
    // Type assertion for nested traversal
    const payload = rawPayload as Record<string, any>;
    
    // Gupshup webhook format usually wraps events in an array or a specific top-level object.
    // Example: { app: 'appName', timestamp: 1234, type: 'message', payload: { ... } }
    
    // Let's assume a simplified structure for the webhook payload
    if (payload && payload.type === 'message') {
      const p = payload.payload;
      
      let msgType: 'text' | 'image' | 'document' | 'audio' | 'video' | 'interactive' | 'order' = 'text';
      if (p.type === 'image' || p.type === 'audio' || p.type === 'document' || p.type === 'video') {
        msgType = p.type;
      }
      
      messages.push({
        waMessageId: p.id || `wa-${Date.now()}`,
        fromPhone: p.source || p.sender?.phone,
        toPhoneNumberId: p.destination || payload.app,
        type: msgType,
        text: p.payload?.text,
        mediaUrl: p.payload?.url,
        timestamp: new Date(payload.timestamp || Date.now()).toISOString(),
        customerName: p.sender?.name || 'Customer'
      });
    }

    return messages;
  }

  verifyWebhookAuth(headers: Record<string, string>, verifyToken: string): boolean {
    // Gupshup doesn't use a standard HMAC signature like Meta in all cases,
    // they often expect you to just check a custom header or token.
    // For this implementation, we will check an authorization header.
    const token = headers['authorization'] || headers['x-gupshup-signature'];
    return token === verifyToken;
  }

  async listTemplates(providerConfig: ProviderConfig): Promise<TemplateStatus[]> {
    return [
      { id: '1', name: 'welcome_template', status: 'approved', category: 'utility' }
    ];
  }

  async getAccountHealth(providerConfig: ProviderConfig): Promise<{ tier: number; qualityRating: 'green' | 'yellow' | 'red' }> {
    return { tier: 1, qualityRating: 'green' };
  }
}
