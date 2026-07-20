import { supabaseAdmin } from '../lib/supabase';

export interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export async function fireOutboundWebhook(tenantId: string, eventData: WebhookPayload) {
  try {
    const urlsToFire: Array<{url: string, secret: string | null}> = [];

    // 1. Check if the tenant has a primary developer webhook configured
    const { data: config } = await supabaseAdmin
      .from('developer_settings')
      .select('webhook_url, webhook_secret_encrypted')
      .eq('tenant_id', tenantId)
      .single();

    if (config && config.webhook_url) {
      urlsToFire.push({ url: config.webhook_url, secret: config.webhook_secret_encrypted });
    }

    // 2. Check for active Zapier/Make subscriptions for this event
    const { data: subs } = await supabaseAdmin
      .from('webhook_subscriptions')
      .select('url, secret')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .contains('events', [eventData.event]);

    if (subs && subs.length > 0) {
      subs.forEach(sub => urlsToFire.push({ url: sub.url, secret: sub.secret }));
    }

    if (urlsToFire.length === 0) {
      return; // No webhooks configured for this event
    }

    // Deduplicate URLs just in case
    const uniqueUrls = new Map<string, string | null>();
    urlsToFire.forEach(u => uniqueUrls.set(u.url, u.secret));

    const fetchPromises = Array.from(uniqueUrls.entries()).map(async ([webhookUrl, webhookSecret]) => {
      // SSRF Protection: Validate URL
      try {
        const url = new URL(webhookUrl);
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
        
        const isInternalIp = /^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./.test(hostname);
        const isIPv6Private = hostname.startsWith('[fd') || hostname.startsWith('[fc') || hostname === '[::1]' || hostname === '[::]';
        
        if (blockedHostnames.includes(hostname) || hostname.endsWith('.local') || isInternalIp || isIPv6Private) {
          console.warn(`SSRF Prevention: Blocked internal webhook URL for tenant ${tenantId}`);
          return;
        }
      } catch (e) {
        console.error(`Invalid webhook URL format for tenant ${tenantId}`);
        return;
      }

      const payloadString = JSON.stringify(eventData);
      let signature = '';
      
      if (webhookSecret) {
        const { decryptToken } = await import('./../bsp/crypto');
        const crypto = await import('crypto');
        const decryptedSecret = decryptToken(webhookSecret);
        signature = 'sha256=' + crypto.createHmac('sha256', decryptedSecret).update(payloadString).digest('hex');
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
      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers,
          body: payloadString,
          signal: AbortSignal.timeout(5000)
        });
        console.log(`Outbound webhook fired to ${webhookUrl}. Status: ${res.status}`);
      } catch (err) {
        console.error(`Failed to fire outbound webhook to ${webhookUrl}:`, { error: err });
      }
    });

    await Promise.allSettled(fetchPromises);

  } catch (error) {
    console.error('Error checking outbound webhook configuration:', { error, tenantId });
  }
}
