import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { 
  Server, Users, PlusCircle, Settings, X, 
  TrendingUp, MessageSquare, Building, 
  MoreVertical, Power, Edit3, CheckCircle2,
  ChevronDown, ChevronUp, User, CreditCard, Calendar
} from 'lucide-react';
import { cn } from '../../lib/utils';

const AdminDashboard: React.FC = () => {
  const { session, isPlatformAdmin, loading } = useAuth();
  
  // Form State
  const [businessName, setBusinessName] = useState('');
  const [tier, setTier] = useState('standard');
  const [region, setRegion] = useState('IN');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Dropdown & Expand State
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [expandedTenantId, setExpandedTenantId] = useState<string | null>(null);

  // Modals State
  const [bspModalTenantId, setBspModalTenantId] = useState<string | null>(null);
  const [quotaModalTenant, setQuotaModalTenant] = useState<any | null>(null);
  
  const [bspForm, setBspForm] = useState({ provider: 'interakt', waba_id: '', phone_id: '', api_key: '' });
  const [savingBsp, setSavingBsp] = useState(false);
  
  const [newQuota, setNewQuota] = useState<number>(0);
  const [savingQuota, setSavingQuota] = useState(false);

  // Data Fetching
  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/admin/metrics`, {
        headers: { 'Authorization': `Bearer ${session!.access_token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch metrics');
      return res.json();
    },
    enabled: !!session?.access_token && isPlatformAdmin,
  });

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

  const { data: bspConfig, isLoading: loadingBsp } = useQuery({
    queryKey: ['admin-bsp', bspModalTenantId],
    queryFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/admin/tenants/${bspModalTenantId}/bsp`, {
        headers: { 'Authorization': `Bearer ${session!.access_token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch BSP config');
      return res.json();
    },
    enabled: !!bspModalTenantId && !!session?.access_token,
  });

  useEffect(() => {
    if (bspConfig) {
      setBspForm({
        provider: bspConfig.bsp_provider || 'interakt',
        waba_id: bspConfig.waba_id || '',
        phone_id: bspConfig.phone_number_id || '',
        api_key: '' 
      });
    } else if (bspModalTenantId && !loadingBsp) {
      setBspForm({ provider: 'interakt', waba_id: '', phone_id: '', api_key: '' });
    }
  }, [bspConfig, bspModalTenantId, loadingBsp]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.action-dropdown-container')) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setSubmitting(true);
    setError('');
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/admin/tenants`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ business_name: businessName, tier, region })
      });
      
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Provisioning failed');
      }
      
      setBusinessName('');
      refetch();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveBsp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bspModalTenantId || !session) return;
    setSavingBsp(true);
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/admin/tenants/${bspModalTenantId}/bsp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          bsp_provider: bspForm.provider,
          waba_id: bspForm.waba_id,
          phone_number_id: bspForm.phone_id,
          api_key: bspForm.api_key
        })
      });
      
      if (!res.ok) throw new Error('API Error');
      alert('BSP Configuration saved successfully!');
      setBspForm(prev => ({ ...prev, api_key: '' }));
      setBspModalTenantId(null);
    } catch (err) {
      alert('Failed to save BSP configuration.');
    } finally {
      setSavingBsp(false);
    }
  };

  const handleUpdateQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quotaModalTenant || !session) return;
    setSavingQuota(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/admin/tenants/${quotaModalTenant.id}/quota`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ cap_messages: newQuota })
      });
      
      if (!res.ok) throw new Error('API Error');
      
      setQuotaModalTenant(null);
      refetch();
    } catch (err) {
      alert('Failed to update quota.');
    } finally {
      setSavingQuota(false);
    }
  };

  const handleToggleStatus = async (tenantId: string, currentStatus: string) => {
    if (!session) return;
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const action = newStatus === 'suspended' ? 'suspend' : 'activate';
    
    if (!window.confirm(`Are you sure you want to ${action} this tenant?`)) return;

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/admin/tenants/${tenantId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!res.ok) throw new Error('API Error');
      refetch();
    } catch (err) {
      alert(`Failed to ${action} tenant.`);
    }
    setOpenDropdownId(null);
  };

  if (loading || fetching || loadingMetrics) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent"></div>
      </div>
    );
  }
  
  if (!isPlatformAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-8 relative max-w-7xl mx-auto">
      <div className="border-b border-theme-border pb-4">
        <h1 className="text-3xl font-display font-bold text-theme-text flex items-center">
          <Server className="mr-3 h-8 w-8 text-brand-accent" />
          Platform Administration
        </h1>
        <p className="text-theme-text-muted mt-2 text-lg font-medium">Global view across all isolated tenants and SaaS KPIs.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="theme-card p-6 bg-theme-surface flex items-center shadow-sm hover:shadow-md transition-shadow">
          <div className="p-4 bg-brand-accent/10 text-brand-accent rounded-full mr-4">
            <TrendingUp size={28} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-theme-text-muted text-sm font-bold uppercase tracking-wider mb-1">Total MRR</div>
            <div className="text-3xl font-mono font-bold text-theme-text">
              ₹{metrics?.mrr?.toLocaleString() || '0'}
            </div>
          </div>
        </div>
        
        <div className="theme-card p-6 bg-theme-surface flex items-center shadow-sm hover:shadow-md transition-shadow">
          <div className="p-4 bg-blue-500/10 text-blue-500 rounded-full mr-4">
            <MessageSquare size={28} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-theme-text-muted text-sm font-bold uppercase tracking-wider mb-1">Volume (This Month)</div>
            <div className="text-3xl font-mono font-bold text-theme-text">
              {metrics?.volume?.toLocaleString() || '0'}
            </div>
          </div>
        </div>

        <div className="theme-card p-6 bg-theme-surface flex items-center shadow-sm hover:shadow-md transition-shadow">
          <div className="p-4 bg-purple-500/10 text-purple-500 rounded-full mr-4">
            <Building size={28} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-theme-text-muted text-sm font-bold uppercase tracking-wider mb-1">Active Workspaces</div>
            <div className="text-3xl font-mono font-bold text-theme-text">
              {metrics?.activeTenants?.toLocaleString() || '0'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 theme-card p-6 bg-theme-surface">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-display font-bold flex items-center text-theme-text">
              <Users className="mr-2 h-5 w-5 text-brand-accent" /> Tenant Directory
            </h2>
          </div>
          
          <div className="overflow-x-auto rounded-lg border border-theme-border">
            <table className="w-full text-left border-collapse bg-theme-bg">
              <thead>
                <tr className="border-b border-theme-border bg-theme-surface-hover">
                  <th className="py-3 px-4 font-bold text-sm text-theme-text-muted uppercase tracking-wider border-r border-theme-border">Tenant</th>
                  <th className="py-3 px-4 font-bold text-sm text-theme-text-muted uppercase tracking-wider border-r border-theme-border">Plan</th>
                  <th className="py-3 px-4 font-bold text-sm text-theme-text-muted uppercase tracking-wider border-r border-theme-border">Status</th>
                  <th className="py-3 px-4 font-bold text-sm text-theme-text-muted uppercase tracking-wider border-r border-theme-border">Monthly Usage</th>
                  <th className="py-3 px-4 font-bold text-sm text-theme-text-muted uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border">
                {tenants.map((t) => {
                  const sub = t.subscriptions?.[0];
                  const cap = sub?.cap_messages || 0;
                  const used = t.usage_tracking?.messages_sent || 0;
                  const usagePercent = cap > 0 ? Math.min(Math.round((used / cap) * 100), 100) : 0;
                  
                  return (
                    <React.Fragment key={t.id}>
                      <tr 
                        className={cn(
                          "hover:bg-theme-surface-hover transition-colors cursor-pointer",
                          expandedTenantId === t.id && "bg-theme-surface-hover"
                        )}
                        onClick={() => setExpandedTenantId(expandedTenantId === t.id ? null : t.id)}
                      >
                        <td className="py-3 px-4 border-r border-theme-border flex items-center">
                          {expandedTenantId === t.id ? <ChevronUp className="w-4 h-4 mr-2 text-brand-accent" /> : <ChevronDown className="w-4 h-4 mr-2 text-theme-text-muted" />}
                          <div>
                            <div className="font-bold text-theme-text">{t.business_name}</div>
                            <div className="font-mono text-[10px] text-theme-text-muted">{t.id.substring(0,8)} • {t.region}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm uppercase font-bold text-theme-text-muted border-r border-theme-border">
                          {t.tier}
                        </td>
                        <td className="py-3 px-4 border-r border-theme-border">
                          <span className={cn(
                            "px-2 py-1 text-[10px] font-bold uppercase border",
                            t.status === 'active' ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"
                          )} style={{ borderRadius: 'var(--radius-button)' }}>
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 border-r border-theme-border">
                          <div className="flex justify-between text-xs font-mono text-theme-text-muted mb-1">
                            <span>{used.toLocaleString()}</span>
                            <span>{cap.toLocaleString()}</span>
                          </div>
                          <div className="w-full bg-theme-surface h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                usagePercent >= 100 ? "bg-red-500" : (usagePercent > 80 ? "bg-brand-orange" : "bg-brand-accent")
                              )}
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center action-dropdown-container relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(openDropdownId === t.id ? null : t.id);
                            }}
                            className="p-2 text-theme-text-muted hover:text-brand-accent transition-colors theme-button rounded-full hover:bg-brand-accent/10 inline-flex items-center justify-center"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>
                          
                          {openDropdownId === t.id && (
                            <div className="absolute right-8 top-10 w-48 bg-theme-surface border border-theme-border shadow-xl z-10 py-1" style={{ borderRadius: 'var(--radius-card)' }}>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setQuotaModalTenant(t); setNewQuota(cap); setOpenDropdownId(null); }}
                                className="w-full text-left px-4 py-2 text-sm font-bold text-theme-text hover:bg-theme-surface-hover flex items-center"
                              >
                                <Edit3 className="w-4 h-4 mr-2 text-brand-orange" /> Edit Quota
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setBspModalTenantId(t.id); setOpenDropdownId(null); }}
                                className="w-full text-left px-4 py-2 text-sm font-bold text-theme-text hover:bg-theme-surface-hover flex items-center"
                              >
                                <Settings className="w-4 h-4 mr-2 text-brand-accent" /> Configure BSP
                              </button>
                              <div className="h-px bg-theme-border my-1" />
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleToggleStatus(t.id, t.status); }}
                                className={cn(
                                  "w-full text-left px-4 py-2 text-sm font-bold flex items-center hover:bg-theme-surface-hover",
                                  t.status === 'active' ? "text-red-500" : "text-green-500"
                                )}
                              >
                                {t.status === 'active' ? (
                                  <><Power className="w-4 h-4 mr-2" /> Suspend Tenant</>
                                ) : (
                                  <><CheckCircle2 className="w-4 h-4 mr-2" /> Activate Tenant</>
                                )}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {/* Expanded View */}
                      {expandedTenantId === t.id && (
                        <tr className="bg-theme-surface-hover border-b border-theme-border">
                          <td colSpan={5} className="p-0">
                            <div className="p-6 bg-brand-accent/5 border-t border-theme-border grid grid-cols-1 md:grid-cols-3 gap-6 shadow-inner">
                              
                              {/* Team Overview */}
                              <div className="bg-theme-bg p-4 rounded-lg border border-theme-border">
                                <h4 className="text-xs font-bold uppercase text-theme-text-muted mb-3 flex items-center">
                                  <User className="w-4 h-4 mr-1" /> Team Size
                                </h4>
                                <div className="text-2xl font-display font-bold text-theme-text">
                                  {t.users_count || 0}
                                </div>
                                <div className="text-xs text-theme-text-muted mt-1">Active users in workspace</div>
                              </div>

                              {/* Subscription Info */}
                              <div className="bg-theme-bg p-4 rounded-lg border border-theme-border">
                                <h4 className="text-xs font-bold uppercase text-theme-text-muted mb-3 flex items-center">
                                  <CreditCard className="w-4 h-4 mr-1" /> Financials
                                </h4>
                                <div className="text-2xl font-mono font-bold text-brand-accent">
                                  ₹{sub?.price_inr?.toLocaleString() || '0'}
                                </div>
                                <div className="text-xs text-theme-text-muted mt-1 uppercase font-bold tracking-wide">
                                  {sub?.plan || 'N/A'} Plan
                                </div>
                              </div>

                              {/* Dates & Cycle */}
                              <div className="bg-theme-bg p-4 rounded-lg border border-theme-border">
                                <h4 className="text-xs font-bold uppercase text-theme-text-muted mb-3 flex items-center">
                                  <Calendar className="w-4 h-4 mr-1" /> Billing Cycle
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-theme-text-muted">Last Renewed:</span>
                                    <span className="font-mono font-bold text-theme-text">
                                      {sub?.renewed_at ? new Date(sub.renewed_at).toLocaleDateString() : 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-theme-text-muted">Next Billing:</span>
                                    <span className="font-mono font-bold text-theme-text">
                                      {sub?.renewed_at ? (() => {
                                        const d = new Date(sub.renewed_at);
                                        d.setMonth(d.getMonth() + 1);
                                        return d.toLocaleDateString();
                                      })() : 'N/A'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {tenants.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-theme-text-muted italic bg-theme-bg">No tenants found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="theme-card p-6 self-start bg-brand-accent/5 border-brand-accent/20">
          <h2 className="text-xl font-display font-bold flex items-center text-theme-text mb-6">
            <PlusCircle className="mr-2 h-5 w-5 text-brand-accent" /> Provision Tenant
          </h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border-l-4 border-red-500 text-red-500 text-sm font-bold" style={{ borderRadius: 'var(--radius-card)' }}>
              {error}
            </div>
          )}
          
          <form onSubmit={handleProvision} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-theme-text-muted mb-1">Business Name</label>
              <input 
                type="text" 
                value={businessName} 
                onChange={e => setBusinessName(e.target.value)} 
                placeholder="Acme Corp"
                required 
                className="w-full px-4 py-3 border border-theme-border bg-theme-bg text-theme-text focus:border-brand-accent focus:outline-none transition-colors theme-button"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-theme-text-muted mb-1">Service Tier</label>
              <select 
                value={tier} 
                onChange={e => setTier(e.target.value)}
                className="w-full px-4 py-3 border border-theme-border bg-theme-bg text-theme-text focus:border-brand-accent focus:outline-none transition-colors theme-button font-bold"
              >
                <option value="standard">Standard / Growth</option>
                <option value="vip">VIP / Enterprise</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-theme-text-muted mb-1">Region</label>
              <select 
                value={region} 
                onChange={e => setRegion(e.target.value)}
                className="w-full px-4 py-3 border border-theme-border bg-theme-bg text-theme-text focus:border-brand-accent focus:outline-none transition-colors theme-button font-bold"
              >
                <option value="IN">India (IN)</option>
                <option value="US">United States (US)</option>
                <option value="EU">Europe (EU)</option>
              </select>
            </div>
            
            <button 
              type="submit" 
              disabled={submitting}
              className="w-full mt-6 px-4 py-3 bg-brand-accent text-white font-bold tracking-wide hover:bg-brand-accent-light disabled:opacity-50 transition-colors theme-button shadow-md"
            >
              {submitting ? 'PROVISIONING...' : 'CREATE TENANT'}
            </button>
          </form>
        </div>
      </div>

      {/* Quota Modal */}
      {quotaModalTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="theme-card p-8 w-full max-w-sm relative">
            <h2 className="text-xl font-display font-bold text-theme-text mb-2 flex items-center">
              <Edit3 className="mr-2 text-brand-orange w-5 h-5" /> Override Quota
            </h2>
            <p className="text-sm text-theme-text-muted mb-6">
              Update the message cap for <span className="text-brand-accent font-bold">{quotaModalTenant.business_name}</span>.
            </p>

            <form onSubmit={handleUpdateQuota}>
              <div className="mb-6">
                <label className="block text-sm font-bold text-theme-text-muted mb-2">Monthly Message Cap</label>
                <input 
                  type="number"
                  min="0"
                  step="100"
                  value={newQuota}
                  onChange={e => setNewQuota(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 border border-theme-border bg-theme-bg text-theme-text focus:border-brand-accent focus:outline-none transition-colors theme-button font-mono text-lg"
                />
              </div>

              <div className="flex gap-4">
                <button 
                  type="button" 
                  onClick={() => setQuotaModalTenant(null)}
                  className="flex-1 px-4 py-3 font-bold text-theme-text-muted hover:text-theme-text border border-theme-border hover:bg-theme-surface-hover theme-button transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={savingQuota}
                  className="flex-1 px-6 py-3 bg-brand-orange text-white font-bold hover:bg-brand-orange/90 disabled:opacity-50 theme-button shadow-md transition-colors"
                >
                  {savingQuota ? 'Saving...' : 'Save Quota'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BSP Config Modal */}
      {bspModalTenantId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="theme-card p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto relative">
            <div className="flex justify-between items-center mb-6 border-b border-theme-border pb-4">
              <h2 className="text-2xl font-display font-bold text-theme-text">Configure BSP</h2>
              <button onClick={() => setBspModalTenantId(null)} className="p-1 text-theme-text-muted hover:text-theme-text transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            {loadingBsp ? (
              <div className="text-theme-text-muted py-4 font-medium text-center">Loading configuration...</div>
            ) : (
              <form onSubmit={handleSaveBsp} className="space-y-4">
                <div>
                  <label className="block font-bold mb-1 text-theme-text-muted text-sm">Provider</label>
                  <select 
                    value={bspForm.provider}
                    onChange={e => setBspForm({...bspForm, provider: e.target.value})}
                    className="w-full p-3 border border-theme-border bg-theme-bg text-theme-text focus:border-brand-accent focus:outline-none theme-button font-bold"
                  >
                    <option value="meta">Meta Cloud API</option>
                    <option value="gupshup">Gupshup</option>
                    <option value="interakt">Interakt</option>
                    <option value="wati">WATI</option>
                  </select>
                </div>
                
                <div>
                  <label className="block font-bold mb-1 text-theme-text-muted text-sm">WABA ID</label>
                  <input 
                    type="text" 
                    required
                    value={bspForm.waba_id}
                    onChange={e => setBspForm({...bspForm, waba_id: e.target.value})}
                    placeholder="e.g. 10934892837" 
                    className="w-full p-3 border border-theme-border bg-theme-bg text-theme-text focus:border-brand-accent focus:outline-none theme-button font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1 text-theme-text-muted text-sm">Phone Number ID</label>
                  <input 
                    type="text" 
                    required
                    value={bspForm.phone_id}
                    onChange={e => setBspForm({...bspForm, phone_id: e.target.value})}
                    placeholder="e.g. 10582930291" 
                    className="w-full p-3 border border-theme-border bg-theme-bg text-theme-text focus:border-brand-accent focus:outline-none theme-button font-mono text-sm"
                  />
                </div>
                
                <div>
                  <label className="block font-bold mb-1 text-theme-text-muted text-sm">API Key / Access Token</label>
                  <input 
                    type="password" 
                    value={bspForm.api_key}
                    onChange={e => setBspForm({...bspForm, api_key: e.target.value})}
                    placeholder={bspConfig ? "••••••••••••••••••••••••" : "Paste your API key here"} 
                    className="w-full p-3 border border-theme-border bg-theme-bg text-theme-text focus:border-brand-accent focus:outline-none theme-button font-mono text-sm"
                  />
                  <p className="text-xs text-theme-text-muted mt-2 font-medium">
                    {bspConfig ? "Stored securely. Leave blank to keep current key." : "Required for initial setup."}
                  </p>
                </div>
                
                {bspConfig?.webhook_verify_token && (
                  <div className="bg-theme-bg p-4 border border-theme-border mt-4" style={{ borderRadius: 'var(--radius-card)' }}>
                    <label className="block text-xs font-bold uppercase text-theme-text-muted mb-2">Webhook Verify Token</label>
                    <code className="text-brand-accent font-mono text-sm break-all font-bold">{bspConfig.webhook_verify_token}</code>
                    <p className="text-xs text-theme-text-muted mt-2 font-medium">Configure this token in your BSP dashboard.</p>
                  </div>
                )}

                <div className="pt-6 mt-6 border-t border-theme-border flex gap-4">
                  <button 
                    type="button" 
                    onClick={() => setBspModalTenantId(null)}
                    className="flex-1 px-4 py-3 font-bold text-theme-text-muted hover:text-theme-text border border-theme-border hover:bg-theme-surface-hover theme-button transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={savingBsp}
                    className="flex-1 px-6 py-3 bg-brand-accent text-white font-bold hover:bg-brand-accent-light disabled:opacity-50 theme-button shadow-md transition-colors"
                  >
                    {savingBsp ? 'Saving...' : 'Save Config'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
