import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import './Settings.css';

const Settings: React.FC = () => {
  const { tenant } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'bsp' | 'team'>('general');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'agent'>('agent');
  const [inviteStatus, setInviteStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

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
              <form className="settings-form" onSubmit={(e) => e.preventDefault()}>
                <div className="form-group">
                  <label>Business Name</label>
                  <input type="text" defaultValue={tenant?.business_name || "Apex Healthcare"} />
                </div>
                
                <div className="form-group">
                  <label>Support Email</label>
                  <input type="email" defaultValue="support@apexhealth.in" />
                </div>
                
                <div className="form-group">
                  <label>Timezone</label>
                  <select defaultValue="Asia/Kolkata">
                    <option value="Asia/Kolkata">India Standard Time (IST)</option>
                    <option value="UTC">Coordinated Universal Time (UTC)</option>
                  </select>
                </div>
                
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">Save Changes</button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'bsp' && (
            <div className="settings-section">
              <h2>WhatsApp BSP Configuration</h2>
              <p className="text-gray" style={{ marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                Flought routes messages through your chosen Business Solution Provider (e.g., WATI, Interakt).
              </p>
              
              <form className="settings-form" onSubmit={(e) => e.preventDefault()}>
                <div className="form-group">
                  <label>Provider</label>
                  <select defaultValue="interakt">
                    <option value="interakt">Interakt</option>
                    <option value="wati">WATI</option>
                    <option value="cloud_api">WhatsApp Cloud API (Direct)</option>
                  </select>
                </div>
                
                {/* VibeSec: Never expose API keys or secrets in the client-side UI if possible. 
                    If they must be entered, use password inputs and don't return them from API. */}
                <div className="form-group">
                  <label>API Key / Access Token</label>
                  <input type="password" placeholder="••••••••••••••••••••••••" />
                  <span className="text-gray" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    Stored securely. Leave blank to keep current key.
                  </span>
                </div>
                
                <div className="form-group">
                  <label>Webhook URL (to configure in your BSP)</label>
                  <div className="webhook-box">
                    <code className="font-record">https://api.flought.in/v1/webhooks/{tenant?.id || 'tenant_12345'}</code>
                    <button type="button" className="btn">Copy</button>
                  </div>
                </div>
                
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">Save BSP Settings</button>
                </div>
              </form>
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
