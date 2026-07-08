import { BSPProvider, NormalizedInboundMessage, SendResult, SessionMessageContent, TemplateStatus, ProviderConfig, TemplateButton } from './BSPProvider';

/**
 * A mock provider for the web chat widget used in the Free Trial Tier.
 * Doesn't actually send network requests, just simulates a successful send
 * so the message gets recorded in the database.
 */
export class WidgetProvider implements BSPProvider {
  name = 'widget';

  parseInboundWebhook(payload: Record<string, unknown> | unknown): NormalizedInboundMessage[] {
    // The widget hits its own custom endpoint, so this isn't strictly needed,
    // but implemented to satisfy the interface.
    return [];
  }

  verifyWebhookAuth(headers: Record<string, string>, secret: string): boolean {
    return true; // Not applicable for the dashboard widget
  }

  async sendSessionMessage(params: {
    tenantId: string;
    to: string;
    content: SessionMessageContent;
    providerConfig: ProviderConfig;
  }): Promise<SendResult> {
    // Simulate a successful send
    return {
      status: 'submitted',
      bspMessageId: `widget_reply_${Date.now()}`
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
      bspTemplateId: `widget_template_id_${Date.now()}`,
      status: 'approved'
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
    return {
      status: 'submitted',
      bspMessageId: `widget_template_${Date.now()}`
    };
  }
  
  async listTemplates(providerConfig: ProviderConfig): Promise<TemplateStatus[]> {
    return [];
  }

  async getAccountHealth(providerConfig: ProviderConfig): Promise<{ tier: number; qualityRating: 'green' | 'yellow' | 'red' }> {
    return { tier: 1, qualityRating: 'green' };
  }
}
