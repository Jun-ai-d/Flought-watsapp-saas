import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { RefreshCw, Code, Check, Globe, BookOpen, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { WebChatWidget } from '../components/WebChatWidget';

type WidgetConfig = {
  widget_token: string | null;
  business_name: string;
};

function getAppOrigin() {
  if (typeof window === 'undefined') return 'https://app.flought.com';
  return window.location.origin.replace(/\/$/, '');
}

function getApiUrl() {
  return (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
}

export default function WidgetConfigurator() {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const appOrigin = getAppOrigin();
  const apiUrl = getApiUrl();
  const widgetScriptUrl = `${appOrigin}/widget.js`;

  const { data: config, isLoading } = useQuery({
    queryKey: ['widget_config', tenant?.id],
    queryFn: async (): Promise<WidgetConfig | null> => {
      if (!tenant) return null;

      let tokenRow: { token: string } | null = null;
      const { data: existing, error: tokenError } = await supabase
        .from('widget_tokens')
        .select('token')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .maybeSingle();

      if (tokenError) throw tokenError;

      if (existing) {
        tokenRow = existing as { token: string };
      } else {
        const { data: created, error: ensureError } = await supabase.rpc('ensure_widget_token', {
          p_tenant_id: tenant.id,
        } as never);
        if (ensureError) throw ensureError;
        tokenRow = created ? { token: created as string } : null;
      }

      const { data: tenantRow, error: tenantError } = await supabase
        .from('tenants')
        .select('business_name')
        .eq('id', tenant.id)
        .single();

      if (tenantError) throw tenantError;

      return {
        widget_token: tokenRow?.token ?? null,
        business_name: (tenantRow as { business_name: string } | null)?.business_name ?? '',
      };
    },
    enabled: !!tenant?.id,
  });

  const rotateTokenMutation = useMutation({
    mutationFn: async () => {
      const { data: newToken, error } = await supabase.rpc('rotate_widget_token', {
        p_tenant_id: tenant!.id,
      } as never);
      if (error) throw error;
      return newToken as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widget_config', tenant?.id] });
      alert('Token rotated successfully! Update the embed code on your website.');
    },
  });

  const embedSnippet = `<script 
  src="${widgetScriptUrl}" 
  data-token="${config?.widget_token || 'YOUR_TOKEN'}"
  data-api-url="${apiUrl}"
></script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return <div className="flex-1 flex items-center justify-center h-full">Loading...</div>;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-theme-bg text-theme-text">
      <div className="p-6 border-b border-theme-border bg-theme-surface shrink-0">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Globe className="text-brand-accent" /> Chat Widget Configurator
        </h1>
        <p className="text-theme-text-muted mt-2">Customize and embed the web chat widget on your own website.</p>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-1/2 p-6 overflow-y-auto border-r border-theme-border bg-theme-surface space-y-6">
          <div className="theme-card p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Code size={20} className="text-blue-500" /> Embed Code
            </h2>
            <p className="text-sm text-theme-text-muted mb-4">
              Paste this before <code>&lt;/body&gt;</code> on your site. The script loads from{' '}
              <code>{widgetScriptUrl}</code> and calls your API at <code>{apiUrl}</code>.
            </p>

            <div className="relative">
              <pre className="bg-theme-bg border border-theme-border p-4 rounded-lg text-sm font-mono overflow-x-auto text-theme-text theme-button whitespace-pre-wrap">
                {embedSnippet}
              </pre>
              <button
                onClick={handleCopy}
                className="absolute top-2 right-2 p-2 bg-theme-surface border border-theme-border rounded hover:bg-theme-surface-hover transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <Check size={16} className="text-green-500" /> : <Code size={16} />}
              </button>
            </div>
          </div>

          <div className="theme-card p-6">
            <h2 className="text-lg font-bold mb-4 text-red-500">Security</h2>
            <p className="text-sm text-theme-text-muted mb-4">
              Rotating the token instantly invalidates old embeds until you update the snippet.
            </p>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    'Rotate widget token? Existing website embeds will stop working until you update the code.'
                  )
                ) {
                  rotateTokenMutation.mutate();
                }
              }}
              disabled={rotateTokenMutation.isPending}
              className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 font-bold rounded-lg hover:bg-red-500/20 transition-colors flex items-center gap-2"
            >
              <RefreshCw size={16} className={rotateTokenMutation.isPending ? 'animate-spin' : ''} />
              Rotate Token
            </button>
          </div>

          <div className="theme-card p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <BookOpen size={18} className="text-brand-accent" /> How replies work
            </h2>
            <ol className="text-sm text-theme-text-muted space-y-2 list-decimal list-inside">
              <li>
                <strong className="text-theme-text">Flow Builder</strong> — exact keyword match (e.g. &quot;hello&quot;)
              </li>
              <li>
                <strong className="text-theme-text">FAQ Manager</strong> — keyword match on published FAQs
              </li>
              <li>
                <strong className="text-theme-text">Knowledge Base</strong> — RAG when no FAQ matches
              </li>
              <li>
                <strong className="text-theme-text">Human handover</strong> — &quot;talk to agent&quot; or low confidence
              </li>
            </ol>
            {tenant?.plan_type === 'trial' && (
              <div className="mt-4 flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm">
                <AlertTriangle size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-yellow-700">
                  Trial accounts: widget chat counts toward your conversation limit. Visitors see a limit message when
                  the trial cap is reached.
                </p>
              </div>
            )}
          </div>

          <div className="theme-card p-6">
            <h2 className="text-lg font-bold mb-3">Troubleshooting</h2>
            <ul className="text-sm text-theme-text-muted space-y-2 list-disc list-inside">
              <li>Widget not appearing — confirm the script URL loads (check browser Network tab)</li>
              <li>No replies — verify Flow is Published, FAQs are published, or KB docs are Indexed</li>
              <li>401/404 on chat — token mismatch; copy fresh embed code after rotate</li>
              <li>CORS errors — ensure <code>data-api-url</code> points to your backend ({apiUrl})</li>
            </ul>
          </div>
        </div>

        <div className="w-full md:w-1/2 bg-theme-bg relative flex flex-col">
          <div className="p-4 border-b border-theme-border bg-theme-surface shrink-0 flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2">Live Preview</h2>
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
          </div>
          <div className="flex-1 relative overflow-hidden flex items-center justify-center p-8">
            <div className="w-full max-w-sm aspect-[9/16] bg-theme-surface border-[8px] border-theme-border rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col">
              <div className="absolute top-0 inset-x-0 h-6 flex justify-center">
                <div className="w-1/3 h-full bg-theme-border rounded-b-xl"></div>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <h3 className="font-display font-bold text-xl mb-2">{config?.business_name || 'Your Website'}</h3>
                <p className="text-theme-text-muted text-sm">Try the widget in the bottom-right corner.</p>
              </div>
              <div className="absolute inset-0 pointer-events-auto">
                <WebChatWidget forcePreview={true} widgetToken={config?.widget_token ?? undefined} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
