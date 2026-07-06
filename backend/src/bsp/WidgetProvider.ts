import { BSPProvider, NormalizedInboundMessage, SendResult, TemplateStatus } from './BSPProvider';

/**
 * A mock provider for the web chat widget used in the Free Trial Tier.
 * Doesn't actually send network requests, just simulates a successful send
 * so the message gets recorded in the database.
 */
export class WidgetProvider implements BSPProvider {
  name = 'widget';

  parseInboundWebhook(payload: any): NormalizedInboundMessage[] {
    // The widget hits its own custom endpoint, so this isn't strictly needed,
    // but implemented to satisfy the interface.
    return [];
  }

  verifyWebhookAuth(headers: Record<string, string>, secret: string): boolean {
    return true; // Not applicable for the dashboard widget
  }

  async sendSessionMessage(payload: any): Promise<SendResult> {
    // Simulate a successful send
    return {
      status: 'submitted',
      bspMessageId: `widget_reply_${Date.now()}`
    };
  }

  async submitTemplate(params: any): Promise<{ bspTemplateId: string; status: 'approved' | 'pending' | 'rejected' }> {
    return {
      bspTemplateId: `widget_template_id_${Date.now()}`,
      status: 'approved'
    };
  }

  async sendTemplateMessage(payload: any): Promise<SendResult> {
    return {
      status: 'submitted',
      bspMessageId: `widget_template_${Date.now()}`
    };
  }
  
  async listTemplates(providerConfig: Record<string, any>): Promise<TemplateStatus[]> {
    return [];
  }

  async getAccountHealth(providerConfig: Record<string, any>): Promise<{ tier: number; qualityRating: 'green' | 'yellow' | 'red' }> {
    return { tier: 1, qualityRating: 'green' };
  }
}
