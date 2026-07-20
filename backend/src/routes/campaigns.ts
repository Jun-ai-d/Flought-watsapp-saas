import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { requireTenantMember } from '../middleware/requireTenantMember';
import { getBSPProvider } from '../bsp/providerFactory';
import { decryptToken } from '../bsp/crypto';
import { boss } from '../services/jobQueue';

const router = Router();

// Create a new drip campaign
router.post('/:tenantId', requireTenantMember, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const { name, steps } = req.body; // steps: { templateId, delayHours, stepOrder }[]

  if (!name || !Array.isArray(steps) || steps.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const { data: campaign, error: campError } = await supabaseAdmin
      .from('drip_campaigns')
      .insert({ tenant_id: tenantId, name } as any)
      .select()
      .single();

    if (campError) throw campError;

    const stepsToInsert = steps.map(step => ({
      campaign_id: campaign.id,
      template_id: step.templateId,
      delay_hours: step.delayHours,
      step_order: step.stepOrder
    }));

    const { error: stepsError } = await (supabaseAdmin.from('drip_steps') as any)
      .insert(stepsToInsert);

    if (stepsError) throw stepsError;

    res.json(campaign);
  } catch (error: any) {
    console.error('Error creating drip campaign:', { error, trace_id: req.traceId });
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// Get campaigns
router.get('/:tenantId', requireTenantMember, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  try {
    const { data, error } = await supabaseAdmin
      .from('drip_campaigns')
      .select('*, drip_steps(*)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching campaigns:', { error, trace_id: req.traceId });
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// Enroll contacts into a campaign
router.post('/:tenantId/:campaignId/enroll', requireTenantMember, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const { campaignId } = req.params;
  const { contacts } = req.body;

  if (!Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ error: 'Missing contacts array' });
  }

  try {
    // 1. Fetch Campaign and Steps
    const { data: campaign, error: campError } = await supabaseAdmin
      .from('drip_campaigns')
      .select('*, drip_steps(*, message_templates(*))')
      .eq('id', campaignId)
      .eq('tenant_id', tenantId)
      .single();

    if (campError || !campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // 2. Fetch BSP Config
    const { data: bspConfig, error: bspError } = await supabaseAdmin
      .from('tenant_bsp_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (bspError || !bspConfig || !bspConfig.bsp_provider) {
      return res.status(400).json({ error: 'BSP Configuration not found.' });
    }

    const decryptedConfig = { ...bspConfig };
    if (decryptedConfig.access_token_encrypted) {
      decryptedConfig.access_token_encrypted = decryptToken(decryptedConfig.access_token_encrypted);
    }

    const jobs: any[] = [];
    const enrollments: any[] = [];

    // Filter valid contacts
    const validContacts = contacts.filter(c => c.phone);

    for (const contact of validContacts) {
      enrollments.push({
        campaign_id: campaignId,
        contact_phone: String(contact.phone)
      });

      for (const step of campaign.drip_steps) {
        const template = step.message_templates;
        if (!template) continue;

        jobs.push({
          name: 'send-template-message',
          data: {
            tenantId,
            contactPhone: String(contact.phone),
            templateId: template.id,
            bspTemplateId: template.bsp_template_id || template.id,
            category: template.category,
            templateName: template.name,
            bspProvider: bspConfig.bsp_provider,
            traceId: req.traceId
          },
          options: {
            retryLimit: 3,
            retryDelay: 10,
            startAfter: step.delay_hours * 60 * 60 // seconds
          }
        });
      }
    }

    if (enrollments.length > 0) {
      await (supabaseAdmin.from('drip_enrollments') as any).insert(enrollments);
    }

    if (jobs.length > 0) {
      for (const job of jobs) {
        await boss.insert(job.name, job.data, job.options);
      }
    }

    res.status(202).json({ status: 'queued', enrolledCount: enrollments.length, scheduledJobs: jobs.length });
  } catch (error: any) {
    console.error('Enrollment error:', { error, trace_id: req.traceId });
    res.status(500).json({ error: 'Failed to enroll contacts' });
  }
});

// Get enrollments for a campaign
router.get('/:tenantId/:campaignId/enrollments', requireTenantMember, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const { campaignId } = req.params;

  try {
    const { data, error } = await supabaseAdmin
      .from('drip_enrollments')
      .select('*')
      .eq('campaign_id', campaignId);
      
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching enrollments:', { error, trace_id: req.traceId });
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

export default router;
