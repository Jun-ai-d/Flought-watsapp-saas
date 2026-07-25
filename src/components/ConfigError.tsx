import { getMissingViteEnvVars } from '../lib/env';

export default function ConfigError() {
  const missingVars = getMissingViteEnvVars();
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-lg rounded-xl border border-red-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">Frontend configuration missing</h1>
        <p className="mt-3 text-sm text-gray-600">
          This build was deployed without required Vite environment variables. Set them as{' '}
          <strong>build-time</strong> variables in Coolify, then <strong>rebuild</strong> the frontend
          (restart alone is not enough for <code className="text-xs">VITE_*</code> vars).
        </p>
        {missingVars.length > 0 && (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-red-700">
            {missingVars.map((name) => (
              <li key={name}>
                <code>{name}</code>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-gray-500">
          Coolify: Frontend service → Environment → add vars → Redeploy with rebuild.
        </p>
      </div>
    </div>
  );
}
