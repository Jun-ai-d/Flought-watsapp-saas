export interface SessionMessageContent {
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'interactive' | 'catalog';
  text?: string;
  mediaUrl?: string;
  // Extensible for other types
}

export interface SendResult {
  bspMessageId: string;       // provider's own message ID, stored for tracing delivery events
  status: 'submitted' | 'failed';
  error?: string;
}

export interface NormalizedInboundMessage {
  waMessageId: string;        // Meta's own message ID
  fromPhone: string;
  toPhoneNumberId: string;    // used to resolve tenant_id via tenant_bsp_config
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'interactive' | 'order';
  text?: string;
  mediaUrl?: string;
  timestamp: string;
  customerName?: string;
}

export interface TemplateStatus {
  id: string;
  name: string;
  status: 'approved' | 'pending' | 'rejected';
  category: 'marketing' | 'utility' | 'authentication';
}

export interface ProviderConfig {
  access_token_encrypted?: string;
  access_token?: string;
  waba_id?: string;
  phone_number_id?: string;
  verify_token?: string;
  app_id?: string;
  app_secret?: string;
  bsp_provider?: string;
  webhook_url?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface TemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phoneNumber?: string;
}

export interface BSPProvider {
  /**
   * Send a free-form session message (only valid within the 24hr customer service window)
   */
  sendSessionMessage(params: {
    tenantId: string;
    to: string;
    content: SessionMessageContent;
    providerConfig: ProviderConfig; // Decrypted config (e.g. access_token)
  }): Promise<SendResult>;

  /**
   * Submit a new template to the BSP for approval
   */
  submitTemplate(params: {
    tenantId: string;
    name: string;
    category: 'marketing' | 'utility' | 'authentication';
    body: string;
    headerType?: 'text' | 'image' | 'video' | 'document';
    headerContent?: string;
    footer?: string;
    buttons?: TemplateButton[];
    providerConfig: ProviderConfig;
  }): Promise<{ bspTemplateId: string; status: 'approved' | 'pending' | 'rejected' }>;

  /**
   * Send a pre-approved template message
   */
  sendTemplateMessage(params: {
    tenantId: string;
    to: string;
    templateId: string;
    category: 'marketing' | 'utility' | 'authentication';
    templateParams: string[];
    providerConfig: ProviderConfig;
  }): Promise<SendResult>;

  /**
   * Normalize this BSP's webhook payload into Flought's internal message format.
   * Note: This only returns actual inbound customer messages. Status updates (delivered/read) 
   * should be handled separately by the provider or in a different function, but for now we focus on inbound.
   */
  parseInboundWebhook(rawPayload: Record<string, unknown> | unknown): NormalizedInboundMessage[];

  /**
   * Verify a webhook is authentically from this BSP (signature/token check)
   */
  verifyWebhookAuth(headers: Record<string, string>, verifyToken: string): boolean;

  /**
   * Fetch current template list + statuses
   */
  listTemplates(providerConfig: ProviderConfig): Promise<TemplateStatus[]>;

  /**
   * Fetch current messaging tier / quality rating
   */
  getAccountHealth(providerConfig: ProviderConfig): Promise<{ tier: number; qualityRating: 'green' | 'yellow' | 'red' }>;
}
