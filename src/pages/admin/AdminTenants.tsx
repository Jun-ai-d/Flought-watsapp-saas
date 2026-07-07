import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { BSP_PROVIDERS, DEFAULT_BSP_PROVIDER } from '../../lib/bspProviders';
import { 
  Users, PlusCircle, Settings, X, 
  Building,
  MoreVertical, Power, Edit3, CheckCircle2,
  ChevronDown, ChevronUp, User, CreditCard, Calendar
} from 'lucide-react';
import { cn } from '../../lib/utils';

const AdminTenants: React.FC = () => {
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
  
  const [bspForm, setBspForm] = useState({ provider: DEFAULT_BSP_PROVIDER, waba_id: '', phone_id: '', api_key: '' });
  const [savingBsp, setSavingBsp] = useState(false);
  
  const [newQuota, setNewQuota] = useState<number>(0);
  const [savingQuota, setSavingQuota] = useState(false);

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
        provider: bspConfig.bsp_provider || DEFAULT_BSP_PROVIDER,
        waba_id: bspConfig.waba_id || '',
        phone_id: bspConfig.phone_number_id || '',
        api_key: '' 
      });
    } else if (bspModalTenantId && !loadingBsp) {
      setBspForm({ provider: DEFAULT_BSP_PROVIDER, waba_id: '', phone_id: '', api_key: '' });
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

  if (loading || fetching) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent"></div>
      </div>
    );
  }
  
  if (!isPlatformAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-8 relative max-w-7xl mx-auto text-slate-200">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-3xl font-bold text-slate-100 flex items-center tracking-tight">
          <Building className="mr-3 h-8 w-8 text-indigo-500" />
          Tenant Directory
        </h1>
        <p className="text-slate-400 mt-2 text-lg font-medium">Manage workspaces, enforce quotas, and configure BSP settings.</p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <div className="p-6 bg-slate-900 border border-slate-800 rounded shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center text-slate-100">
              <Users className="mr-2 h-5 w-5 text-indigo-500" /> Workspaces
            </h2>
          </div>
          
          <div className="overflow-x-auto rounded border border-slate-800">
            <table className="w-full text-left border-collapse bg-slate-950">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50">
                  <th className="py-3 px-4 font-bold text-sm text-slate-500 uppercase tracking-wider border-r border-slate-800">Tenant</th>
                  <th className="py-3 px-4 font-bold text-sm text-slate-500 uppercase tracking-wider border-r border-slate-800">Plan</th>
                  <th className="py-3 px-4 font-bold text-sm text-slate-500 uppercase tracking-wider border-r border-slate-800">Status</th>
                  <th className="py-3 px-4 font-bold text-sm text-slate-500 uppercase tracking-wider border-r border-slate-800">Monthly Usage</th>
                  <th className="py-3 px-4 font-bold text-sm text-slate-500 uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {tenants.map((t) => {
                  const sub = t.subscriptions?.[0];
                  const cap = sub?.cap_messages || 0;
                  const used = t.usage_tracking?.messages_sent || 0;
                  const usagePercent = cap > 0 ? Math.min(Math.round((used / cap) * 100), 100) : 0;
                  
                  return (
                    <React.Fragment key={t.id}>
                      <tr 
                        className={cn(
                          "hover:bg-slate-900 transition-colors cursor-pointer",
                          expandedTenantId === t.id && "bg-slate-900"
                        )}
                        onClick={() => setExpandedTenantId(expandedTenantId === t.id ? null : t.id)}
                      >
                        <td className="py-3 px-4 border-r border-slate-800 flex items-center">
                          {expandedTenantId === t.id ? <ChevronUp className="w-4 h-4 mr-2 text-indigo-500" /> : <ChevronDown className="w-4 h-4 mr-2 text-slate-500" />}
                          <div>
                            <div className="font-bold text-slate-200">{t.business_name}</div>
                            <div className="font-mono text-[10px] text-slate-500">{t.id.substring(0,8)} • {t.region}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm uppercase font-bold text-slate-400 border-r border-slate-800">
                          {t.tier}
                        </td>
                        <td className="py-3 px-4 border-r border-slate-800">
                          <span className={cn(
                            "px-2 py-1 text-[10px] font-bold uppercase border rounded",
                            t.status === 'active' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                          )}>
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 border-r border-slate-800">
                          <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
                            <span>{used.toLocaleString()}</span>
                            <span>{cap.toLocaleString()}</span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                usagePercent >= 100 ? "bg-rose-500" : (usagePercent > 80 ? "bg-amber-500" : "bg-indigo-500")
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
                            className="p-2 text-slate-500 hover:text-indigo-400 transition-colors rounded-full hover:bg-indigo-500/10 inline-flex items-center justify-center"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>
                          
                          {openDropdownId === t.id && (
                            <div className="absolute right-8 top-10 w-48 bg-slate-900 border border-slate-800 rounded shadow-xl z-10 py-1">
                              <button 
                                onClick={(e) => { e.stopPropagation(); setQuotaModalTenant(t); setNewQuota(cap); setOpenDropdownId(null); }}
                                className="w-full text-left px-4 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800 flex items-center"
                              >
                                <Edit3 className="w-4 h-4 mr-2 text-amber-500" /> Edit Quota
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setBspModalTenantId(t.id); setOpenDropdownId(null); }}
                                className="w-full text-left px-4 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800 flex items-center"
                              >
                                <Settings className="w-4 h-4 mr-2 text-indigo-400" /> Configure BSP
                              </button>
                              <div className="h-px bg-slate-800 my-1" />
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleToggleStatus(t.id, t.status); }}
                                className={cn(
                                  "w-full text-left px-4 py-2 text-sm font-bold flex items-center hover:bg-slate-800",
                                  t.status === 'active' ? "text-rose-500" : "text-emerald-500"
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
                        <tr className="bg-slate-900 border-b border-slate-800">
                          <td colSpan={5} className="p-0">
                            <div className="p-6 bg-slate-950/50 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-inner">
                              
                              {/* Team Overview */}
                              <div className="bg-slate-900 p-4 rounded border border-slate-800">
                                <h4 className="text-xs font-bold uppercase text-slate-500 mb-3 flex items-center">
                                  <User className="w-4 h-4 mr-1" /> Team Size
                                </h4>
                                <div className="text-2xl font-bold text-slate-200">
                                  {t.users_count || 0}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">Active users in workspace</div>
                              </div>

                              {/* Subscription Info */}
                              <div className="bg-slate-900 p-4 rounded border border-slate-800">
                                <h4 className="text-xs font-bold uppercase text-slate-500 mb-3 flex items-center">
                                  <CreditCard className="w-4 h-4 mr-1" /> Financials
                                </h4>
                                <div className="text-2xl font-mono font-bold text-indigo-400">
                                  ₹{sub?.price_inr?.toLocaleString() || '0'}
                                </div>
                                <div className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-wide">
                                  {sub?.plan || 'N/A'} Plan
                                </div>
                              </div>

                              {/* Dates & Cycle */}
                              <div className="bg-slate-900 p-4 rounded border border-slate-800">
                                <h4 className="text-xs font-bold uppercase text-slate-500 mb-3 flex items-center">
                                  <Calendar className="w-4 h-4 mr-1" /> Billing Cycle
                                </h4>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Last Renewed:</span>
                                    <span className="font-mono font-bold text-slate-200">
                                      {sub?.renewed_at ? new Date(sub.renewed_at).toLocaleDateString() : 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Next Billing:</span>
                                    <span className="font-mono font-bold text-slate-200">
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
                    <td colSpan={5} className="py-8 text-center text-slate-500 italic bg-slate-900">No tenants found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-6 self-start bg-slate-900 border border-slate-800 rounded">
          <h2 className="text-xl font-bold flex items-center text-slate-100 mb-6">
            <PlusCircle className="mr-2 h-5 w-5 text-indigo-500" /> Provision Tenant
          </h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border-l-4 border-red-500 text-red-500 text-sm font-bold" style={{ borderRadius: 'var(--radius-card)' }}>
              {error}
            </div>
          )}
          
          <form onSubmit={handleProvision} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-1">Business Name</label>
              <input 
                type="text" 
                value={businessName} 
                onChange={e => setBusinessName(e.target.value)} 
                placeholder="Acme Corp"
                required 
                className="w-full px-4 py-3 border border-slate-700 bg-slate-950 text-slate-200 focus:border-indigo-500 focus:outline-none transition-colors rounded"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-1">Service Tier</label>
              <select 
                value={tier} 
                onChange={e => setTier(e.target.value)}
                className="w-full px-4 py-3 border border-slate-700 bg-slate-950 text-slate-200 focus:border-indigo-500 focus:outline-none transition-colors rounded font-bold"
              >
                <option value="standard">Standard / Growth</option>
                <option value="vip">VIP / Enterprise</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-1">Region</label>
              <select 
                value={region} 
                onChange={e => setRegion(e.target.value)}
                className="w-full px-4 py-3 border border-slate-700 bg-slate-950 text-slate-200 focus:border-indigo-500 focus:outline-none transition-colors rounded font-bold"
              >
                <option value="IN">India (IN)</option>
                <option value="US">United States (US)</option>
                <option value="EU">Europe (EU)</option>
              </select>
            </div>
            
            <button 
              type="submit" 
              disabled={submitting}
              className="w-full mt-6 px-4 py-3 bg-indigo-600 text-white font-bold tracking-wide hover:bg-indigo-500 disabled:opacity-50 transition-colors rounded shadow-md"
            >
              {submitting ? 'PROVISIONING...' : 'CREATE TENANT'}
            </button>
          </form>
        </div>
      </div>

      {/* Quota Modal */}
      {quotaModalTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="p-8 bg-slate-900 border border-slate-800 rounded w-full max-w-sm relative">
            <h2 className="text-xl font-bold text-slate-100 mb-2 flex items-center">
              <Edit3 className="mr-2 text-amber-500 w-5 h-5" /> Override Quota
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              Update the message cap for <span className="text-indigo-400 font-bold">{quotaModalTenant.business_name}</span>.
            </p>

            <form onSubmit={handleUpdateQuota}>
              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-500 mb-2">Monthly Message Cap</label>
                <input 
                  type="number"
                  min="0"
                  step="100"
                  value={newQuota}
                  onChange={e => setNewQuota(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-3 border border-slate-700 bg-slate-950 text-slate-200 focus:border-indigo-500 focus:outline-none transition-colors rounded font-mono text-lg"
                />
              </div>

              <div className="flex gap-4">
                <button 
                  type="button" 
                  onClick={() => setQuotaModalTenant(null)}
                  className="flex-1 px-4 py-3 font-bold text-slate-400 hover:text-slate-200 border border-slate-700 hover:bg-slate-800 rounded transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={savingQuota}
                  className="flex-1 px-6 py-3 bg-amber-600 text-white font-bold hover:bg-amber-500 disabled:opacity-50 rounded shadow-md transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="p-8 bg-slate-900 border border-slate-800 rounded w-full max-w-lg max-h-[90vh] overflow-y-auto relative">
            <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
              <h2 className="text-2xl font-bold text-slate-100">Configure BSP</h2>
              <button onClick={() => setBspModalTenantId(null)} className="p-1 text-slate-500 hover:text-slate-200 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            {loadingBsp ? (
              <div className="text-slate-500 py-4 font-medium text-center">Loading configuration...</div>
            ) : (
              <form onSubmit={handleSaveBsp} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">Provider</label>
                  <select 
                    value={bspForm.provider}
                    onChange={e => setBspForm(prev => ({ ...prev, provider: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded px-4 py-3 focus:outline-none focus:border-indigo-500 transition-all font-medium"
                    required
                  >
                    <option value="meta">Meta Cloud API</option>
                    <option value="gupshup">Gupshup</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">WABA ID</label>
                  <input 
                    type="text" 
                    value={bspForm.waba_id}
                    onChange={e => setBspForm(prev => ({ ...prev, waba_id: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded px-4 py-3 focus:outline-none focus:border-indigo-500 transition-all font-mono text-sm"
                    required
                    placeholder="e.g. 10492839281"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">Phone Number ID</label>
                  <input 
                    type="text" 
                    value={bspForm.phone_id}
                    onChange={e => setBspForm(prev => ({ ...prev, phone_id: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded px-4 py-3 focus:outline-none focus:border-indigo-500 transition-all font-mono text-sm"
                    required
                    placeholder="e.g. 2930291039"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">
                    Access Token / API Key
                    <span className="block text-xs font-normal text-slate-500 mt-1">Leave blank to keep existing. Will be encrypted at rest.</span>
                  </label>
                  <input 
                    type="password" 
                    value={bspForm.api_key}
                    onChange={e => setBspForm(prev => ({ ...prev, api_key: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded px-4 py-3 focus:outline-none focus:border-indigo-500 transition-all font-mono text-sm"
                    placeholder={bspConfig ? "••••••••••••••••" : "Enter new API key"}
                    required={!bspConfig}
                  />
                  <p className="text-xs text-slate-500 mt-2 font-medium">
                    {bspConfig ? "Stored securely. Leave blank to keep current key." : "Required for initial setup."}
                  </p>
                </div>
                
                {bspConfig?.webhook_verify_token && bspForm.provider !== 'meta' && (
                  <div className="bg-slate-950 p-4 border border-slate-800 rounded mt-4">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Webhook Verify Token (Gupshup)</label>
                    <code className="text-indigo-400 font-mono text-sm break-all font-bold">{bspConfig.webhook_verify_token}</code>
                    <p className="text-xs text-slate-500 mt-2 font-medium">Configure this token in your Gupshup dashboard.</p>
                  </div>
                )}

                {bspForm.provider === 'meta' && (
                  <div className="bg-slate-950 p-4 border border-blue-800 rounded mt-4">
                    <label className="block text-xs font-bold uppercase text-blue-400 mb-2">Meta Webhook Setup</label>
                    <p className="text-xs text-slate-400 font-medium">Meta uses a global <code className="text-blue-400">META_VERIFY_TOKEN</code> env var on the backend. Do not use the per-tenant token.</p>
                  </div>
                )}

                <div className="pt-6 mt-6 border-t border-slate-800 flex gap-4">
                  <button 
                    type="button" 
                    onClick={() => setBspModalTenantId(null)}
                    className="flex-1 px-4 py-3 font-bold text-slate-400 hover:text-slate-200 border border-slate-700 hover:bg-slate-800 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={savingBsp}
                    className="flex-1 px-6 py-3 bg-indigo-600 text-white font-bold hover:bg-indigo-500 disabled:opacity-50 rounded shadow-md transition-colors"
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

export default AdminTenants;
