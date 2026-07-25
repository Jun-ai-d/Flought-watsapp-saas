export function getMissingViteEnvVars(): string[] {
  return [
    !import.meta.env.VITE_SUPABASE_URL?.trim() && 'VITE_SUPABASE_URL',
    !import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() && 'VITE_SUPABASE_ANON_KEY',
    !import.meta.env.VITE_API_URL?.trim() && 'VITE_API_URL',
  ].filter(Boolean) as string[];
}

export const isFrontendConfigured = getMissingViteEnvVars().length === 0;
