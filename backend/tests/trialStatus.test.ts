import {
  isPaidPlan,
  isTrialExpired,
  shouldBlockBotReplies,
  shouldEnforceTrialSetupCaps,
} from '../src/lib/trialStatus';

const trialTenant = {
  plan_type: 'trial',
  trial_expires_at: '2020-01-01T00:00:00Z',
  trial_conversations_used: 2,
  trial_conversations_limit: 100,
};

describe('trialStatus', () => {
  test('paid subscription overrides trial expiry for bot blocking', () => {
    expect(shouldBlockBotReplies(trialTenant, { plan: 'standard', status: 'active' })).toBe(false);
  });

  test('blocks bot replies when trial expired without paid plan', () => {
    expect(shouldBlockBotReplies(trialTenant, { plan: 'free', status: 'active' })).toBe(true);
    expect(shouldBlockBotReplies(trialTenant, null)).toBe(true);
  });

  test('blocks bot replies when conversation cap hit', () => {
    const capped = { ...trialTenant, trial_expires_at: '2099-01-01T00:00:00Z', trial_conversations_used: 100 };
    expect(shouldBlockBotReplies(capped, { plan: 'free', status: 'active' })).toBe(true);
  });

  test('null trial_expires_at is not treated as expired', () => {
    expect(isTrialExpired(null)).toBe(false);
    expect(
      shouldBlockBotReplies(
        { ...trialTenant, trial_expires_at: null, trial_conversations_used: 1 },
        { plan: 'free', status: 'active' },
      ),
    ).toBe(false);
  });

  test('setup caps apply only on unpaid trial', () => {
    expect(shouldEnforceTrialSetupCaps(trialTenant, { plan: 'free', status: 'active' })).toBe(true);
    expect(shouldEnforceTrialSetupCaps(trialTenant, { plan: 'pro', status: 'active' })).toBe(false);
    expect(isPaidPlan({ plan: 'pro', status: 'active' })).toBe(true);
    expect(isPaidPlan({ plan: 'free', status: 'active' })).toBe(false);
  });
});
