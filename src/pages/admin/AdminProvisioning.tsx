import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { PlusCircle, Building } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

const AdminProvisioning: React.FC = () => {
  const { session, isPlatformAdmin, loading } = useAuth();
  const queryClient = useQueryClient();
  
  // Form State
  const [businessName, setBusinessName] = useState('');
  const [tier, setTier] = useState('standard');
  const [region, setRegion] = useState('IN');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
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
      setSuccess(`Successfully provisioned workspace!`);
      // Invalidate tenants query so it's fresh when navigating back to directory
      queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent"></div>
      </div>
    );
  }
  
  if (!isPlatformAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-8 relative max-w-3xl mx-auto">
      <div className="border-b border-theme-border pb-4">
        <h1 className="text-3xl font-display font-bold text-theme-text flex items-center">
          <PlusCircle className="mr-3 h-8 w-8 text-brand-accent" />
          Provision New Tenant
        </h1>
        <p className="text-theme-text-muted mt-2 text-lg font-medium">Onboard a new customer and provision their isolated workspace.</p>
      </div>

      <div className="theme-card p-8 bg-theme-surface">
        <form onSubmit={handleProvision} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm font-bold">
              {error}
            </div>
          )}
          {success && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-500 rounded-lg text-sm font-bold">
              {success}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-bold text-theme-text-muted mb-2">Business Name</label>
            <div className="relative">
              <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-text-muted" />
              <input 
                type="text" 
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                className="w-full bg-theme-bg border border-theme-border text-theme-text rounded-lg pl-12 pr-4 py-3 focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-all font-bold text-lg"
                required
                placeholder="e.g. Acme Corp"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-theme-text-muted mb-2">Service Tier</label>
              <select 
                value={tier}
                onChange={e => setTier(e.target.value)}
                className="w-full bg-theme-bg border border-theme-border text-theme-text rounded-lg px-4 py-3 focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-all font-medium"
              >
                <option value="standard">Standard / Growth</option>
                <option value="vip">Enterprise / VIP</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-theme-text-muted mb-2">Region</label>
              <select 
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="w-full bg-theme-bg border border-theme-border text-theme-text rounded-lg px-4 py-3 focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-all font-medium"
              >
                <option value="IN">India (IN)</option>
                <option value="US">United States (US)</option>
                <option value="EU">Europe (EU)</option>
              </select>
            </div>
          </div>
          
          <div className="pt-6 border-t border-theme-border">
            <button 
              type="submit" 
              disabled={submitting}
              className="w-full bg-brand-accent hover:bg-brand-accent/90 text-theme-text font-bold py-4 px-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center shadow-md shadow-brand-accent/20 text-lg tracking-wide"
            >
              {submitting ? 'PROVISIONING...' : 'CREATE SECURE WORKSPACE'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminProvisioning;
