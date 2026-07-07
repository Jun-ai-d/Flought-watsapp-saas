import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Users, Shield, User, Trash2, PlusCircle, X } from 'lucide-react';
import { cn } from '../../lib/utils';

const AdminUsers: React.FC = () => {
  const { session, isPlatformAdmin, loading } = useAuth();

  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [provisionForm, setProvisionForm] = useState({ email: '', password: '', tenant_id: '', role: 'agent' });
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState('');

  const { data: users = [], isLoading: fetchingUsers, refetch: refetchUsers } = useQuery<any[]>({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${session!.access_token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch platform users');
      return res.json();
    },
    enabled: !!session?.access_token && isPlatformAdmin,
  });

  const { data: tenants = [], isLoading: fetchingTenants } = useQuery<any[]>({
    queryKey: ['admin-tenants-list'],
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

  if (loading || fetchingUsers || fetchingTenants) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent"></div>
      </div>
    );
  }
  
  if (!isPlatformAdmin) return <Navigate to="/dashboard" replace />;

  const adminsCount = users.filter(u => u.role === 'admin').length;
  const agentsCount = users.filter(u => u.role === 'agent').length;

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setProvisioning(true);
    setError('');
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(provisionForm)
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to provision user');
      }
      
      refetchUsers();
      setShowProvisionModal(false);
      setProvisionForm({ email: '', password: '', tenant_id: '', role: 'agent' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProvisioning(false);
    }
  };

  const handleRevoke = async (userId: string) => {
    if (!session) return;
    if (!window.confirm("Are you sure you want to completely revoke this user's access? This will delete their Auth record.")) return;
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (!res.ok) throw new Error('Failed to revoke access');
      refetchUsers();
    } catch (err) {
      alert("Failed to revoke user access.");
    }
  };

  return (
    <div className="space-y-8 relative max-w-7xl mx-auto text-theme-text">
      <div className="border-b border-theme-border pb-4">
        <h1 className="text-3xl font-bold text-theme-text flex items-center tracking-tight">
          <Users className="mr-3 h-8 w-8 text-brand-accent" />
          Platform Users
        </h1>
        <p className="text-theme-text-muted mt-2 text-lg font-medium">Global audit of all users across all provisioned workspaces.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-theme-surface border border-theme-border rounded flex items-center shadow-sm hover:shadow-md transition-shadow border-t-4 border-t-indigo-500">
          <div className="p-4 bg-indigo-500/10 text-brand-accent rounded mr-4 border border-indigo-500/20">
            <Users size={28} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-theme-text-muted text-xs font-bold uppercase tracking-wider mb-1">Total Verified Users</div>
            <div className="text-3xl font-mono font-bold text-theme-text">
              {users.length.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="p-6 bg-theme-surface border border-theme-border rounded flex items-center shadow-sm hover:shadow-md transition-shadow border-t-4 border-t-amber-500">
          <div className="p-4 bg-amber-500/10 text-amber-500 rounded mr-4 border border-amber-500/20">
            <Shield size={28} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-theme-text-muted text-xs font-bold uppercase tracking-wider mb-1">Tenant Admins</div>
            <div className="text-3xl font-mono font-bold text-theme-text">
              {adminsCount.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="p-6 bg-theme-surface border border-theme-border rounded flex items-center shadow-sm hover:shadow-md transition-shadow border-t-4 border-t-sky-500">
          <div className="p-4 bg-sky-500/10 text-sky-500 rounded mr-4 border border-sky-500/20">
            <User size={28} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-theme-text-muted text-xs font-bold uppercase tracking-wider mb-1">Agents</div>
            <div className="text-3xl font-mono font-bold text-theme-text">
              {agentsCount.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 bg-theme-surface border border-theme-border rounded">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center text-theme-text">
            Global User Directory
          </h2>
          <button 
            onClick={() => setShowProvisionModal(true)}
            className="px-4 py-2 bg-indigo-600 text-theme-text font-bold text-sm hover:bg-indigo-500 transition-colors rounded flex items-center shadow-md shadow-indigo-900/20"
          >
            <PlusCircle className="w-4 h-4 mr-2" /> Provision User
          </button>
        </div>
        
        <div className="overflow-x-auto rounded border border-theme-border">
          <table className="w-full text-left border-collapse bg-theme-bg">
            <thead>
              <tr className="border-b border-theme-border bg-theme-surface/50">
                <th className="py-3 px-4 font-bold text-sm text-theme-text-muted uppercase tracking-wider border-r border-theme-border">User ID (Auth)</th>
                <th className="py-3 px-4 font-bold text-sm text-theme-text-muted uppercase tracking-wider border-r border-theme-border">Workspace</th>
                <th className="py-3 px-4 font-bold text-sm text-theme-text-muted uppercase tracking-wider border-r border-theme-border">Workspace Role</th>
                <th className="py-3 px-4 font-bold text-sm text-theme-text-muted uppercase tracking-wider border-r border-theme-border">Workspace Quota</th>
                <th className="py-3 px-4 font-bold text-sm text-theme-text-muted uppercase tracking-wider border-r border-theme-border">Joined</th>
                <th className="py-3 px-4 font-bold text-sm text-theme-text-muted uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {users.map((u) => {
                const cap = u.tenant?.subscriptions?.[0]?.cap_messages || 0;
                const used = u.tenant?.usage_tracking?.messages_sent || 0;
                const usagePercent = cap > 0 ? Math.min((used / cap) * 100, 100) : 0;
                
                return (
                <tr key={u.id} className="hover:bg-theme-surface transition-colors">
                  <td className="py-3 px-4 border-r border-theme-border">
                    <div className="font-mono text-sm text-theme-text font-bold">{u.user_id.substring(0,18)}...</div>
                  </td>
                  <td className="py-3 px-4 border-r border-theme-border">
                    <div className="font-bold text-theme-text">{u.tenant?.business_name || 'N/A'}</div>
                    <div className="text-xs uppercase font-bold text-theme-text-muted mt-1">{u.tenant?.tier}</div>
                  </td>
                  <td className="py-3 px-4 border-r border-theme-border">
                    <span className={cn(
                      "px-2 py-1 text-[10px] font-bold uppercase border rounded",
                      u.role === 'admin' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-sky-500/10 text-sky-500 border-sky-500/20"
                    )}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 border-r border-theme-border min-w-[150px]">
                    <div className="flex justify-between text-[10px] font-mono text-theme-text-muted mb-1 font-bold">
                      <span>{used.toLocaleString()}</span>
                      <span>{cap.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-theme-bg h-1.5 rounded-full overflow-hidden border border-theme-border">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          usagePercent >= 100 ? "bg-rose-500" : (usagePercent > 80 ? "bg-amber-500" : "bg-indigo-500")
                        )}
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-sm text-theme-text border-r border-theme-border h-full min-h-[50px]">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button 
                      onClick={() => handleRevoke(u.user_id)}
                      className="p-2 text-theme-text-muted hover:text-rose-500 transition-colors rounded-full hover:bg-rose-500/10 inline-flex"
                      title="Revoke Access (Delete User)"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-theme-text-muted italic bg-theme-surface">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision User Modal */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="p-8 bg-theme-surface border border-theme-border rounded w-full max-w-md relative">
            <div className="flex justify-between items-center mb-6 border-b border-theme-border pb-4">
              <h2 className="text-xl font-bold text-theme-text flex items-center tracking-tight">
                <PlusCircle className="mr-2 text-brand-accent w-5 h-5" /> Provision User
              </h2>
              <button onClick={() => setShowProvisionModal(false)} className="p-1 text-theme-text-muted hover:text-theme-text transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleProvision} className="space-y-5">
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded text-sm font-bold">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-bold text-theme-text-muted mb-2">Email Address</label>
                <input 
                  type="email" 
                  value={provisionForm.email}
                  onChange={e => setProvisionForm({...provisionForm, email: e.target.value})}
                  className="w-full bg-theme-bg border border-theme-border text-theme-text rounded px-4 py-3 focus:outline-none focus:border-indigo-500 transition-all font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-theme-text-muted mb-2">Temporary Password</label>
                <input 
                  type="password" 
                  value={provisionForm.password}
                  onChange={e => setProvisionForm({...provisionForm, password: e.target.value})}
                  className="w-full bg-theme-bg border border-theme-border text-theme-text rounded px-4 py-3 focus:outline-none focus:border-indigo-500 transition-all font-mono"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-theme-text-muted mb-2">Assign to Workspace (Tenant)</label>
                <select 
                  value={provisionForm.tenant_id}
                  onChange={e => setProvisionForm({...provisionForm, tenant_id: e.target.value})}
                  className="w-full bg-theme-bg border border-theme-border text-theme-text rounded px-4 py-3 focus:outline-none focus:border-indigo-500 transition-all font-medium"
                  required
                >
                  <option value="" disabled>Select a workspace...</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.business_name} ({t.tier})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-theme-text-muted mb-2">Workspace Role</label>
                <select 
                  value={provisionForm.role}
                  onChange={e => setProvisionForm({...provisionForm, role: e.target.value})}
                  className="w-full bg-theme-bg border border-theme-border text-theme-text rounded px-4 py-3 focus:outline-none focus:border-indigo-500 transition-all font-medium"
                >
                  <option value="admin">Workspace Admin</option>
                  <option value="agent">Agent</option>
                </select>
              </div>

              <div className="pt-6 border-t border-theme-border flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  className="flex-1 px-4 py-3 font-bold text-theme-text-muted hover:text-theme-text border border-theme-border hover:bg-theme-surface-hover rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={provisioning || !provisionForm.tenant_id}
                  className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-theme-text font-bold rounded transition-colors disabled:opacity-50 flex items-center justify-center shadow-md"
                >
                  {provisioning ? 'Provisioning...' : 'Provision User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
