import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { processAutomationPipeline } from '../services/automation/pipeline';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiting: max 20 messages per IP per 15 minutes
const widgetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/widget/chat
 * C-2 Fix: tenantId is no longer trusted from the request body.
 * The caller must supply a widget_token that maps to a specific tenant.
 * Token is issued per-tenant via /api/tenant/widget-token and stored in widget_tokens table.
 */
router.post('/chat', widgetLimiter, async (req: any, res: any) => {
  const { widget_token, sessionId, text } = req.body;

  if (!widget_token || !sessionId || !text) {
    return res.status(400).json({ error: 'Missing required fields: widget_token, sessionId, text' });
  }

  // Validate sessionId is safe (prevent injection into DB)
  if (typeof sessionId !== 'string' || sessionId.length > 128) {
    return res.status(400).json({ error: 'Invalid sessionId' });
  }

  // Validate text length
  if (typeof text !== 'string' || text.length > 4096) {
    return res.status(400).json({ error: 'Message too long' });
  }

  try {
    // 1. Resolve tenant from widget token — never from user-supplied tenantId
    const { data: tokenRow, error: tokenErr } = await supabaseAdmin
      .from('widget_tokens')
      .select('tenant_id')
      .eq('token', widget_token)
      .eq('is_active', true)
      .single();

    if (tokenErr || !tokenRow) {
      // Return 404 to prevent token oracle attacks (don't distinguish "not found" vs "inactive")
      return res.status(404).json({ error: 'Widget not found' });
    }

    const tenantId = tokenRow.tenant_id;

    // 2. Validate tenant exists and is active
    const { data: tenant, error: tenantErr } = await supabaseAdmin
      .from('tenants')
      .select('plan_type, status, trial_expires_at, trial_conversations_used, trial_conversations_limit')
      .eq('id', tenantId)
      .eq('status', 'active')
      .single();

    if (tenantErr || !tenant) {
      return res.status(404).json({ error: 'Service not available' });
    }

    // 3. Enforce trial limits
    if (tenant.plan_type === 'trial') {
      const isExpired = new Date() > new Date(tenant.trial_expires_at);
      const isLimitReached = tenant.trial_conversations_used >= tenant.trial_conversations_limit;

      if (isExpired || isLimitReached) {
        return res.json({
          success: false,
          reply: 'This business is currently on a trial plan and has reached its testing limit. Please contact them directly.'
        });
      }
    }

    // 4. Find or create conversation
    let isNewSession = false;
    const { data: conv } = await supabaseAdmin
      .from('conversations')
      .select('id, status, last_customer_message_at')
      .eq('tenant_id', tenantId)
      .eq('customer_phone', sessionId)
      .maybeSingle();

    let conversationId: string;
    let currentStatus = 'bot';

    if (!conv) {
      isNewSession = true;
      const { data: newConv, error: newConvErr } = await supabaseAdmin
        .from('conversations')
        .insert({
          tenant_id: tenantId,
          customer_phone: sessionId,
          customer_name: 'Widget User',
          status: 'bot',
          last_customer_message_at: new Date().toISOString(),
          last_message_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (newConvErr || !newConv) {
        console.error('Widget: failed to create conversation', newConvErr);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      conversationId = newConv.id;
    } else {
      conversationId = conv.id;
      currentStatus = conv.status;

      // A gap of >30 min counts as a new session
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

    // 5. Increment trial counter on new sessions
    if (isNewSession && tenant.plan_type === 'trial') {
      await supabaseAdmin.rpc('increment_trial_usage', { p_tenant_id: tenantId });
    }

    // 6. Insert inbound message
    const waMessageId = `widget_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await supabaseAdmin.from('messages').insert({
      conversation_id: conversationId,
      tenant_id: tenantId,
      direction: 'inbound',
      message_type: 'text',
      content: text,
      sender: 'customer',
      wa_message_id: waMessageId
    });

    // 7. Run pipeline if bot is active
    if (currentStatus === 'bot') {
      processAutomationPipeline(tenantId, conversationId, text, sessionId, 'widget', isNewSession)
        .catch(e => console.error('Widget pipeline error:', e?.message));
    }

    return res.json({ success: true, conversationId, message: 'Processing' });

  } catch (error: any) {
    console.error('Widget chat error:', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /api/widget/token-info
 * Returns minimal public info for a widget (business name, logo) from a token.
 * Used by the embed script to display the correct branding.
 */
router.get('/token-info', async (req: any, res: any) => {
  const token = req.query.token as string;
  if (!token) return res.status(400).json({ error: 'Missing token' });

  const { data, error } = await supabaseAdmin
    .from('widget_tokens')
    .select('tenant_id, tenants(business_name)')
    .eq('token', token)
    .eq('is_active', true)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Not found' });

  res.json({ business_name: (data.tenants as any)?.business_name || 'Chat' });
});

export default router;
