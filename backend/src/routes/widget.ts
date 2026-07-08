import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { processAutomationPipeline } from '../services/automation/pipeline';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiting: maximum 20 messages per IP every 15 minutes to prevent spam
const widgetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 20, 
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Endpoint for the web chat widget (Trial Testing)
// We don't use requireApiKey here because the widget might be embedded on a public site,
// but for the trial it's in the dashboard, so we expect a tenant_id in the body.
router.post('/chat', widgetLimiter, async (req: any, res: any) => {
  const { tenantId, sessionId, text } = req.body;
  const origin = req.get('origin');

  if (!tenantId || !sessionId || !text) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Validate tenant exists and is active (prevents enumeration attacks)
    const { data: tenant, error: tenantErr } = await supabaseAdmin
      .from('tenants')
      .select('plan_type, status, trial_expires_at, trial_conversations_used, trial_conversations_limit')
      .eq('id', tenantId)
      .eq('status', 'active')  // Only allow active tenants
      .single();

    if (tenantErr || !tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // 2. Enforce limits if on Trial plan
    if (tenant.plan_type === 'trial') {
      const isExpired = new Date() > new Date(tenant.trial_expires_at);
      const isLimitReached = tenant.trial_conversations_used >= tenant.trial_conversations_limit;

      if (isExpired || isLimitReached) {
        return res.json({
          success: false,
          reply: "This business is currently on a trial plan and has reached its testing limit. Please contact them directly, or if you're the business owner, upgrade your plan to keep the AI assistant active."
        });
      }
    }

    // 3. Setup conversation and check if it's a new session to increment counter
    let isNewSession = false;
    const { data: conv, error: convErr } = await supabaseAdmin
      .from('conversations')
      .select('id, status, last_customer_message_at')
      .eq('tenant_id', tenantId)
      .eq('customer_phone', sessionId)
      .maybeSingle();

    let conversationId: string;
    let currentStatus = 'bot';

    if (!conv) {
      isNewSession = true;
      const { data: newConv } = await supabaseAdmin
        .from('conversations')
        .insert({
          tenant_id: tenantId,
          customer_phone: sessionId,
          customer_name: 'Widget User',
          status: 'bot',
          last_customer_message_at: new Date().toISOString(),
          last_message_at: new Date().toISOString()
        })
        .select()
        .single();
      
      conversationId = newConv.id;
    } else {
      conversationId = conv.id;
      currentStatus = conv.status;

      // Define a new session if no activity for 30 minutes
      const lastMsgTime = new Date(conv.last_customer_message_at).getTime();
      if (Date.now() - lastMsgTime > 30 * 60 * 1000) {
        isNewSession = true;
      }

      await supabaseAdmin
        .from('conversations')
        .update({
          last_customer_message_at: new Date().toISOString(),
          last_message_at: new Date().toISOString()
        })
        .eq('id', conversationId);
    }

    // 4. Increment trial limit counter if it's a new session and they are on trial
    if (isNewSession && tenant.plan_type === 'trial') {
      await supabaseAdmin.rpc('increment_trial_usage', { p_tenant_id: tenantId });
    }

    // 5. Insert inbound message
    const waMessageId = `widget_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        tenant_id: tenantId,
        direction: 'inbound',
        message_type: 'text',
        content: text,
        sender: 'customer',
        wa_message_id: waMessageId
      });

    // 6. Process automation pipeline if bot is active
    let aiResponseText = '';
    if (currentStatus === 'bot') {
      try {
        await processAutomationPipeline(tenantId, conversationId, text, sessionId, 'widget');
        aiResponseText = "Message processed successfully. Polling UI will show response.";
      } catch (e: any) {
        console.error('Automation pipeline error in widget', { error: e.message });
      }
    }

    return res.json({ success: true, conversationId, message: "Processing" });

  } catch (error: any) {
    console.error('Widget chat error:', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
