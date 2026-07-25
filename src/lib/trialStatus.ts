/**
 * Trial vs paid subscription rules (mirrors backend/src/lib/trialStatus.ts):
 * - Paid plan overrides trial restrictions.
 * - Bot replies blocked when trial expired/capped unless paid.
 * - Setup caps (KB/FAQ) apply only on unpaid trial.
 */

export type TenantTrialFields = {
  plan_type?: string | null;
  trial_expires_at?: string | null;
  trial_conversations_used?: number | null;
  trial_conversations_limit?: number | null;
};

export type SubscriptionFields = {
  plan: string;
  status: string;
} | null;

export function isPaidPlan(sub: SubscriptionFields): boolean {
  return sub?.status === 'active' && sub.plan !== 'free';
}

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

export type TrialBannerState = {
  show: boolean;
  severity: 'info' | 'warning' | 'error';
  message: string;
  blockBotReplies: boolean;
  enforceSetupCaps: boolean;
};

export function getTrialBannerState(
  tenant: TenantTrialFields | null | undefined,
  sub: SubscriptionFields,
): TrialBannerState | null {
  if (!tenant || tenant.plan_type !== 'trial' || isPaidPlan(sub)) return null;

  const used = tenant.trial_conversations_used ?? 0;
  const limit = tenant.trial_conversations_limit ?? 100;
  const expired = isTrialExpired(tenant.trial_expires_at);
  const limitReached = isTrialConversationLimitReached(used, limit);
  const blockBotReplies = shouldBlockBotReplies(tenant, sub);

  let severity: TrialBannerState['severity'] = 'info';
  if (expired || limitReached) severity = 'error';
  else if (used >= limit * 0.8) severity = 'warning';

  let message: string;
  if (expired && limitReached) {
    message = `Trial expired (${used}/${limit} conversations used). Bot replies on WhatsApp and your website widget are paused. You can still set up FAQs, flows, and knowledge base.`;
  } else if (expired) {
    message = `Trial expired (${used}/${limit} conversations used). Bot replies are paused until you upgrade. Dashboard setup (FAQs, flows, KB) still works within trial limits.`;
  } else if (limitReached) {
    message = `Trial conversation limit reached (${used}/${limit}). Bot replies are paused. Upgrade to continue automated replies.`;
  } else {
    const expiryText = tenant.trial_expires_at
      ? `Expires ${new Date(tenant.trial_expires_at).toLocaleDateString()}.`
      : '';
    message = `Free trial: ${used}/${limit} conversations used. ${expiryText}`.trim();
  }

  return {
    show: true,
    severity,
    message,
    blockBotReplies,
    enforceSetupCaps: shouldEnforceTrialSetupCaps(tenant, sub),
  };
}
