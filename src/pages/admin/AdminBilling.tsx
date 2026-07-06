import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { CreditCard, Calendar, TrendingUp, Edit3, X, Save } from 'lucide-react';
import { cn } from '../../lib/utils';

const AdminBilling: React.FC = () => {
  const { session, isPlatformAdmin, loading } = useAuth();
  
  const [editingSub, setEditingSub] = useState<any | null>(null);
  const [subForm, setSubForm] = useState({ plan: '', price_inr: 0, status: '' });
  const [saving, setSaving] = useState(false);

  const { data: tenants = [], isLoading: fetching, refetch } = useQuery<any[]>({
    queryKey: ['admin-tenants'],
    queryFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/admin/tenants`, {
        headers: { 'Authorization': `Bearer ${session!.access_token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch tenants');
      return res.json();
    },
    enabled: !!session?.access_token && isPlatformAdmin,
  });

  if (loading || fetching) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent"></div>
      </div>
    );
  }
  
  if (!isPlatformAdmin) return <Navigate to="/dashboard" replace />;

  const totalMRR = tenants.reduce((acc, t) => {
    const sub = t.subscriptions?.[0];
    return acc + (sub?.status === 'active' ? (sub?.price_inr || 0) : 0);
  }, 0);

  const activeSubs = tenants.filter(t => t.subscriptions?.[0]?.status === 'active').length;

  const handleEditClick = (tenant: any, sub: any) => {
    setEditingSub(tenant);
    setSubForm({
      plan: sub?.plan || 'standard',
      price_inr: sub?.price_inr || 0,
      status: sub?.status || 'active'
    });
  };

  const handleSaveSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSub || !session) return;
    setSaving(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/admin/tenants/${editingSub.id}/subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(subForm)
      });
      if (!res.ok) throw new Error('API Error');
      refetch();
      setEditingSub(null);
    } catch (err) {
      alert('Failed to update subscription');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 relative max-w-7xl mx-auto text-slate-200">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-3xl font-bold text-slate-100 flex items-center tracking-tight">
          <CreditCard className="mr-3 h-8 w-8 text-indigo-500" />
          Billing & Subscriptions
        </h1>
        <p className="text-slate-400 mt-2 text-lg font-medium">Track platform revenue, active subscriptions, and renewal dates.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-slate-900 border border-slate-800 rounded flex items-center shadow-sm hover:shadow-md transition-shadow">
          <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded mr-4 border border-emerald-500/20">
            <TrendingUp size={28} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Verified MRR</div>
            <div className="text-3xl font-mono font-bold text-slate-100">
              ₹{totalMRR.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-900 border border-slate-800 rounded flex items-center shadow-sm hover:shadow-md transition-shadow">
          <div className="p-4 bg-indigo-500/10 text-indigo-500 rounded mr-4 border border-indigo-500/20">
            <CreditCard size={28} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Active Subscriptions</div>
            <div className="text-3xl font-mono font-bold text-slate-100">
              {activeSubs} / {tenants.length}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 bg-slate-900 border border-slate-800 rounded">
        <h2 className="text-xl font-bold flex items-center text-slate-100 mb-6">
          Subscription Ledger
        </h2>
        
        <div className="overflow-x-auto rounded border border-slate-800">
          <table className="w-full text-left border-collapse bg-slate-950">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="py-3 px-4 font-bold text-sm text-slate-500 uppercase tracking-wider border-r border-slate-800">Workspace</th>
                <th className="py-3 px-4 font-bold text-sm text-slate-500 uppercase tracking-wider border-r border-slate-800">Plan</th>
                <th className="py-3 px-4 font-bold text-sm text-slate-500 uppercase tracking-wider border-r border-slate-800">Price (MRR)</th>
                <th className="py-3 px-4 font-bold text-sm text-slate-500 uppercase tracking-wider border-r border-slate-800">Status</th>
                <th className="py-3 px-4 font-bold text-sm text-slate-500 uppercase tracking-wider border-r border-slate-800">Next Billing</th>
                <th className="py-3 px-4 font-bold text-sm text-slate-500 uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {tenants.map((t) => {
                const sub = t.subscriptions?.[0];
                const price = sub?.price_inr || 0;
                
                return (
                  <tr key={t.id} className="hover:bg-slate-900 transition-colors">
                    <td className="py-3 px-4 border-r border-slate-800">
                      <div className="font-bold text-slate-200">{t.business_name}</div>
                      <div className="font-mono text-[10px] text-slate-500">{t.id.substring(0,8)}</div>
                    </td>
                    <td className="py-3 px-4 border-r border-slate-800">
                      <span className="text-sm font-bold uppercase text-slate-400">{sub?.plan || 'N/A'}</span>
                    </td>
                    <td className="py-3 px-4 border-r border-slate-800 font-mono font-bold text-indigo-400">
                      ₹{price.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 border-r border-slate-800">
                      <span className={cn(
                        "px-2 py-1 text-[10px] font-bold uppercase border rounded",
                        sub?.status === 'active' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : 
                        sub?.status === 'cancelled' ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                        "bg-amber-500/10 text-amber-500 border-amber-500/20"
                      )}>
                        {sub?.status || 'Unknown'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-sm text-slate-300 flex items-center border-r border-slate-800 h-full min-h-[50px]">
                      <Calendar className="w-4 h-4 mr-2 text-slate-500" />
                      {sub?.renewed_at ? (() => {
                        const d = new Date(sub.renewed_at);
                        d.setMonth(d.getMonth() + 1);
                        return d.toLocaleDateString();
                      })() : 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button 
                        onClick={() => handleEditClick(t, sub)}
                        className="p-2 text-slate-500 hover:text-amber-500 transition-colors rounded-full hover:bg-amber-500/10 inline-flex"
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 italic bg-slate-900">No billing data found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Subscription Modal */}
      {editingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="p-8 bg-slate-900 border border-slate-800 rounded w-full max-w-md relative">
            <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-slate-100 flex items-center tracking-tight">
                <Edit3 className="mr-2 text-amber-500 w-5 h-5" /> Edit Subscription
              </h2>
              <button onClick={() => setEditingSub(null)} className="p-1 text-slate-500 hover:text-slate-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveSub} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">Workspace</label>
                <input 
                  type="text" 
                  value={editingSub.business_name}
                  disabled
                  className="w-full bg-slate-950 border border-slate-800 text-slate-500 rounded px-4 py-3 font-medium cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">Plan / Tier</label>
                <select 
                  value={subForm.plan}
                  onChange={e => setSubForm({...subForm, plan: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded px-4 py-3 focus:outline-none focus:border-amber-500 transition-all font-medium"
                >
                  <option value="standard">Standard</option>
                  <option value="growth">Growth</option>
                  <option value="vip">VIP</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">Monthly Price (INR)</label>
                <input 
                  type="number" 
                  min="0"
                  value={subForm.price_inr}
                  onChange={e => setSubForm({...subForm, price_inr: parseFloat(e.target.value) || 0})}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded px-4 py-3 focus:outline-none focus:border-amber-500 transition-all font-mono text-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">Subscription Status</label>
                <select 
                  value={subForm.status}
                  onChange={e => setSubForm({...subForm, status: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded px-4 py-3 focus:outline-none focus:border-amber-500 transition-all font-medium"
                >
                  <option value="active">Active</option>
                  <option value="past_due">Past Due (Unpaid)</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="pt-6 border-t border-slate-800 flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingSub(null)}
                  className="flex-1 px-4 py-3 font-bold text-slate-400 hover:text-slate-200 border border-slate-700 hover:bg-slate-800 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded transition-colors disabled:opacity-50 flex items-center justify-center shadow-md"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBilling;
