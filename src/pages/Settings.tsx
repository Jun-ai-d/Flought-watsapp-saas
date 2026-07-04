import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import './Settings.css';

const Settings: React.FC = () => {
  const { tenant, session } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'bsp' | 'team'>('general');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'agent'>('agent');
  const [inviteStatus, setInviteStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const [businessName, setBusinessName] = useState('');
  const [savingGeneral, setSavingGeneral] = useState(false);
  
  const [bspConfig, setBspConfig] = useState<any>(null);
  const [bspForm, setBspForm] = useState({ provider: 'interakt', waba_id: '', phone_id: '', api_key: '' });
  const [savingBsp, setSavingBsp] = useState(false);
  const [loadingBsp, setLoadingBsp] = useState(false);

  useEffect(() => {
    if (tenant) {
      setBusinessName(tenant.business_name || '');
      if (activeTab === 'bsp') {
        fetchBspConfig();
      }
    }
  }, [tenant, activeTab]);

  const fetchBspConfig = async () => {
    if (!tenant || !session) return;
    setLoadingBsp(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/bsp/${tenant.id}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setBspConfig(data);
          setBspForm({
            provider: data.bsp_provider || 'interakt',
            waba_id: data.waba_id || '',
            phone_id: data.phone_number_id || '',
            api_key: '' // don't load the real key into the UI
          });
        }
      }
    } catch (err) {
      console.error('Failed to load BSP config', err);
    }
    setLoadingBsp(false);
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    setSavingGeneral(true);
    
    const { error } = await supabase
      .from('tenants')
      .update({ business_name: businessName })
      .eq('id', tenant.id);
      
    setSavingGeneral(false);
    if (!error) {
      alert('Settings saved successfully!');
    } else {
      alert('Failed to save settings: ' + error.message);
    }
  };

  const handleSaveBsp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !session) return;
    setSavingBsp(true);
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/bsp/${tenant.id}`, {
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
      const data = await res.json();
      setBspConfig(data);
      alert('BSP Configuration saved successfully!');
      setBspForm(prev => ({ ...prev, api_key: '' })); // clear the key field
    } catch (err) {
      alert('Failed to save BSP configuration.');
    }
    setSavingBsp(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteStatus(null);
    if (!tenant) return;

    try {
      const { error } = await supabase
        .from('agent_invitations')
        .insert({
          tenant_id: tenant.id,
          email: inviteEmail,
          role: inviteRole
        });

      if (error) throw error;
      setInviteStatus({ type: 'success', msg: `Invitation created for ${inviteEmail}` });
      setInviteEmail('');
    } catch (err: any) {
      setInviteStatus({ type: 'error', msg: err.message });
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tenant Settings</h1>
          <p className="text-gray">Configure your organization details and WhatsApp Business API integration.</p>
        </div>
      </div>

      <div className="settings-layout">
        {/* Sidebar Nav */}
        <div className="settings-nav">
          <button 
            className={`settings-tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            General Details
          </button>
          <button 
            className={`settings-tab ${activeTab === 'bsp' ? 'active' : ''}`}
            onClick={() => setActiveTab('bsp')}
          >
            BSP Configuration
          </button>
          {tenant?.role === 'admin' && (
            <button 
              className={`settings-tab ${activeTab === 'team' ? 'active' : ''}`}
              onClick={() => setActiveTab('team')}
            >
              Team & Agents
            </button>
          )}
        </div>

        {/* Content */}
        <div className="settings-content content-panel">
          {activeTab === 'general' && (
            <div className="settings-section">
              <h2>Organization Profile</h2>
              <form className="settings-form" onSubmit={handleSaveGeneral}>
                <div className="form-group">
                  <label>Business Name</label>
                  <input 
                    type="text" 
                    required
                    value={businessName} 
                    onChange={e => setBusinessName(e.target.value)} 
                  />
                </div>
                
                <div className="form-group">
                  <label>Timezone</label>
                  <select defaultValue="Asia/Kolkata">
                    <option value="Asia/Kolkata">India Standard Time (IST)</option>
                    <option value="UTC">Coordinated Universal Time (UTC)</option>
                  </select>
                </div>
                
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={savingGeneral}>
                    {savingGeneral ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'bsp' && (
            <div className="settings-section">
              <h2>WhatsApp BSP Configuration</h2>
              <p className="text-gray" style={{ marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                Flought routes messages through your chosen Business Solution Provider.
              </p>
              
              {loadingBsp ? (
                <div className="text-gray">Loading configuration...</div>
              ) : (
                <form className="settings-form" onSubmit={handleSaveBsp}>
                  <div className="form-group">
                    <label>Provider</label>
                    <select 
                      value={bspForm.provider}
                      onChange={e => setBspForm({...bspForm, provider: e.target.value})}
                    >
                      <option value="gupshup">Gupshup</option>
                      <option value="interakt">Interakt</option>
                      <option value="wati">WATI</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>WABA ID (WhatsApp Business Account ID)</label>
                    <input 
                      type="text" 
                      required
                      value={bspForm.waba_id}
                      onChange={e => setBspForm({...bspForm, waba_id: e.target.value})}
                      placeholder="e.g. 10934892837" 
                    />
                  </div>

                  <div className="form-group">
                    <label>Phone Number ID</label>
                    <input 
                      type="text" 
                      required
                      value={bspForm.phone_id}
                      onChange={e => setBspForm({...bspForm, phone_id: e.target.value})}
                      placeholder="e.g. 10582930291" 
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>API Key / Access Token</label>
                    <input 
                      type="password" 
                      value={bspForm.api_key}
                      onChange={e => setBspForm({...bspForm, api_key: e.target.value})}
                      placeholder={bspConfig ? "••••••••••••••••••••••••" : "Paste your API key here"} 
                    />
                    <span className="text-gray" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                      {bspConfig ? "Stored securely. Leave blank to keep current key." : "Required for initial setup."}
                    </span>
                  </div>
                  
                  {bspConfig?.webhook_verify_token && (
                    <div className="form-group">
                      <label>Webhook Verify Token</label>
                      <div className="webhook-box">
                        <code className="font-record text-green-400">{bspConfig.webhook_verify_token}</code>
                      </div>
                      <span className="text-gray" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                        Configure this token in your BSP dashboard.
                      </span>
                    </div>
                  )}

                  <div className="form-actions">
                    <button type="submit" className="btn btn-primary" disabled={savingBsp}>
                      {savingBsp ? 'Saving...' : 'Save BSP Settings'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {activeTab === 'team' && tenant?.role === 'admin' && (
            <div className="settings-section">
              <h2>Invite Team Member</h2>
              <p className="text-gray" style={{ marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                Invite an agent or another admin to access your Flought inbox.
              </p>

              {inviteStatus && (
                <div style={{
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  backgroundColor: inviteStatus.type === 'error' ? 'var(--accent-red)' : 'var(--text-main)',
                  color: 'white',
                  fontSize: '0.9rem'
                }}>
                  {inviteStatus.msg}
                </div>
              )}
              
              <form className="settings-form" onSubmit={handleInvite}>
                <div className="form-group">
                  <label>Agent Email</label>
                  <input 
                    type="email" 
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    required
                    placeholder="agent@company.com" 
                  />
                </div>
                
                <div className="form-group">
                  <label>Role</label>
                  <select value={inviteRole} onChange={e => setInviteRole(e.target.value as 'admin' | 'agent')}>
                    <option value="agent">Agent (Inbox only)</option>
                    <option value="admin">Admin (Full Access)</option>
                  </select>
                </div>
                
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">Send Invitation</button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
