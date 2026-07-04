/**
 * Platform Admin API Routes
 * 
 * This module defines the Express routes for the "Super Admin" dashboard.
 * It is completely isolated from normal tenant operations and requires a user
 * to exist in the 'platform_admins' Postgres table.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';

const router = Router();

// Extend the Express Request type to safely inject the verified Supabase User.
// This prevents the dreaded `(req as any).user` antipattern.
interface AdminRequest extends Request {
  user?: any;
}

/**
 * Express Middleware: Platform Admin Verification
 * 
 * 1. Extracts the JWT from the Authorization header.
 * 2. Uses Supabase Admin to verify the JWT and get the user identity.
 * 3. Queries the `platform_admins` table to ensure this user has super-admin rights.
 * 4. Injects the user into `req.user` and calls `next()`.
 */
const requirePlatformAdmin = async (req: AdminRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Strict check against the platform_admins table
  const { data: adminData, error: adminError } = await supabaseAdmin
    .from('platform_admins')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (adminError || !adminData) {
    return res.status(403).json({ error: 'Forbidden: Requires Platform Admin privileges' });
  }

  // Pass user to next handlers
  req.user = user;
  next();
};

// Apply the middleware to ALL routes in this router
router.use(requirePlatformAdmin);

/**
 * GET /check
 * Used by the frontend AuthContext to determine if the "Admin Dashboard" button 
 * should be rendered in the sidebar.
 */
router.get('/check', (req, res) => {
  res.json({ isPlatformAdmin: true });
});

/**
 * GET /tenants
 * Fetches a list of all businesses (tenants) currently on the Flought platform,
 * along with their active subscription plans.
 */
router.get('/tenants', async (req, res) => {
  try {
    const { data: tenants, error } = await supabaseAdmin
      .from('tenants')
      .select(`
        id, 
        business_name, 
        status, 
        region, 
        tier, 
        created_at,
        subscriptions (plan, status)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(tenants);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

/**
 * POST /tenants
 * Provisions a brand new business on the Flought platform.
 * It strictly validates the payload before interacting with the database
 * to prevent malformed data from breaking the dashboard.
 */
router.post('/tenants', async (req: AdminRequest, res: Response) => {
  const { business_name, region, tier } = req.body;
  
  // Strict Validation: Ensure business name is a valid string
  if (!business_name || typeof business_name !== 'string' || business_name.trim().length < 2) {
    return res.status(400).json({ error: 'Valid business_name is required' });
  }

  // Strict Validation: Enum checking for Postgres constraints
  const validRegions = ['IN', 'US', 'EU'];
  if (region && !validRegions.includes(region)) {
    return res.status(400).json({ error: 'Invalid region' });
  }

  const validTiers = ['standard', 'growth', 'vip'];
  if (tier && !validTiers.includes(tier)) {
    return res.status(400).json({ error: 'Invalid tier' });
  }

  try {
    // 1. Insert Tenant Record
    const { data: tenant, error: tErr } = await supabaseAdmin
      .from('tenants')
      .insert({
        business_name: business_name.trim(),
        region: region || 'IN',
        tier: tier || 'standard',
        status: 'active'
      })
      .select()
      .single();
      
    if (tErr) throw tErr;

    // 2. Create Subscription Placeholder
    // This allows the billing engine to know what to charge this tenant next month.
    const { error: sErr } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        tenant_id: tenant.id,
        plan: tier || 'standard',
        cap_messages: tier === 'vip' ? 20000 : (tier === 'growth' ? 4000 : 1500),
        price_inr: tier === 'vip' ? 14999 : (tier === 'growth' ? 4999 : 1999),
        status: 'active'
      });
      
    if (sErr) console.error('Subscription error:', sErr);

    res.status(201).json(tenant);
  } catch (error) {
    console.error('Error provisioning tenant:', error);
    res.status(500).json({ error: 'Failed to provision tenant' });
  }
});

export default router;
