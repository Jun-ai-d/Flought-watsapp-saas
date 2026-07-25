import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { requireTenantMember, TenantRequest } from '../middleware/requireTenantMember';

const router = Router();

async function assertConversationInTenant(conversationId: string, tenantId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  return !error && !!data;
}

router.get('/:conversationId', requireTenantMember, async (req: TenantRequest, res) => {
  const conversationId = String(req.params.conversationId);
  const tenantId = req.tenantId || (req.query.tenantId as string);

  if (!tenantId) {
    return res.status(400).json({ error: 'Missing tenantId' });
  }

  try {
    const belongs = await assertConversationInTenant(conversationId, tenantId);
    if (!belongs) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const { data, error } = await supabaseAdmin
      .from('conversation_notes')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.status(200).json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch notes';
    res.status(500).json({ error: message });
  }
});

router.post('/', requireTenantMember, async (req: TenantRequest, res) => {
  const tenantId = req.tenantId || req.body?.tenantId;
  const { conversationId, authorId, content } = req.body;

  if (!tenantId || !conversationId || !content) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const belongs = await assertConversationInTenant(conversationId, tenantId);
    if (!belongs) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const { data, error } = await supabaseAdmin
      .from('conversation_notes')
      .insert({
        tenant_id: tenantId,
        conversation_id: conversationId,
        author_id: authorId || req.user?.id,
        content,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create note';
    res.status(500).json({ error: message });
  }
});

export default router;
