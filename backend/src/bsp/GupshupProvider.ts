import { BSPProvider, NormalizedInboundMessage, SendResult, SessionMessageContent, TemplateStatus } from './BSPProvider';
import crypto from 'crypto';

export class GupshupProvider implements BSPProvider {
  
  async sendSessionMessage(params: {
    tenantId: string;
    to: string;
    content: SessionMessageContent;
    providerConfig: Record<string, any>;
  }): Promise<SendResult> {
    const { to, content, providerConfig } = params;
    
    // In a real implementation, we would make a fetch() call to Gupshup's API:
    // https://api.gupshup.io/wa/api/v1/msg
    
    console.log(`[Gupshup] Sending session message to ${to}`);
    
    return {
      bspMessageId: `gs-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      status: 'submitted'
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
    console.log(`[Gupshup] Sending template message to ${params.to}`);
    
    return {
      bspMessageId: `gs-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      status: 'submitted'
    };
  }

  parseInboundWebhook(rawPayload: any): NormalizedInboundMessage[] {
    const messages: NormalizedInboundMessage[] = [];
    
    // Gupshup webhook format usually wraps events in an array or a specific top-level object.
    // Example: { app: 'appName', timestamp: 1234, type: 'message', payload: { ... } }
    
    // Let's assume a simplified structure for the webhook payload
    if (rawPayload && rawPayload.type === 'message') {
      const p = rawPayload.payload;
      
      let msgType: 'text' | 'image' | 'document' | 'audio' | 'video' | 'interactive' = 'text';
      if (p.type === 'image' || p.type === 'audio' || p.type === 'document' || p.type === 'video') {
        msgType = p.type;
      }
      
      messages.push({
        waMessageId: p.id || `wa-${Date.now()}`,
        fromPhone: p.source || p.sender?.phone,
        toPhoneNumberId: p.destination || rawPayload.app,
        type: msgType,
        text: p.payload?.text,
        mediaUrl: p.payload?.url,
        timestamp: new Date(rawPayload.timestamp || Date.now()).toISOString(),
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

  async listTemplates(providerConfig: Record<string, any>): Promise<TemplateStatus[]> {
    return [
      { id: '1', name: 'welcome_template', status: 'approved', category: 'utility' }
    ];
  }

  async getAccountHealth(providerConfig: Record<string, any>): Promise<{ tier: number; qualityRating: 'green' | 'yellow' | 'red' }> {
    return { tier: 1, qualityRating: 'green' };
  }
}
