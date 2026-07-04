import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Server, Users, PlusCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

const AdminDashboard: React.FC = () => {
  const { session, isPlatformAdmin, loading } = useAuth();
  const [tenants, setTenants] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);

  // Form State
  const [businessName, setBusinessName] = useState('');
  const [tier, setTier] = useState('standard');
  const [region, setRegion] = useState('IN');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchTenants = async () => {
    if (!session) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/admin/tenants`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch tenants');
      const data = await res.json();
      setTenants(data);
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (isPlatformAdmin) {
      fetchTenants();
    }
  }, [isPlatformAdmin, session]);

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
      fetchTenants(); // Refresh list
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || fetching) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }
  
  if (!isPlatformAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-8">
      <div className="border-b-2 border-[#1A1A1A] pb-4">
        <h1 className="text-3xl font-display font-bold text-[#1A1A1A] flex items-center">
          <Server className="mr-3 h-8 w-8 text-purple-600" />
          Platform Administration
        </h1>
        <p className="text-[#666666] mt-2 text-lg">Global view across all isolated tenants.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 bg-white border-2 border-[#E5E5E5] p-6 hover:border-[#1A1A1A] transition-colors">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-display font-bold flex items-center">
              <Users className="mr-2 h-5 w-5" /> Active Tenants
            </h2>
            <div className="font-mono text-2xl font-bold text-purple-600">{tenants.length}</div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-[#E5E5E5]">
                  <th className="py-3 px-4 font-semibold text-sm text-[#666666]">Business Name</th>
                  <th className="py-3 px-4 font-semibold text-sm text-[#666666]">Region</th>
                  <th className="py-3 px-4 font-semibold text-sm text-[#666666]">Tier</th>
                  <th className="py-3 px-4 font-semibold text-sm text-[#666666]">Status</th>
                  <th className="py-3 px-4 font-semibold text-sm text-[#666666]">Joined</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t, idx) => (
                  <tr key={t.id} className={cn("border-b border-[#E5E5E5]", idx % 2 === 0 ? "bg-white" : "bg-gray-50")}>
                    <td className="py-3 px-4 font-bold text-[#1A1A1A]">{t.business_name}</td>
                    <td className="py-3 px-4 font-mono text-sm">{t.region}</td>
                    <td className="py-3 px-4 text-sm uppercase font-medium">{t.tier}</td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        "px-2 py-1 text-xs font-bold uppercase border-2",
                        t.status === 'active' ? "bg-green-100 text-green-700 border-green-700" : "bg-red-100 text-red-700 border-red-700"
                      )}>
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-[#666666]">{new Date(t.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {tenants.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#666666] italic">No tenants found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-purple-50 border-2 border-purple-600 p-6 self-start">
          <h2 className="text-xl font-display font-bold flex items-center text-purple-900 mb-6">
            <PlusCircle className="mr-2 h-5 w-5" /> Provision Tenant
          </h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 border-l-4 border-red-600 text-red-700 text-sm font-medium">
              {error}
            </div>
          )}
          
          <form onSubmit={handleProvision} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-purple-900 mb-1">Business Name</label>
              <input 
                type="text" 
                value={businessName} 
                onChange={e => setBusinessName(e.target.value)} 
                placeholder="Acme Corp"
                required 
                className="w-full px-4 py-2 border-2 border-purple-200 focus:border-purple-600 focus:outline-none transition-colors"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-purple-900 mb-1">Service Tier</label>
              <select 
                value={tier} 
                onChange={e => setTier(e.target.value)}
                className="w-full px-4 py-2 border-2 border-purple-200 focus:border-purple-600 focus:outline-none transition-colors bg-white"
              >
                <option value="standard">Standard / Growth</option>
                <option value="vip">VIP / Enterprise</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-bold text-purple-900 mb-1">Region</label>
              <select 
                value={region} 
                onChange={e => setRegion(e.target.value)}
                className="w-full px-4 py-2 border-2 border-purple-200 focus:border-purple-600 focus:outline-none transition-colors bg-white"
              >
                <option value="IN">India (IN)</option>
                <option value="US">United States (US)</option>
                <option value="EU">Europe (EU)</option>
              </select>
            </div>
            
            <button 
              type="submit" 
              disabled={submitting}
              className="w-full mt-6 px-4 py-3 bg-purple-600 text-white font-bold tracking-wide hover:bg-purple-700 disabled:opacity-50 transition-colors border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-purple-600 focus:ring-offset-2"
            >
              {submitting ? 'PROVISIONING...' : 'CREATE TENANT'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
