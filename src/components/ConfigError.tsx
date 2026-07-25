import { getViteEnvIssues, type ViteEnvIssue } from '../lib/env';

function issueMessage(issue: ViteEnvIssue): string {
  switch (issue.reason) {
    case 'missing':
      return 'not set in this build';
    case 'invalid_url':
      return `invalid URL (must start with http:// or https://) — got ${issue.displayValue ?? '(empty)'}`;
    case 'placeholder':
      return `placeholder value detected — got ${issue.displayValue ?? '(empty)'}`;
  }
}

export default function ConfigError() {
  const issues = getViteEnvIssues();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-lg rounded-xl border border-red-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Frontend configuration error</h1>
        <p className="mt-3 text-sm text-gray-600">
          This build has missing or invalid Vite environment variables. Set them as{' '}
          <strong>build-time</strong> variables on the <strong>frontend</strong> service in Coolify,
          enable <strong>Available at Buildtime</strong>, then <strong>rebuild</strong> (restart alone
          does not rebake <code className="text-xs">VITE_*</code> values).
        </p>
        {issues.length > 0 && (
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-red-700">
            {issues.map((issue) => (
              <li key={issue.name}>
                <code>{issue.name}</code>: {issueMessage(issue)}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 rounded-md bg-gray-50 p-3 text-xs text-gray-600">
          <p className="font-medium text-gray-800">Expected format</p>
          <ul className="mt-2 space-y-1 font-mono">
            <li>VITE_SUPABASE_URL=https://abcdefgh.supabase.co</li>
            <li>VITE_API_URL=https://api.your-domain.com</li>
            <li>VITE_SUPABASE_ANON_KEY=eyJ… (public anon key)</li>
          </ul>
        </div>
        <p className="mt-4 text-xs text-gray-500">
          Coolify: Frontend service → Environment → add vars → Redeploy with rebuild.
        </p>
      </div>
    </div>
  );
}
