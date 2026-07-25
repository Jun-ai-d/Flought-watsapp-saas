export type ViteEnvIssueReason = 'missing' | 'invalid_url' | 'placeholder';

export type ViteEnvIssue = {
  name: string;
  reason: ViteEnvIssueReason;
  /** Display-safe value (secrets masked, URLs shortened) */
  displayValue?: string;
};

const VITE_ENV_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_API_URL',
] as const;

const URL_VARS = new Set<string>(['VITE_SUPABASE_URL', 'VITE_API_URL']);

const PLACEHOLDER_VALUES = new Set([
  'your-supabase-url',
  'your-anon-key',
  'your-project.supabase.co',
  'https://your_project.supabase.co',
  'https://your-project.supabase.co',
  'https://your_project.supabase.co/',
]);

function getEnvValue(name: (typeof VITE_ENV_VARS)[number]): string {
  return import.meta.env[name]?.trim() ?? '';
}

function isValidHttpUrl(value: string): boolean {
  if (!/^https?:\/\/.+/i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isPlaceholder(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  if (PLACEHOLDER_VALUES.has(normalized)) return true;
  if (/^your[-_]/.test(normalized)) return true;
  if (normalized.includes('your_project') || normalized.includes('your-project')) return true;
  return false;
}

export function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '(empty)';
  if (trimmed.length <= 12) return '***';
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-4)}`;
}

export function maskUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '(empty)';
  if (trimmed.length <= 48) return `"${trimmed}"`;
  return `"${trimmed.slice(0, 48)}…"`;
}

export function getViteEnvIssues(): ViteEnvIssue[] {
  const issues: ViteEnvIssue[] = [];

  for (const name of VITE_ENV_VARS) {
    const value = getEnvValue(name);

    if (!value) {
      issues.push({ name, reason: 'missing' });
      continue;
    }

    if (isPlaceholder(value)) {
      issues.push({
        name,
        reason: 'placeholder',
        displayValue: URL_VARS.has(name) ? maskUrl(value) : maskSecret(value),
      });
      continue;
    }

    if (URL_VARS.has(name) && !isValidHttpUrl(value)) {
      issues.push({
        name,
        reason: 'invalid_url',
        displayValue: maskUrl(value),
      });
    }
  }

  return issues;
}

export function getMissingViteEnvVars(): string[] {
  return getViteEnvIssues()
    .filter((issue) => issue.reason === 'missing')
    .map((issue) => issue.name);
}

export const isFrontendConfigured = getViteEnvIssues().length === 0;

export function getSupabaseUrl(): string {
  return getEnvValue('VITE_SUPABASE_URL');
}

export function getSupabaseAnonKey(): string {
  return getEnvValue('VITE_SUPABASE_ANON_KEY');
}
