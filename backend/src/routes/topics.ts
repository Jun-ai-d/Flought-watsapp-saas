import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { requireTenantMember } from '../middleware/requireTenantMember';
import OpenAI from 'openai';


const router = Router();
const openai = new OpenAI();

// Triggered when a conversation is marked as resolved
router.post('/extract', requireTenantMember, async (req, res) => {
  const tenantId = (req as any).tenantId;
  const { conversationId } = req.body;

  if (!conversationId) {
    return res.status(400).json({ error: 'conversationId is required' });
  }

  try {
    // 1. Fetch conversation history
    const { data: messages, error: msgError } = await supabaseAdmin
      .from('messages')
      .select('direction, content')
      .eq('conversation_id', conversationId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })
      .limit(20);

    if (msgError || !messages || messages.length === 0) {
      return res.status(404).json({ error: 'No messages found' });
    }

    const historyText = messages.map(msg => 
      msg.direction === 'inbound' ? `Customer: ${msg.content}` : `Bot/Agent: ${msg.content}`
    ).join('\n');

    // 2. Extract topic via LLM
    const systemPrompt = `You are an AI trained to extract the primary topic or intent from a customer service conversation.
Read the conversation history and output a short, 1-3 word phrase describing the main topic (e.g., "Refund Request", "Technical Support", "Pricing Inquiry", "Login Issue").
Respond ONLY with the topic phrase.`;

    const completion = await openai.chat.completions.create({
      model: process.env.LLM_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `History:\n${historyText}` }
      ],
      temperature: 0.1,
      max_tokens: 15
    });

    let topic = (completion.choices[0]?.message?.content || 'General').trim();
    // Clean up quotes if any
    topic = topic.replace(/^["']|["']$/g, '');

    // 3. Save to database
    const { error: insertError } = await supabaseAdmin
      .from('conversation_topics')
      .insert({
        tenant_id: tenantId,
        conversation_id: conversationId,
        topic: topic
      });

    if (insertError && insertError.code !== '23505') {
      throw insertError;
    }

    // CRM sync worker not yet implemented — removed dead enqueue to prevent
    // unbounded job accumulation in pg-boss queue.
    // TODO: Implement sync-crm worker when CRM integration is built.

    res.json({ success: true, topic });
  } catch (error) {
    console.error('Topic extraction error:', error);
    res.status(500).json({ error: 'Failed to extract topic' });
  }
});

export default router;
