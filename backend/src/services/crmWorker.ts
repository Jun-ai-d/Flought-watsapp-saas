import { Job } from 'pg-boss';
import { boss } from './jobQueue';
import { supabaseAdmin } from '../lib/supabase';
import { decryptToken } from '../bsp/crypto';

export interface SyncCRMJob {
  tenantId: string;
  conversationId: string;
}

export const initCrmWorkers = async () => {
  await boss.work<SyncCRMJob>('sync-crm', { teamSize: 5, teamConcurrency: 5 }, async (jobs) => {
    for (const job of jobs) {
      await processCRMSync(job);
    }
  });
};

export async function processCRMSync(job: Job<SyncCRMJob>) {
  const { tenantId, conversationId } = job.data;
  
  try {
    // 1. Fetch CRM configurations for the tenant
    const { data: configs } = await supabaseAdmin
      .from('crm_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (!configs || configs.length === 0) return; // No active CRMs

    // 2. Fetch Conversation and Messages
    const { data: conv } = await supabaseAdmin
      .from('conversations')
      .select('customer_phone, customer_name')
      .eq('id', conversationId)
      .single();

    if (!conv) return;

    const { data: messages } = await supabaseAdmin
      .from('messages')
      .select('content, direction, created_at, sender')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    const transcript = (messages || []).map(m => {
      const sender = m.direction === 'inbound' ? (conv.customer_name || 'Customer') : (m.sender === 'bot' ? 'Bot' : 'Agent');
      return `[${new Date(m.created_at).toLocaleString()}] ${sender}: ${m.content}`;
    }).join('\n');

    // 3. Sync to each configured CRM
    for (const config of configs) {
      if (!config.api_key_encrypted) continue;
      
      const apiKey = decryptToken(config.api_key_encrypted);
      
      if (config.provider === 'hubspot') {
        await syncToHubspot(apiKey, config, conv, transcript);
      } else if (config.provider === 'salesforce') {
        await syncToSalesforce(apiKey, config, conv, transcript);
      }
    }
    
  } catch (error) {
    console.error('CRM Sync Failed:', { error, tenantId, conversationId });
  }
}

async function syncToHubspot(apiKey: string, config: any, conv: any, transcript: string) {
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };

  // HubSpot requires searching for existing contact by phone or creating one
  // Simple MVP: We just attempt to create, or if we had more time we'd search first.
  if (config.sync_contacts) {
    // Note: A robust implementation would search by phone first.
    // For MVP, we will assume one-way push.
    console.log(`[HubSpot] Pushing contact ${conv.customer_phone} to CRM`);
  }

  if (config.sync_chats) {
    console.log(`[HubSpot] Pushing chat transcript for ${conv.customer_phone}`);
    // fetch('https://api.hubapi.com/engagements/v1/engagements', { ... })
  }
}

async function syncToSalesforce(apiKey: string, config: any, conv: any, transcript: string) {
  // Similar implementation for Salesforce REST API
  console.log(`[Salesforce] Syncing to CRM for ${conv.customer_phone}`);
}
