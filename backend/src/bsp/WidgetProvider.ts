import { BSPProvider, NormalizedInboundMessage, OutboundMessagePayload } from './BSPProvider';

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

  async sendSessionMessage(payload: OutboundMessagePayload): Promise<{ success: boolean; bspMessageId: string }> {
    // Simulate a successful send
    return {
      success: true,
      bspMessageId: `widget_reply_${Date.now()}`
    };
  }

  async sendTemplateMessage(payload: any): Promise<{ success: boolean; bspMessageId: string }> {
    return {
      success: true,
      bspMessageId: `widget_template_${Date.now()}`
    };
  }

  async getAccountStatus(tenantId: string): Promise<{ status: string; quality_rating?: string }> {
    return { status: 'active', quality_rating: 'GREEN' };
  }
}
