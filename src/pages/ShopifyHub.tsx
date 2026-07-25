import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { ShoppingBag, Key, Eye, EyeOff, RefreshCw, AlertCircle } from 'lucide-react';

const ShopifyHub: React.FC = () => {
  const { tenant, session } = useAuth();
  const queryClient = useQueryClient();
  const [showSecret, setShowSecret] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  const { data: integration, isLoading } = useQuery<any>({
    queryKey: ['shopify-integration', tenant?.id],
    queryFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/shopify/${tenant!.id}/integration`, {
        headers: { 'Authorization': `Bearer ${session!.access_token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch Shopify integration');
      return res.json();
    },
    enabled: !!tenant?.id && !!session?.access_token,
  });

  const { data: dlq = [] } = useQuery<any[]>({
    queryKey: ['shopify-dlq', tenant?.id],
    queryFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/shopify/${tenant!.id}/dlq`, {
        headers: { 'Authorization': `Bearer ${session!.access_token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch DLQ');
      return res.json();
    },
    enabled: !!tenant?.id && !!session?.access_token,
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard');
  };

  if (isLoading) return <div className="p-8 text-theme-text-muted font-bold animate-pulse">Loading Shopify Dashboard...</div>;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-end border-b border-theme-border pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-theme-text mb-2 flex items-center gap-3">
            <ShoppingBag className="text-[#96bf48]" size={32} /> Shopify Sync
          </h1>
          <p className="text-theme-text-muted">Manage your store connection and monitor background sync health.</p>
        </div>
        {integration?.is_active && (
          <div className="bg-green-500/10 text-green-500 border border-green-500/20 px-3 py-1 font-bold text-sm" style={{ borderRadius: 'var(--radius-button)' }}>
            Connected
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Connection Setup */}
        <div className="lg:col-span-1 space-y-6">
          <div className="theme-card p-6 border-t-4 border-t-[#96bf48]">
            <h2 className="text-xl font-display font-bold text-theme-text mb-4">Integration Details</h2>
            {integration ? (
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-bold text-theme-text-muted uppercase tracking-wider mb-1">Store Domain</p>
                  <p className="font-mono text-theme-text bg-theme-bg p-3 border border-theme-border rounded-md">
                    {integration.store_domain}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-bold text-theme-text-muted uppercase tracking-wider mb-1">Webhook Secret</p>
                  {revealedSecret ? (
                    <div className="flex gap-2">
                      <input
                        type={showSecret ? "text" : "password"}
                        readOnly
                        value={revealedSecret}
                        className="font-mono text-theme-text bg-theme-bg p-3 border border-theme-border rounded-md flex-1 outline-none"
                      />
                      <button 
                        onClick={() => setShowSecret(!showSecret)}
                        className="px-3 bg-theme-surface border border-theme-border text-theme-text hover:bg-brand-accent hover:text-white transition-colors"
                        style={{ borderRadius: 'var(--radius-button)' }}
                      >
                        {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                      <button 
                        onClick={() => copyToClipboard(revealedSecret)}
                        className="px-3 bg-brand-accent text-white hover:bg-brand-accent-light transition-colors font-bold"
                        style={{ borderRadius: 'var(--radius-button)' }}
                      >
                        Copy
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-theme-text-muted font-medium">
                      {integration.has_secret
                        ? 'Secret is stored securely. Rotate to reveal a new one.'
                        : 'No webhook secret configured yet.'}
                    </p>
                  )}
                  {integration.has_secret && (
                    <button
                      onClick={async () => {
                        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
                        const res = await fetch(`${apiUrl}/api/shopify/${tenant!.id}/integration/rotate-secret`, {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${session!.access_token}` },
                        });
                        if (!res.ok) {
                          alert('Failed to rotate secret');
                          return;
                        }
                        const data = await res.json();
                        setRevealedSecret(data.webhook_secret);
                        setShowSecret(true);
                        alert('New webhook secret generated. Copy it now — it will not be shown again.');
                      }}
                      className="mt-3 text-sm font-bold text-brand-accent hover:underline flex items-center gap-1"
                    >
                      <RefreshCw size={14} /> Rotate webhook secret
                    </button>
                  )}
                  <p className="text-xs text-theme-text-muted mt-2">Use this secret when creating webhooks in your Shopify admin panel.</p>
                </div>
              </div>
            ) : (
              <div className="text-center p-6 bg-theme-bg border border-dashed border-theme-border rounded-lg">
                <AlertCircle className="mx-auto h-8 w-8 text-yellow-500 mb-2" />
                <p className="font-bold text-theme-text">Not Connected</p>
                <p className="text-sm text-theme-text-muted mt-1 mb-4">You have not set up a Shopify integration yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* DLQ Table */}
        <div className="lg:col-span-2">
          <div className="theme-card p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-display font-bold text-theme-text">Dead Letter Queue (DLQ)</h2>
              <button 
                onClick={() => queryClient.invalidateQueries({ queryKey: ['shopify-dlq'] })}
                className="text-theme-text-muted hover:text-brand-accent transition-colors flex items-center gap-1 text-sm font-bold"
              >
                <RefreshCw size={16} /> Refresh
              </button>
            </div>
            <p className="text-sm text-theme-text-muted mb-4">Events that failed to sync after maximum retries.</p>
            
            <div className="flex-1 overflow-hidden flex flex-col">
              {dlq.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-green-500/5 border border-dashed border-green-500/20 rounded-lg">
                  <div className="w-12 h-12 bg-green-500/20 text-green-600 rounded-full flex items-center justify-center mb-3">✓</div>
                  <p className="font-bold text-theme-text">Queue is healthy</p>
                  <p className="text-sm text-theme-text-muted">No failed sync events found.</p>
                </div>
              ) : (
                <div className="overflow-y-auto border border-theme-border rounded-lg bg-theme-bg flex-1">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-theme-surface border-b border-theme-border sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-theme-text-muted font-bold">Event Topic</th>
                        <th className="px-4 py-3 text-theme-text-muted font-bold">Failed At</th>
                        <th className="px-4 py-3 text-theme-text-muted font-bold">Error Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-border">
                      {dlq.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-theme-surface transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-theme-text">{item.topic}</td>
                          <td className="px-4 py-3 text-theme-text-muted">{new Date(item.created_at).toLocaleString()}</td>
                          <td className="px-4 py-3 text-red-500 max-w-xs truncate">{item.error_message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopifyHub;
