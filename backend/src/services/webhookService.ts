import { supabaseAdmin } from '../lib/supabase';

export async function fireOutboundWebhook(tenantId: string, eventData: any) {
  try {
    // Check if the tenant has a webhook configured
    const { data: config } = await supabaseAdmin
      .from('developer_settings')
      .select('webhook_url, api_key')
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

    const payloadString = JSON.stringify(eventData);
    let signature = '';
    if (config.api_key) {
      const crypto = require('crypto');
      signature = 'sha256=' + crypto.createHmac('sha256', config.api_key).update(payloadString).digest('hex');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'FloughtHQ-Webhook/1.0',
      'X-Tenant-ID': tenantId
    };
    
    if (signature) {
      headers['X-Hub-Signature-256'] = signature;
    }

    // Fire the webhook asynchronously
    fetch(config.webhook_url, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: AbortSignal.timeout(5000)
    }).then(res => {
      console.log(`Outbound webhook fired to ${config.webhook_url}. Status: ${res.status}`);
    }).catch(err => {
      console.error(`Failed to fire outbound webhook to ${config.webhook_url}:`, { error: err });
    });
    
  } catch (error) {
    console.error('Error checking outbound webhook configuration:', { error, tenantId });
  }
}
