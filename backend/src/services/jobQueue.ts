import { PgBoss } from 'pg-boss';
import path from 'path';
import dotenv from 'dotenv';

// L-1 Fix: Check if env is already loaded to avoid overriding injected variables in production
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
}

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error('DATABASE_URL is missing in environment variables');
}

export const boss = new PgBoss(dbUrl);

boss.on('error', error => {
  console.error('pg-boss error:', { error });
});

export const initJobQueue = async () => {
  try {
    await boss.start();
    console.log('pg-boss initialized and started successfully');
    
    // Schedule the stale conversation sweeper to run every 10 minutes
    await boss.schedule('auto-resolve-stale', '*/10 * * * *');
    
    boss.work('auto-resolve-stale', async () => {
      console.log('[Cron] Running auto-resolve for stale conversations...');
      const { supabaseAdmin } = require('./../lib/supabase');
      const { generateConversationSummary } = require('./llm/generator');
      const { sendBotReply } = require('./automation/pipeline');
      
      // 1. Run the existing RPC for handover escalations
      const { error: rpcError } = await supabaseAdmin.rpc('auto_resolve_stale_conversations');
      if (rpcError) console.error('[Cron] Error running auto-resolve RPC:', rpcError);

      // 2. Query active 'bot' conversations to expire based on tenant settings
      const { data: activeBotConvs, error: botError } = await supabaseAdmin
        .from('conversations')
        .select(`
          id, 
          tenant_id, 
          customer_phone, 
          last_message_at,
          tenants ( ai_settings )
        `)
        .eq('status', 'bot');

      if (botError || !activeBotConvs) {
        console.error('[Cron] Error fetching bot conversations:', botError);
        return;
      }

      for (const conv of activeBotConvs) {
        const aiSettings = (conv.tenants as any)?.ai_settings || {};
        const timeoutHours = aiSettings.session_timeout_hours || 4;
        
        const lastMessageAt = new Date(conv.last_message_at).getTime();
        const now = new Date().getTime();
        const hoursInactive = (now - lastMessageAt) / (1000 * 60 * 60);

        if (hoursInactive >= timeoutHours) {
          console.log(`[Cron] Expiring conversation ${conv.id} for tenant ${conv.tenant_id} after ${hoursInactive.toFixed(1)} hours.`);

          // A) Send closing message if configured (AND within 24 hours to respect Meta API)
          const closingMsg = aiSettings.session_closing_message;
          if (closingMsg && hoursInactive < 24) {
            // Need provider name to send. We'll fetch it from tenant_bsp_config
            const { data: config } = await supabaseAdmin
              .from('tenant_bsp_config')
              .select('bsp_provider')
              .eq('tenant_id', conv.tenant_id)
              .limit(1)
              .maybeSingle();
            
            if (config?.bsp_provider) {
              try {
                await sendBotReply(conv.tenant_id, conv.id, conv.customer_phone, config.bsp_provider, closingMsg, 'flow');
              } catch (e) {
                console.error(`[Cron] Failed to send closing msg for ${conv.id}:`, e);
              }
            }
          }

          // B) Generate summary for memory
          const { data: history } = await supabaseAdmin
            .from('messages')
            .select('direction, content')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(50); // Fetch up to 50 for good context

          let summary: string | null = null;
          if (history && history.length > 0) {
             const formattedHistory = history.reverse().map((h: any) => ({
               direction: h.direction as 'inbound' | 'outbound',
               content: h.content
             }));
             summary = await generateConversationSummary(formattedHistory);
          }

          // C) Update DB to resolved
          const { data: updatedConv, error: updateError } = await supabaseAdmin
            .from('conversations')
            .update({ 
              status: 'resolved',
              resolved_at: new Date().toISOString()
            })
            .eq('id', conv.id)
            .lt('last_message_at', new Date(now - (timeoutHours * 60 * 60 * 1000 - 60000)).toISOString()) // Race condition mitigation
            .select()
            .single();

          // D) If successfully resolved (no race condition), append summary to contacts
          if (!updateError && updatedConv && summary && conv.customer_phone) {
            const historyEntry = {
              timestamp: new Date().toISOString(),
              summary: summary
            };
            
            const { data: contact } = await supabaseAdmin
              .from('contacts')
              .select('interaction_history')
              .eq('tenant_id', conv.tenant_id)
              .eq('phone_number', conv.customer_phone)
              .single();
              
            if (contact) {
              const newHistory = [...(contact.interaction_history || []), historyEntry];
              const trimmedHistory = newHistory.slice(-10);
              
              await supabaseAdmin
                .from('contacts')
                .update({ interaction_history: trimmedHistory })
                .eq('tenant_id', conv.tenant_id)
                .eq('phone_number', conv.customer_phone);
            }
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Failed to start pg-boss', { error });
    throw error;
  }
};

// --- Webhook Debouncing ---
// Groups rapid-fire messages from the same user into a single prompt for the LLM
const debounceMap = new Map<string, any>();

export function enqueueDebouncedMessage(
  tenantId: string, 
  conversationId: string, 
  messageContent: string, 
  fromPhone: string, 
  providerName: string, 
  isNewSession: boolean,
  wasAudioInbound: boolean = false
) {
  if (debounceMap.has(conversationId)) {
    const existing = debounceMap.get(conversationId);
    console.log(`[Debounce] Concatenating message for conversation ${conversationId}`);
    existing.messageContent += '\n' + messageContent;
    existing.wasAudioInbound = existing.wasAudioInbound || wasAudioInbound;
    clearTimeout(existing.timer);
    existing.timer = setTimeout(() => executeDebouncedMessage(conversationId), 3000);
  } else {
    console.log(`[Debounce] Starting 3-second delay for conversation ${conversationId}`);
    const timer = setTimeout(() => executeDebouncedMessage(conversationId), 3000);
    debounceMap.set(conversationId, {
      tenantId, conversationId, messageContent, fromPhone, providerName, isNewSession, wasAudioInbound, timer
    });
  }
}

async function executeDebouncedMessage(conversationId: string) {
  const data = debounceMap.get(conversationId);
  if (!data) return;
  debounceMap.delete(conversationId);
  
  const { processAutomationPipeline } = require('./automation/pipeline');
  try {
    console.log(`[Debounce] Executing grouped pipeline for conversation ${conversationId}`);
    await processAutomationPipeline(
      data.tenantId, 
      data.conversationId, 
      data.messageContent, 
      data.fromPhone, 
      data.providerName, 
      data.isNewSession,
      data.wasAudioInbound ?? false
    );
  } catch (e) {
    console.error('Error in debounced pipeline:', e);
  }
}

