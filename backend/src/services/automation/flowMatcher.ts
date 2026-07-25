/**
 * Pipeline entry for WhatsApp bot flows (keyword trigger → reply).
 * Visual CRM automation graphs live in flowEngine.ts and are a separate system.
 * Do NOT merge these without an explicit product decision.
 */
import { supabaseAdmin } from '../../lib/supabase';

/**
 * Checks if the incoming message triggers an active Bot Flow.
 * Evaluates the JSONB nodes and edges to find the matched path.
 */
export async function executeFlow(tenantId: string, messageText: string): Promise<{ matched: boolean, replyText?: string }> {
  try {
    const { data: flow } = await supabaseAdmin
      .from('bot_flows')
      .select('nodes, edges')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!flow || !flow.nodes || flow.nodes.length === 0) {
      return { matched: false };
    }

    const textLower = messageText.toLowerCase().trim();
    const nodes: any[] = flow.nodes;
    const edges: any[] = flow.edges || [];

    // 1. Find a trigger node that matches the keyword exactly
    const triggerNode = nodes.find(n => 
      n.type === 'trigger' && 
      n.data?.keyword?.toLowerCase().trim() === textLower
    );

    if (!triggerNode) {
      return { matched: false };
    }

    // 2. Find the edge connecting FROM this trigger
    const connectedEdge = edges.find(e => e.source === triggerNode.id);
    if (!connectedEdge) {
      return { matched: true }; // Matched but no action connected
    }

    // 3. Find the connected Message node
    const messageNode = nodes.find(n => n.id === connectedEdge.target && n.type === 'message');
    if (messageNode && messageNode.data?.text) {
      return { matched: true, replyText: messageNode.data.text };
    }

    return { matched: true };
  } catch (error) {
    console.error('Error executing flow:', error);
    return { matched: false };
  }
}
