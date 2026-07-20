import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';

const router = Router();

// Endpoint to fetch notes for a conversation
router.get('/:conversationId', async (req: any, res: any) => {
  const { conversationId } = req.params;
  const tenantId = req.query.tenantId;

  try {
    const { data, error } = await supabaseAdmin
      .from('conversation_notes')
      .select('*, author:auth.users(email)')
      .eq('conversation_id', conversationId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.status(200).json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to add a note
router.post('/', async (req: any, res: any) => {
  const { tenantId, conversationId, authorId, content } = req.body;

  try {
    const { data, error } = await supabaseAdmin
      .from('conversation_notes')
      .insert({
        tenant_id: tenantId,
        conversation_id: conversationId,
        author_id: authorId,
        content: content
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
