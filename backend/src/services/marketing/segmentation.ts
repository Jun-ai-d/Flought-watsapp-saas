import { supabaseAdmin } from '../../lib/supabase';

export interface AudienceFilter {
  tags?: string[];
  attributes?: Record<string, string | number | boolean>;
}

/**
 * Fetches the target audience for a broadcast based on dynamic filtering.
 * In a production setting with millions of contacts, this would push
 * the logic strictly to the database. For now, we use a mix of DB filters
 * and JS filtering for flexible JSONB querying.
 */
export async function fetchAudience(tenantId: string, filter?: AudienceFilter) {
  // If only tags are provided, use the fast RPC
  if (filter && filter.tags && filter.tags.length > 0 && (!filter.attributes || Object.keys(filter.attributes).length === 0)) {
    const { data, error } = await supabaseAdmin.rpc('get_broadcast_audience', {
      p_tenant_id: tenantId,
      p_tags: filter.tags
    });
    
    if (error) throw error;
    return data;
  }

  // Fallback to standard query for complex attribute matching
  let query = supabaseAdmin
    .from('contacts')
    .select('id, phone_number, name, attributes')
    .eq('tenant_id', tenantId);

  if (filter?.tags && filter.tags.length > 0) {
    query = query.contains('tags', filter.tags);
  }

  // Execute base query
  const { data, error } = await query;
  if (error) throw error;

  let audience = data || [];

  // Filter by JSONB attributes in memory for edge-case flexibility
  // (In a true massive scale system, we would construct a PostgREST JSONB filter)
  if (filter?.attributes && Object.keys(filter.attributes).length > 0) {
    audience = audience.filter(contact => {
      if (!contact.attributes) return false;
      const attrs = contact.attributes as Record<string, any>;
      
      for (const [key, value] of Object.entries(filter.attributes!)) {
        if (attrs[key] !== value) return false;
      }
      return true;
    });
  }

  return audience;
}
