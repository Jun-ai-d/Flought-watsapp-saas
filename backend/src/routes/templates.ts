import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { requireTenantMember } from '../middleware/requireTenantMember';
import { getBSPProvider } from '../bsp/providerFactory';

const router = Router();

// Get all templates for a tenant
router.get('/:tenantId', requireTenantMember, async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  try {
    const { data, error } = await supabaseAdmin
      .from('message_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Create a new template and submit to BSP
router.post('/:tenantId', requireTenantMember, async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const { name, category, body } = req.body;
  
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

    // 2. Submit to BSP
    const submissionResult = await provider.submitTemplate({
      tenantId,
      name,
      category,
      body,
      providerConfig: bspConfig
    });

    // 3. Save to DB
    const { data: template, error: dbError } = await supabaseAdmin
      .from('message_templates')
      .insert({
        tenant_id: tenantId,
        name,
        category,
        body,
        status: submissionResult.status,
        bsp_template_id: submissionResult.bspTemplateId
      })
      .select()
      .single();

    if (dbError) throw dbError;

    res.json(template);
  } catch (error: any) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: error.message || 'Failed to create template' });
  }
});

export default router;
