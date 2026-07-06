import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { requireTenantMember } from '../middleware/requireTenantMember';
import { enforceQuota } from '../middleware/enforceQuota';
import { getBSPProvider } from '../bsp/providerFactory';
import { decryptToken } from '../bsp/crypto';

const router = Router();

// Get all templates for a tenant
router.get('/:tenantId', requireTenantMember, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  try {
    const { data, error } = await supabaseAdmin
      .from('message_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching templates:', { error, trace_id: req.traceId });
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Create a new template and submit to BSP
router.post('/:tenantId', requireTenantMember, enforceQuota, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const { name, category, body, headerType, headerContent, footer, buttons } = req.body;
  
  if (!name || !category || !body) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Fetch BSP Config
    const { data: bspConfig, error: bspError } = await supabaseAdmin
      .from('tenant_bsp_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();
      
    if (bspError || !bspConfig || !bspConfig.bsp_provider) {
      return res.status(400).json({ error: 'BSP Configuration not found. Please setup BSP in Settings first.' });
    }

    const provider = getBSPProvider(bspConfig.bsp_provider);

    const decryptedConfig = { ...bspConfig };
    if (decryptedConfig.access_token_encrypted) {
      decryptedConfig.access_token_encrypted = decryptToken(decryptedConfig.access_token_encrypted);
    }

    // 2. Submit to BSP
    const submissionResult = await provider.submitTemplate({
      tenantId,
      name,
      category,
      body,
      headerType,
      headerContent,
      footer,
      buttons,
      providerConfig: decryptedConfig
    });

    // 3. Save to DB
    const { data: template, error: dbError } = await supabaseAdmin
      .from('message_templates')
      .insert({
        tenant_id: tenantId,
        name,
        category,
        body,
        header_type: headerType || null,
        header_content: headerContent || null,
        footer: footer || null,
        buttons: buttons || [],
        status: submissionResult.status,
        bsp_template_id: submissionResult.bspTemplateId
      })
      .select()
      .single();

    if (dbError) throw dbError;

    res.json(template);
  } catch (error: any) {
    console.error('Error creating template:', { error, trace_id: req.traceId });
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Broadcast a template
router.post('/:tenantId/broadcast', requireTenantMember, enforceQuota, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const { templateId, contacts } = req.body;

  if (!templateId || !Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ error: 'Missing templateId or contacts array' });
  }

  try {
    const { data: template, error: tplError } = await supabaseAdmin
      .from('message_templates')
      .select('*')
      .eq('id', templateId)
      .eq('tenant_id', tenantId)
      .single();

    if (tplError || !template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const { data: bspConfig, error: bspError } = await supabaseAdmin
      .from('tenant_bsp_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (bspError || !bspConfig || !bspConfig.bsp_provider) {
      return res.status(400).json({ error: 'BSP Configuration not found. Please setup BSP in Settings first.' });
    }

    const provider = getBSPProvider(bspConfig.bsp_provider);

    const decryptedConfig = { ...bspConfig };
    if (decryptedConfig.access_token_encrypted) {
      decryptedConfig.access_token_encrypted = decryptToken(decryptedConfig.access_token_encrypted);
    }

    // Import job queue
    const { boss } = require('../services/jobQueue');
    const jobs = contacts.filter((c: any) => c.phone).map((contact: any) => ({
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
        retryDelay: 10 // seconds
      }
    }));

    if (jobs.length > 0) {
      await boss.insert(jobs);
    }

    res.status(202).json({ status: 'queued', jobCount: jobs.length });
  } catch (error: any) {
    console.error('Broadcast error:', { error, trace_id: req.traceId });
    res.status(500).json({ error: 'Failed to queue broadcast' });
  }
});

export default router;
