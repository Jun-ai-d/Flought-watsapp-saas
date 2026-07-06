import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';

export interface TenantRequest extends Request {
  user?: any;
  tenantId?: string;
}

export const requireTenantMember = async (req: TenantRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // IDOR Fix: Explicitly resolve tenantId prioritizing params, then query, then body.
  // We MUST attach this specific resolved ID to the request so routes use the exact authorized ID.
  const tenantId = req.params.tenantId || req.query.tenantId || req.body.tenantId;
  
  if (!tenantId) {
    return res.status(400).json({ error: 'Missing tenantId in request' });
  }

  // Check against tenant_users table
  const { data: memberData, error: memberError } = await supabaseAdmin
    .from('tenant_users')
    .select('id')
    .eq('user_id', user.id)
    .eq('tenant_id', tenantId)
    .single();

  if (memberError || !memberData) {
    return res.status(403).json({ error: 'Forbidden: You do not have access to this tenant' });
  }

  req.user = user;
  req.tenantId = tenantId;
  next();
};
