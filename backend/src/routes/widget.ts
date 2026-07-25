import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { processAutomationPipeline } from '../services/automation/pipeline';
import rateLimit from 'express-rate-limit';

const router = Router();

const widgetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

async function resolveTenantFromToken(widget_token: string) {
  const { data: tokenRow, error: tokenErr } = await supabaseAdmin
    .from('widget_tokens')
    .select('tenant_id')
    .eq('token', widget_token)
    .eq('is_active', true)
    .single();

  if (tokenErr || !tokenRow) return null;
  return tokenRow.tenant_id as string;
}

async function findConversationId(tenantId: string, sessionId: string): Promise<string | null> {
  const { data: conv } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('customer_phone', sessionId)
    .maybeSingle();

  return conv?.id ?? null;
}

async function fetchLatestBotReply(conversationId: string, afterTimestamp?: string) {
  let query = supabaseAdmin
    .from('messages')
    .select('id, content, message_type, created_at')
    .eq('conversation_id', conversationId)
    .eq('direction', 'outbound')
    .eq('sender', 'bot')
    .order('created_at', { ascending: false })
    .limit(1);

  if (afterTimestamp) {
    query = query.gt('created_at', afterTimestamp);
  }

  const { data } = await query.maybeSingle();
  return data;
}

router.post('/chat', widgetLimiter, async (req: any, res: any) => {
  const { widget_token, sessionId, text } = req.body;

  if (!widget_token || !sessionId || !text) {
    return res.status(400).json({ error: 'Missing required fields: widget_token, sessionId, text' });
  }

  if (typeof sessionId !== 'string' || sessionId.length > 128) {
    return res.status(400).json({ error: 'Invalid sessionId' });
  }

  if (typeof text !== 'string' || text.length > 4096) {
    return res.status(400).json({ error: 'Message too long' });
  }

  try {
    const tenantId = await resolveTenantFromToken(widget_token);
    if (!tenantId) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    const { data: tenant, error: tenantErr } = await supabaseAdmin
      .from('tenants')
      .select('plan_type, status, trial_expires_at, trial_conversations_used, trial_conversations_limit')
      .eq('id', tenantId)
      .eq('status', 'active')
      .single();

    if (tenantErr || !tenant) {
      return res.status(404).json({ error: 'Service not available' });
    }

    if (tenant.plan_type === 'trial') {
      const isExpired = new Date() > new Date(tenant.trial_expires_at);
      const isLimitReached = tenant.trial_conversations_used >= tenant.trial_conversations_limit;

      if (isExpired || isLimitReached) {
        return res.json({
          success: false,
          reply: 'This business is currently on a trial plan and has reached its testing limit. Please contact them directly.',
        });
      }
    }

    let isNewSession = false;
    const { data: conv } = await supabaseAdmin
      .from('conversations')
      .select('id, status, last_customer_message_at')
      .eq('tenant_id', tenantId)
      .eq('customer_phone', sessionId)
      .maybeSingle();

    let conversationId: string;
    let currentStatus = 'bot';
    const inboundAt = new Date().toISOString();

    if (!conv) {
      isNewSession = true;
      const { data: newConv, error: newConvErr } = await supabaseAdmin
        .from('conversations')
        .insert({
          tenant_id: tenantId,
          customer_phone: sessionId,
          customer_name: 'Widget User',
          status: 'bot',
          last_customer_message_at: inboundAt,
          last_message_at: inboundAt,
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

      const lastMsgTime = new Date(conv.last_customer_message_at).getTime();
      if (Date.now() - lastMsgTime > 30 * 60 * 1000) {
        isNewSession = true;
      }

      await supabaseAdmin
        .from('conversations')
        .update({
          last_customer_message_at: inboundAt,
          last_message_at: inboundAt,
        })
        .eq('id', conversationId);
    }

    if (isNewSession && tenant.plan_type === 'trial') {
      await supabaseAdmin.rpc('increment_trial_usage', { p_tenant_id: tenantId });
    }

    const waMessageId = `widget_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await supabaseAdmin.from('messages').insert({
      conversation_id: conversationId,
      tenant_id: tenantId,
      direction: 'inbound',
      message_type: 'text',
      content: text,
      sender: 'customer',
      wa_message_id: waMessageId,
      created_at: inboundAt,
    });

    let reply: string | null = null;
    let replyId: string | null = null;

    if (currentStatus === 'bot') {
      await processAutomationPipeline(tenantId, conversationId, text, sessionId, 'widget', isNewSession);
      const botMessage = await fetchLatestBotReply(conversationId, inboundAt);
      reply = botMessage?.content ?? null;
      replyId = botMessage?.id ?? null;
    }

    return res.json({
      success: true,
      conversationId,
      reply,
      replyId,
      message: reply ? 'Reply ready' : 'Processing',
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Widget chat error:', { error: message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/poll', widgetLimiter, async (req: any, res: any) => {
  const widget_token = req.query.widget_token as string;
  const sessionId = req.query.sessionId as string;
  const after = req.query.after as string | undefined;

  if (!widget_token || !sessionId) {
    return res.status(400).json({ error: 'Missing widget_token or sessionId' });
  }

  try {
    const tenantId = await resolveTenantFromToken(widget_token);
    if (!tenantId) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    const conversationId = await findConversationId(tenantId, sessionId);
    if (!conversationId) {
      return res.json({ reply: null, replyId: null });
    }

    const botMessage = await fetchLatestBotReply(conversationId, after);
    res.json({
      reply: botMessage?.content ?? null,
      replyId: botMessage?.id ?? null,
    });
  } catch (error: unknown) {
    console.error('Widget poll error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

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

  res.json({ business_name: (data.tenants as { business_name?: string } | null)?.business_name || 'Chat' });
});

export default router;
