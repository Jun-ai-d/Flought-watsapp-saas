/**
 * Platform Admin API Routes
 * 
 * This module defines the Express routes for the "Super Admin" dashboard.
 * It is completely isolated from normal tenant operations and requires a user
 * to exist in the 'platform_admins' Postgres table.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { requireApiKey } from '../middleware/apiAuth';
import { appCache } from '../lib/cache';
import { encryptToken } from '../bsp/crypto';

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
 * GET /metrics
 * Fetches high-level SaaS metrics: Total MRR, Total Volume, Total Active Tenants.
 */
router.get('/metrics', async (req, res) => {
  try {
    const cached = appCache.get('admin_metrics');
    if (cached) return res.json(cached);

    const currentMonth = new Date();
    currentMonth.setDate(1);
    const billingPeriod = currentMonth.toISOString().split('T')[0];

    let expensesRes: any = { data: [] };
    
    const [mrrRes, usageRes, tenantsRes] = await Promise.all([
      supabaseAdmin.rpc('get_total_mrr'),
      supabaseAdmin.rpc('get_total_usage', { p_billing_period: billingPeriod }),
      supabaseAdmin.from('tenants').select('id', { count: 'exact', head: true }).eq('status', 'active')
    ]);

    try {
      expensesRes = await supabaseAdmin.from('platform_expenses').select('id, name, amount_inr, created_at').order('created_at', { ascending: false });
    } catch (e) {
      console.warn('platform_expenses query failed:', e instanceof Error ? e.message : e);
    }

    // Income
    const mrr = Number(mrrRes.data || 0);
    
    // API Costs
    const usageData = usageRes.data || { total_messages_sent: 0, total_llm_calls: 0, total_stt_minutes: 0 };
    const totalMessages = Number(usageData.total_messages_sent || 0);
    const totalLlm = Number(usageData.total_llm_calls || 0);
    const totalStt = Number(usageData.total_stt_minutes || 0);

    const msgCost = totalMessages * 0.75; // ₹0.75 per msg
    const llmCost = totalLlm * 1.50; // ₹1.5 per call
    const sttCost = totalStt * 0.50; // ₹0.5 per minute
    const apiCosts = msgCost + llmCost + sttCost;

    // Fixed Expenses
    const expensesList = expensesRes.data || [];
    const fixedExpenses = expensesList.reduce((acc: number, exp: any) => acc + Number(exp.amount_inr), 0);

    const totalExpenses = apiCosts + fixedExpenses;
    const netProfit = mrr - totalExpenses;
    const profitMargin = mrr > 0 ? (netProfit / mrr) * 100 : 0;
    const activeTenants = tenantsRes.count || 0;

    const result = { 
      mrr, 
      volume: totalMessages, 
      activeTenants,
      financials: {
        apiCosts,
        fixedExpenses,
        totalExpenses,
        netProfit,
        profitMargin,
        breakdown: { msgCost, llmCost, sttCost }
      },
      expensesList
    };
    appCache.set('admin_metrics', result, 60);
    res.json(result);
  } catch (error) {
    console.error('Error fetching admin metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

/**
 * GET /tenants
 * Fetches a list of all businesses (tenants) currently on the Flought platform,
 * along with their active subscription plans and current month usage.
 */
router.get('/tenants', async (req, res) => {
  try {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    const billingPeriod = currentMonth.toISOString().split('T')[0];

    const { data: tenants, error } = await supabaseAdmin
      .from('tenants')
      .select(`
        id, 
        business_name, 
        status, 
        region, 
        tier, 
        created_at,
        subscriptions (plan, status, cap_messages, price_inr, renewed_at),
        usage_tracking (messages_sent, billing_period),
        tenant_users (id)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Filter usage tracking down to current month only since Postgrest doesn't easily support dynamic join filters without complex RPC
    const mapped = tenants?.map(t => {
      const usageArr = Array.isArray(t.usage_tracking) ? t.usage_tracking : [];
      const currentUsage = usageArr.find((u: any) => u.billing_period === billingPeriod);
      const userCount = Array.isArray(t.tenant_users) ? t.tenant_users.length : 0;
      
      return {
        ...t,
        users_count: userCount,
        usage_tracking: currentUsage || { messages_sent: 0, billing_period: billingPeriod }
      };
    });

    res.json(mapped);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

/**
 * GET /users
 * Fetches all platform users (mapping tenant_users to tenants)
 */
router.get('/users', async (req, res) => {
  try {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    const billingPeriod = currentMonth.toISOString().split('T')[0];

    const { data: users, error } = await supabaseAdmin
      .from('tenant_users')
      .select(`
        id,
        user_id,
        role,
        created_at,
        tenant:tenants(
          id, 
          business_name, 
          tier,
          subscriptions (cap_messages),
          usage_tracking (messages_sent, billing_period)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Filter usage tracking down to current month only
    const mapped = users?.map((u: any) => {
      if (u.tenant) {
        const usageArr = Array.isArray(u.tenant.usage_tracking) ? u.tenant.usage_tracking : [];
        const currentUsage = usageArr.find((usage: any) => usage.billing_period === billingPeriod);
        u.tenant.usage_tracking = currentUsage || { messages_sent: 0, billing_period: billingPeriod };
      }
      return u;
    });

    res.json(mapped);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch platform users' });
  }
});

/**
 * POST /users
 * Provisions a new user via Supabase Admin Auth and assigns them to a tenant.
 */
router.post('/users', async (req: Request, res: Response) => {
  const { email, password, tenant_id, role } = req.body;

  if (!email || !password || !tenant_id || !role) {
    return res.status(400).json({ error: 'Missing required user fields' });
  }

  if (role !== 'admin' && role !== 'agent') {
    return res.status(400).json({ error: 'Invalid role. Must be admin or agent.' });
  }

  try {
    // 0. Check if tenant exists
    const { data: tenantData, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('id', tenant_id)
      .single();

    if (tenantError || !tenantData) {
      return res.status(404).json({ error: 'Tenant does not exist' });
    }
    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) throw authError;

    // 2. Assign user to the tenant
    const { error: assignError } = await supabaseAdmin
      .from('tenant_users')
      .insert({
        tenant_id,
        user_id: authData.user.id,
        role
      });

    if (assignError) {
      // Rollback auth user creation if assignment fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw assignError;
    }

    res.status(201).json({ message: 'User provisioned successfully' });
  } catch (error: any) {
    console.error('Error provisioning user:', error);
    res.status(500).json({ error: 'Failed to provision user' });
  }
});

/**
 * DELETE /users/:userId
 * Revokes access by deleting the user from Supabase Auth (which cascades to tenant_users).
 */
router.delete('/users/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId as string);
    if (error) throw error;
    res.json({ message: 'User access revoked' });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to revoke user access' });
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
    const finalRegion = region || 'IN';
    const finalTier = tier || 'standard';
    const capMessages = finalTier === 'vip' ? 20000 : (finalTier === 'growth' ? 4000 : 1500);
    const priceInr = finalTier === 'vip' ? 14999 : (finalTier === 'growth' ? 4999 : 1999);

    const { data: tenant, error } = await supabaseAdmin.rpc('provision_tenant', {
      p_business_name: business_name.trim(),
      p_region: finalRegion,
      p_tier: finalTier,
      p_cap_messages: capMessages,
      p_price_inr: priceInr
    });
      
    if (error) throw error;

    res.status(201).json(tenant);
  } catch (error) {
    console.error('Error provisioning tenant:', error);
    res.status(500).json({ error: 'Failed to provision tenant' });
  }
});

/**
 * POST /tenants/:tenantId/subscription
 * Updates a tenant's subscription plan, price, and status.
 */
router.post('/tenants/:tenantId/subscription', async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const { plan, price_inr, status } = req.body;

  if (plan && typeof plan !== 'string') {
    return res.status(400).json({ error: 'Invalid plan' });
  }
  if (price_inr !== undefined && (typeof price_inr !== 'number' || price_inr < 0)) {
    return res.status(400).json({ error: 'Invalid price' });
  }
  if (status && !['active', 'past_due', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .update({ plan, price_inr, status })
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

/**
 * POST /expenses
 * Add a new fixed platform expense
 */
router.post('/expenses', async (req: Request, res: Response) => {
  const { name, amount_inr } = req.body;
  if (!name || !amount_inr) return res.status(400).json({ error: 'Missing name or amount' });

  try {
    const { data, error } = await supabaseAdmin
      .from('platform_expenses')
      .insert({ name, amount_inr })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error adding expense:', error);
    res.status(500).json({ error: 'Failed to add expense' });
  }
});

/**
 * DELETE /expenses/:id
 * Remove a fixed platform expense
 */
router.delete('/expenses/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { error } = await supabaseAdmin
      .from('platform_expenses')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

/**
 * GET /tenants/:tenantId/bsp
 * Fetches the BSP configuration for a specific tenant.
 */
router.get('/tenants/:tenantId/bsp', async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  try {
    const { data, error } = await supabaseAdmin
      .from('tenant_bsp_config')
      .select('bsp_provider, waba_id, phone_number_id, webhook_verify_token, is_active')
      .eq('tenant_id', tenantId)
      .single();
      
    if (error && error.code !== 'PGRST116') { // not found
      throw error;
    }
    
    res.json(data || null);
  } catch (error) {
    console.error('Error fetching BSP config:', error);
    res.status(500).json({ error: 'Failed to fetch BSP configuration' });
  }
});

/**
 * POST /tenants/:tenantId/bsp
 * Upserts the BSP configuration for a specific tenant.
 */
router.post('/tenants/:tenantId/bsp', async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const { bsp_provider, waba_id, phone_number_id, api_key } = req.body;
  
  if (!bsp_provider || !waba_id || !phone_number_id) {
    return res.status(400).json({ error: 'Missing required BSP fields' });
  }

  try {
    const updateData: any = {
      tenant_id: tenantId,
      bsp_provider,
      waba_id,
      phone_number_id,
      webhook_verify_token: `wh-${tenantId}-${Date.now()}` // generate a new one or keep existing
    };
    
    // Only update the encrypted token if they provided a new one
    if (api_key) {
      updateData.access_token_encrypted = encryptToken(api_key);
    }
    
    const { data, error } = await supabaseAdmin
      .from('tenant_bsp_config')
      .upsert(updateData, { onConflict: 'tenant_id' })
      .select('bsp_provider, waba_id, phone_number_id, webhook_verify_token, is_active')
      .single();
      
    if (error) throw error;
    
    // Invalidate the cache to ensure real-time messaging picks up the new config instantly

    appCache.delete(`bsp_config_${tenantId}`);
    
    res.json(data);
  } catch (error) {
    console.error('Error saving BSP config:', error);
    res.status(500).json({ error: 'Failed to save BSP configuration' });
  }
});

/**
 * POST /tenants/:tenantId/quota
 * Overrides the message quota for a specific tenant's subscription.
 */
router.post('/tenants/:tenantId/quota', async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const { cap_messages } = req.body;
  
  if (typeof cap_messages !== 'number' || cap_messages < 0) {
    return res.status(400).json({ error: 'Invalid cap_messages' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .update({ cap_messages })
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .select()
      .single();
      
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error updating quota:', error);
    res.status(500).json({ error: 'Failed to update quota' });
  }
});

/**
 * POST /tenants/:tenantId/status
 * Suspends or activates a tenant.
 */
router.post('/tenants/:tenantId/status', async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const { status } = req.body; // 'active' or 'suspended'
  
  if (!['active', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .update({ status })
      .eq('id', tenantId)
      .select()
      .single();
      
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error updating tenant status:', error);
    res.status(500).json({ error: 'Failed to update tenant status' });
  }
});

export default router;
