import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { requireTenantMember } from '../middleware/requireTenantMember';
import { boss } from '../services/jobQueue';

const router = Router();

/**
 * Trigger a broadcast to an audience segment.
 */
router.post('/broadcasts/trigger', requireTenantMember, async (req: any, res: any) => {
  const { name, templateName, audienceFilter, scheduledAt } = req.body;
  const tenantId = req.tenantId;

  if (!name || !templateName) {
    return res.status(400).json({ error: 'name and templateName are required' });
  }

  try {
    // 1. Create Broadcast Record
    const { data: broadcast, error } = await supabaseAdmin
      .from('broadcasts')
      .insert({
        tenant_id: tenantId,
        name,
        template_name: templateName,
        audience_filter: audienceFilter || {},
        scheduled_at: scheduledAt || null,
        status: scheduledAt ? 'scheduled' : 'draft'
      })
      .select('id')
      .single();

    if (error || !broadcast) throw error;

    // 2. Queue for execution
    if (scheduledAt) {
      // Schedule for later
      const delay = new Date(scheduledAt).getTime() - Date.now();
      if (delay > 0) {
        await boss.send('process-broadcast', {
          broadcastId: broadcast.id,
          tenantId,
          templateName,
          audienceFilter
        }, { startAfter: Math.floor(delay / 1000) });
      } else {
        return res.status(400).json({ error: 'scheduledAt must be in the future' });
      }
    } else {
      // Execute immediately
      await boss.send('process-broadcast', {
        broadcastId: broadcast.id,
        tenantId,
        templateName,
        audienceFilter
      });
    }

    res.status(200).json({ success: true, broadcastId: broadcast.id });

  } catch (e: any) {
    console.error('Failed to trigger broadcast:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Upload Contacts from CSV
 * Expected payload: { contacts: [{ phone_number, name, tags, attributes }] }
 * The frontend parses the CSV to JSON and sends it here in chunks.
 */
router.post('/contacts/bulk', requireTenantMember, async (req: any, res: any) => {
  const { contacts } = req.body;
  const tenantId = req.tenantId;

  if (!contacts || !Array.isArray(contacts)) {
    return res.status(400).json({ error: 'contacts array required' });
  }

  try {
    // Add tenant_id to all
    const enriched = contacts.map(c => ({
      ...c,
      tenant_id: tenantId
    }));

    // Perform bulk upsert
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .upsert(enriched, { onConflict: 'tenant_id, phone_number' });

    if (error) throw error;

    res.status(200).json({ success: true, count: contacts.length });
  } catch (e: any) {
    console.error('Failed to bulk upload contacts:', e);
    res.status(500).json({ error: 'Failed to process contacts' });
  }
});

export default router;
