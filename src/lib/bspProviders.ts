/**
 * Single source of truth for BSP provider options.
 * Used across Settings.tsx, AdminTenants.tsx, and AdminDashboard.tsx
 * to prevent dropdown drift.
 *
 * Only list providers that are actually implemented in providerFactory.ts.
 */
export const BSP_PROVIDERS = [
  { value: 'meta', label: 'Meta Cloud API' },
] as const;

export const DEFAULT_BSP_PROVIDER = 'meta';

export type BSPProviderValue = typeof BSP_PROVIDERS[number]['value'];
