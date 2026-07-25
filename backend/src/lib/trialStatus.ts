/**
 * Trial vs paid subscription rules:
 * - Paid plan (active subscription with plan !== 'free') overrides trial restrictions.
 * - Bot replies (WhatsApp + widget) blocked when trial expired or conversation cap hit, unless paid.
 * - Dashboard setup caps (KB 1 doc, FAQ 10) apply only on unpaid trial — not after upgrade.
 */

import { supabaseAdmin } from './supabase';

export type TenantTrialFields = {
  plan_type: string | null;
  trial_expires_at: string | null;
  trial_conversations_used: number | null;
  trial_conversations_limit: number | null;
};

export type SubscriptionFields = {
  plan: string;
  status: string;
} | null;

export function isPaidPlan(sub: SubscriptionFields): boolean {
  return sub?.status === 'active' && sub.plan !== 'free';
}

/** Missing expiry date is treated as active trial (avoid false "expired" from null). */
export function isTrialExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const expires = new Date(expiresAt).getTime();
  if (Number.isNaN(expires)) return false;
  return Date.now() > expires;
}

export function isTrialConversationLimitReached(
  used: number | null | undefined,
  limit: number | null | undefined,
): boolean {
  const cap = limit ?? 100;
  return (used ?? 0) >= cap;
}

export function shouldBlockBotReplies(
  tenant: TenantTrialFields | null | undefined,
  sub: SubscriptionFields,
): boolean {
  if (!tenant || isPaidPlan(sub)) return false;
  if (tenant.plan_type !== 'trial') return false;
  return (
    isTrialExpired(tenant.trial_expires_at) ||
    isTrialConversationLimitReached(
      tenant.trial_conversations_used,
      tenant.trial_conversations_limit,
    )
  );
}

export function shouldEnforceTrialSetupCaps(
  tenant: TenantTrialFields | null | undefined,
  sub: SubscriptionFields,
): boolean {
  if (!tenant) return false;
  return tenant.plan_type === 'trial' && !isPaidPlan(sub);
}

export const TRIAL_BOT_BLOCKED_MESSAGE =
  'This business trial has ended or reached its conversation limit. Bot replies are paused — please contact them directly.';

export async function fetchTenantTrialContext(tenantId: string) {
  const [tenantRes, subRes] = await Promise.all([
    supabaseAdmin
      .from('tenants')
      .select('plan_type, trial_expires_at, trial_conversations_used, trial_conversations_limit')
      .eq('id', tenantId)
      .single(),
    supabaseAdmin
      .from('subscriptions')
      .select('plan, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .maybeSingle(),
  ]);

  return {
    tenant: tenantRes.data,
    subscription: subRes.data as SubscriptionFields,
  };
}
