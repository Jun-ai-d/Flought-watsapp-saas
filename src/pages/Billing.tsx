import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Download, ExternalLink, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

const Billing: React.FC = () => {
  const { tenant, session } = useAuth();
  const { data, isLoading: loading } = useQuery<{ sub: any, usage: any, invoices: any[] }>({
    queryKey: ['billing', tenant?.id],
    queryFn: async () => {
      const billingPeriod = new Date();
      billingPeriod.setDate(1);
      const periodStr = billingPeriod.toISOString().split('T')[0];
      
      const [subRes, usageRes, invoiceRes] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('*')
          .eq('tenant_id', tenant!.id)
          .eq('status', 'active')
          .single(),
        supabase
          .from('usage_tracking')
          .select('*')
          .eq('tenant_id', tenant!.id)
          .eq('billing_period', periodStr)
          .single(),
        supabase
          .from('invoices')
          .select('*')
          .eq('tenant_id', tenant!.id)
          .order('created_at', { ascending: false })
      ]);
      
      return {
        sub: subRes.data,
        usage: usageRes.data,
        invoices: invoiceRes.data || []
      };
    },
    enabled: !!tenant?.id,
  });

  const sub = data?.sub;
  const usage = data?.usage;
  const invoices = data?.invoices || [];
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleCheckout = async () => {
    if (!tenant || !session) return;
    setCheckoutLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/billing/create-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ tenantId: tenant.id })
      });
      
      if (!res.ok) throw new Error('Failed to generate checkout link');
      const data = await res.json();
      
      if (data.short_url) {
        window.location.href = data.short_url;
      } else {
        alert('Could not initialize Razorpay checkout. Please check keys.');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to billing service.');
    }
    setCheckoutLoading(false);
  };

  const messagesSent = usage?.messages_sent || 0;
  const llmCalls = usage?.llm_calls || 0;
  const sttMinutes = Number(usage?.stt_minutes || 0).toFixed(1);
  const capMessages = sub?.cap_messages || 1500;
  
  const msgPercent = Math.min(100, Math.round((messagesSent / capMessages) * 100));
  const llmPercent = Math.min(100, Math.round((llmCalls / 1500) * 100));

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-display font-bold text-theme-text mb-2">Usage & Billing</h1>
          <p className="text-theme-text-muted">Monitor your current billing cycle usage and overage limits.</p>
        </div>
        <button 
          className="px-6 py-3 bg-brand-accent text-white font-bold hover:bg-brand-accent-light transition-colors flex items-center gap-2 theme-button shadow-sm disabled:opacity-50"
          onClick={handleCheckout}
          disabled={checkoutLoading}
        >
          <CreditCard size={18} /> {checkoutLoading ? 'Processing...' : 'Update Payment Method'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Current Plan & Limits */}
        <div className="theme-card p-8 bg-theme-surface h-full">
          {loading ? (
            <div className="text-theme-text-muted font-medium py-12 text-center">Loading subscription details...</div>
          ) : (
            <>
              {sub ? (
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h2 className="text-2xl font-display font-bold text-theme-text capitalize mb-1">
                      Current Plan: {sub.plan}
                    </h2>
                    <p className="font-mono text-xl text-theme-text-muted font-bold">₹{sub.price_inr?.toLocaleString()}/mo</p>
                  </div>
                  <div className="px-3 py-1 bg-green-500/10 text-green-500 border border-green-500/20 rounded-full text-xs font-bold uppercase tracking-widest">
                    ACTIVE
                  </div>
                </div>
              ) : (
                <div className="mb-8 p-6 bg-theme-bg border border-brand-accent/20 flex flex-col sm:flex-row items-center gap-6" style={{ borderRadius: 'var(--radius-card)' }}>
                  <div className="w-12 h-12 bg-brand-accent/10 text-brand-accent rounded-full flex items-center justify-center shrink-0">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-bold text-theme-text mb-1">No Active Subscription</h3>
                    <p className="text-theme-text-muted text-sm font-medium">Please subscribe to unlock outbound messaging and higher limits.</p>
                  </div>
                  <button 
                    className="ml-auto px-6 py-2 bg-brand-accent text-white font-bold hover:bg-brand-accent-light transition-colors theme-button shadow-md disabled:opacity-50 shrink-0" 
                    onClick={handleCheckout} 
                    disabled={checkoutLoading}
                  >
                    {checkoutLoading ? 'Loading...' : 'Subscribe'}
                  </button>
                </div>
              )}
              
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-theme-text">Messages Sent</span>
                    <span className="font-mono text-sm font-bold text-theme-text-muted">{messagesSent.toLocaleString()} / {capMessages.toLocaleString()}</span>
                  </div>
                  <div className="h-3 w-full bg-theme-bg overflow-hidden" style={{ borderRadius: 'var(--radius-button)' }}>
                    <div className="h-full bg-brand-accent transition-all duration-1000" style={{ width: `${msgPercent}%` }}></div>
                  </div>
                  <div className="text-theme-text-muted text-xs mt-2 font-medium">
                    Overage rate: ₹0.30 per message
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-theme-text">AI RAG Queries (LLM Calls)</span>
                    <span className="font-mono text-sm font-bold text-theme-text-muted">{llmCalls.toLocaleString()} / 1,500</span>
                  </div>
                  <div className="h-3 w-full bg-theme-bg overflow-hidden" style={{ borderRadius: 'var(--radius-button)' }}>
                    <div className="h-full bg-brand-accent transition-all duration-1000" style={{ width: `${llmPercent}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-theme-text">Voice Note Transcription (STT)</span>
                    <span className="font-mono text-sm font-bold text-theme-text-muted">{sttMinutes} minutes</span>
                  </div>
                  <div className="h-3 w-full bg-theme-bg overflow-hidden" style={{ borderRadius: 'var(--radius-button)' }}>
                    <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${Math.min(100, Number(sttMinutes) / 60 * 100)}%` }}></div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Invoice History */}
        <div className="theme-card p-8 bg-theme-surface h-full">
          <h2 className="text-2xl font-display font-bold text-theme-text mb-6">Invoice History</h2>
          
          <div className="overflow-x-auto rounded-lg border border-theme-border">
            <table className="w-full text-left border-collapse bg-theme-bg">
              <thead>
                <tr className="border-b border-theme-border bg-theme-surface-hover">
                  <th className="py-3 px-4 font-bold text-sm text-theme-text-muted uppercase tracking-wider">Date</th>
                  <th className="py-3 px-4 font-bold text-sm text-theme-text-muted uppercase tracking-wider">Amount</th>
                  <th className="py-3 px-4 font-bold text-sm text-theme-text-muted uppercase tracking-wider">Status</th>
                  <th className="py-3 px-4 font-bold text-sm text-theme-text-muted uppercase tracking-wider">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border">
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-theme-text-muted text-center py-8 font-medium italic">No payment history found.</td>
                  </tr>
                )}
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-theme-surface-hover transition-colors">
                    <td className="py-4 px-4 text-theme-text font-medium">{new Date(inv.created_at).toLocaleDateString()}</td>
                    <td className="py-4 px-4 font-mono font-bold text-theme-text">₹{inv.amount_inr?.toLocaleString() || '0'}</td>
                    <td className="py-4 px-4">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider border",
                        inv.status === 'paid' ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"
                      )}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {inv.invoice_url ? (
                        <a href={inv.invoice_url} target="_blank" rel="noreferrer" className="text-brand-accent hover:text-brand-accent-light p-2 block w-max bg-brand-accent/5 rounded-full transition-colors">
                          <ExternalLink size={18} />
                        </a>
                      ) : (
                        <span className="text-theme-text-muted">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Billing;
