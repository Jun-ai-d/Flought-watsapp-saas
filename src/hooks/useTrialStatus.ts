import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getTrialBannerState, type SubscriptionFields, type TrialBannerState } from '../lib/trialStatus';

export function useTrialStatus(): TrialBannerState | null {
  const { tenant } = useAuth();

  const { data: subscription } = useQuery<SubscriptionFields>({
    queryKey: ['subscription', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('plan, status')
        .eq('tenant_id', tenant!.id)
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw error;
      return data as SubscriptionFields;
    },
    enabled: !!tenant?.id,
    staleTime: 60_000,
  });

  return useMemo(() => getTrialBannerState(tenant, subscription ?? null), [tenant, subscription]);
}
