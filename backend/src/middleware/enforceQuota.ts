import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { TenantRequest } from './requireTenantMember';

export const enforceQuota = async (req: TenantRequest, res: Response, next: NextFunction) => {
  // Strictly use the tenantId attached by the authentication middleware to prevent Parameter Pollution / IDOR
  const tenantId = req.tenantId;

  if (!tenantId) {
    console.warn('enforceQuota: Missing tenantId in request');
    return res.status(400).json({ error: 'Missing tenant_id' });
  }

  try {
    const { data: hasQuota, error } = await supabaseAdmin.rpc('check_tenant_quota', {
      p_tenant_id: tenantId
    });

    if (error) {
      console.error('Error checking quota:', { error, tenantId });
      return res.status(500).json({ error: 'Failed to verify usage quota' });
    }

    if (hasQuota === false) {
      console.warn(`Tenant ${tenantId} exceeded usage quota.`);
      return res.status(402).json({ 
        error: 'Payment Required: Usage quota exceeded. Please upgrade your subscription.' 
      });
    }

    next();
  } catch (error) {
    console.error('Unexpected error in enforceQuota middleware:', { error, tenantId });
    return res.status(500).json({ error: 'Failed to verify usage quota' });
  }
};
