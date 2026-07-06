import { supabaseAdmin } from '../lib/supabase';

export async function fireOutboundWebhook(tenantId: string, eventData: any) {
  try {
    // Check if the tenant has a webhook configured
    const { data: config } = await supabaseAdmin
      .from('developer_settings')
      .select('webhook_url')
      .eq('tenant_id', tenantId)
      .single();

    if (!config || !config.webhook_url) {
      return; // No webhook configured, silently exit
    }

    // SSRF Protection: Validate URL
    try {
      const url = new URL(config.webhook_url);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        console.warn(`SSRF Prevention: Blocked non-HTTP webhook URL for tenant ${tenantId}`);
        return;
      }
      
      const hostname = url.hostname.toLowerCase();
      
      // Block common internal/cloud metadata IPs
      const blockedHostnames = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '169.254.169.254', // AWS/GCP/Azure/DO Metadata
        'metadata.google.internal',
        '[::1]',
        '[::]'
      ];
      
      if (blockedHostnames.includes(hostname) || hostname.endsWith('.local') || hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
        console.warn(`SSRF Prevention: Blocked internal webhook URL for tenant ${tenantId}`);
        return;
      }
    } catch (e) {
      console.error(`Invalid webhook URL format for tenant ${tenantId}`);
      return;
    }

    // Fire the webhook asynchronously
    fetch(config.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'FloughtHQ-Webhook/1.0',
        'X-Tenant-ID': tenantId
      },
      body: JSON.stringify(eventData)
    }).then(res => {
      console.log(`Outbound webhook fired to ${config.webhook_url}. Status: ${res.status}`);
    }).catch(err => {
      console.error(`Failed to fire outbound webhook to ${config.webhook_url}:`, { error: err });
    });
    
  } catch (error) {
    console.error('Error checking outbound webhook configuration:', { error, tenantId });
  }
}
