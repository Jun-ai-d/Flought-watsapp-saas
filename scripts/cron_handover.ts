import { supabaseAdmin } from '../backend/src/lib/supabase';

// This script simulates a pg_cron job. It checks for:
// 1. Unclaimed handover_pending conversations older than 30 minutes -> Escalation logic
// 2. handover_active conversations with no messages in the last 24 hours -> Auto-resolve

async function runCronJobs() {
  console.log('🔄 Running Handover Cron Jobs...');
  
  const now = new Date();
  
  // 1. Auto-escalate unclaimed handovers (older than 30 mins)
  const thirtyMinsAgo = new Date(now.getTime() - 30 * 60000).toISOString();
  
  const { data: pendingToEscalate, error: err1 } = await supabaseAdmin
    .from('conversations')
    .select('id, tenant_id, customer_phone')
    .eq('status', 'handover_pending')
    .lt('last_message_at', thirtyMinsAgo);
    
  if (err1) {
    console.error('Error fetching pending to escalate:', err1);
  } else if (pendingToEscalate && pendingToEscalate.length > 0) {
    console.log(`⚠️ Found ${pendingToEscalate.length} conversations to escalate!`);
    for (const conv of pendingToEscalate) {
      // Escalation Logic (Send webhook/notification to admin)
      // For MVP, we just log it. A production system might email the admin or send them a WA message.
      console.log(`[ESCALATION] Conversation ${conv.id} for tenant ${conv.tenant_id} is unhandled!`);
      // We could update a flag here like "escalated: true" if we added one to the schema.
    }
  }

  // 2. Auto-resolve inactive handovers (older than 24 hours)
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60000).toISOString();
  
  const { data: activeToResolve, error: err2 } = await supabaseAdmin
    .from('conversations')
    .update({ status: 'resolved' })
    .eq('status', 'handover_active')
    .lt('last_message_at', twentyFourHoursAgo)
    .select('id');

  if (err2) {
    console.error('Error auto-resolving conversations:', err2);
  } else if (activeToResolve && activeToResolve.length > 0) {
    console.log(`✅ Auto-resolved ${activeToResolve.length} stale active conversations.`);
  }
  
  console.log('✅ Cron Jobs Completed.');
}

runCronJobs();
