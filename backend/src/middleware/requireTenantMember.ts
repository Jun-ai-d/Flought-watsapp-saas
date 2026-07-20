import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';

export interface TenantRequest extends Request {
  user?: any;
  tenantId?: string;
  tenantRole?: 'admin' | 'agent'; // H-4 Fix: expose role for downstream authorization
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

  // Prevent Parameter Pollution: tenantId must come from exactly one location
  const inParams = !!req.params.tenantId;
  const inQuery  = !!req.query.tenantId;
  const inBody   = !!req.body?.tenantId;

  if ((inParams ? 1 : 0) + (inQuery ? 1 : 0) + (inBody ? 1 : 0) > 1) {
    return res.status(400).json({ error: 'Parameter pollution detected: tenantId provided in multiple locations' });
  }

  const tenantId = req.params.tenantId || (req.query.tenantId as string) || req.body?.tenantId;

  if (!tenantId) {
    return res.status(400).json({ error: 'Missing tenantId in request' });
  }

  // H-4 Fix: fetch role alongside id so downstream routes can enforce admin-only actions
  const { data: memberData, error: memberError } = await supabaseAdmin
    .from('tenant_users')
    .select('id, role')
    .eq('user_id', user.id)
    .eq('tenant_id', tenantId)
    .single();

  if (memberError || !memberData) {
    return res.status(403).json({ error: 'Forbidden: You do not have access to this tenant' });
  }

  req.user = user;
  req.tenantId = tenantId;
  req.tenantRole = memberData.role as 'admin' | 'agent';
  next();
};

/**
 * Middleware: requires the authenticated user to be a tenant admin (not just a member).
 * Must be chained AFTER requireTenantMember.
 */
export const requireTenantAdminRole = (req: TenantRequest, res: Response, next: NextFunction) => {
  if (req.tenantRole !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Requires tenant admin role' });
  }
  next();
};
