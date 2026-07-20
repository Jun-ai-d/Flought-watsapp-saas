import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { ShoppingCart, TrendingUp, RefreshCw, CheckCircle2, Clock } from 'lucide-react';

const CartRecovery: React.FC = () => {
  const { tenant, session } = useAuth();

  const { data: stats, isLoading, isFetching } = useQuery<any>({
    queryKey: ['cart-recovery-stats', tenant?.id],
    queryFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/shopify/${tenant!.id}/carts/stats`, {
        headers: { 'Authorization': `Bearer ${session!.access_token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch cart stats');
      return res.json();
    },
    enabled: !!tenant?.id && !!session?.access_token,
    // Polling every 30 seconds for live updates
    refetchInterval: 30000,
  });

  if (isLoading) return <div className="p-8 text-theme-text-muted font-bold animate-pulse">Loading Recovery Stats...</div>;

  const pendingCarts = stats?.pending || 0;
  const recoveredCarts = stats?.recovered || 0;
  const revenueRecovered = stats?.revenue_recovered || 0;
  const currency = stats?.currency || 'USD';

  const formatCurrency = (amount: number, curr: string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: curr }).format(amount);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-end border-b border-theme-border pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-theme-text mb-2 flex items-center gap-3">
            <ShoppingCart className="text-[#96bf48]" size={32} /> Abandoned Cart Recovery
          </h1>
          <p className="text-theme-text-muted">Monitor carts and revenue recovered automatically via WhatsApp.</p>
        </div>
        {isFetching && (
          <div className="text-sm text-theme-text-muted flex items-center gap-2">
            <RefreshCw size={14} className="animate-spin" /> Live Updating
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="theme-card p-6 flex flex-col justify-between group hover:border-brand-accent transition-colors relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Clock size={120} />
          </div>
          <div>
            <p className="text-sm font-bold text-theme-text-muted uppercase tracking-wider mb-2">Pending Carts</p>
            <h3 className="text-4xl font-display font-bold text-theme-text">{pendingCarts}</h3>
          </div>
          <p className="text-xs text-theme-text-muted mt-4 border-t border-theme-border pt-3">
            Awaiting customer interaction.
          </p>
        </div>

        <div className="theme-card p-6 flex flex-col justify-between group hover:border-green-500 transition-colors relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <CheckCircle2 size={120} />
          </div>
          <div>
            <p className="text-sm font-bold text-theme-text-muted uppercase tracking-wider mb-2 text-green-500/80">Recovered Carts</p>
            <h3 className="text-4xl font-display font-bold text-green-500">{recoveredCarts}</h3>
          </div>
          <p className="text-xs text-theme-text-muted mt-4 border-t border-theme-border pt-3">
            Successfully recovered via WhatsApp sequence.
          </p>
        </div>

        <div className="theme-card p-6 flex flex-col justify-between group hover:border-blue-500 transition-colors relative overflow-hidden bg-gradient-to-br from-theme-surface to-blue-500/5">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <TrendingUp size={120} />
          </div>
          <div>
            <p className="text-sm font-bold text-theme-text-muted uppercase tracking-wider mb-2 text-blue-500/80">Revenue Recovered</p>
            <h3 className="text-4xl font-display font-bold text-blue-500">
              {formatCurrency(revenueRecovered, currency)}
            </h3>
          </div>
          <p className="text-xs text-theme-text-muted mt-4 border-t border-theme-border pt-3">
            Total sales salvaged this month.
          </p>
        </div>
        
      </div>
    </div>
  );
};

export default CartRecovery;
