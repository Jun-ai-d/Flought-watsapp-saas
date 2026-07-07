import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import type { DesignLanguage, ColorMode, AccentColor } from '../contexts/ThemeContext';
import { cn } from '../lib/utils';
import { BSP_PROVIDERS, DEFAULT_BSP_PROVIDER } from '../lib/bspProviders';
import { Moon, Sun, Monitor, Palette, CheckCircle2, HelpCircle, Code, Copy, RefreshCw, ShoppingBag, Zap, Trash, Bot } from 'lucide-react';

const Settings: React.FC = () => {
  const { tenant, session } = useAuth();
  const { designLanguage, colorMode, accentColor, setDesignLanguage, setColorMode, setAccentColor } = useTheme();
  
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || localStorage.getItem('settingsActiveTab') || 'general';
  
  const setActiveTab = (tab: string) => {
    localStorage.setItem('settingsActiveTab', tab);
    setSearchParams({ tab });
  };
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'agent'>('agent');
  const [inviteStatus, setInviteStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const [businessName, setBusinessName] = useState('');
  const [savingGeneral, setSavingGeneral] = useState(false);

  const [aiSettings, setAiSettings] = useState<{
    welcome_message_type: 'fixed' | 'llm';
    fixed_welcome_message: string;
    system_prompt: string;
  }>({
    welcome_message_type: 'fixed',
    fixed_welcome_message: '',
    system_prompt: ''
  });
  const [savingAiSettings, setSavingAiSettings] = useState(false);

  useEffect(() => {
    if (tenant) {
      setBusinessName(tenant.business_name || '');
      if (tenant.ai_settings) {
        setAiSettings(tenant.ai_settings);
      }
    }
  }, [tenant]);

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    setSavingGeneral(true);
    
    const { error } = await (supabase
      .from('tenants') as any)
      .update({ business_name: businessName })
      .eq('id', tenant.id);
      
    setSavingGeneral(false);
    if (!error) {
      alert('Settings saved successfully!');
    } else {
      alert('Failed to save settings: ' + error.message);
    }
  };

  const handleSaveAiSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    setSavingAiSettings(true);
    
    const { error } = await (supabase
      .from('tenants') as any)
      .update({ ai_settings: aiSettings })
      .eq('id', tenant.id);
      
    setSavingAiSettings(false);
    if (!error) {
      alert('AI Chatbot settings saved successfully!');
    } else {
      alert('Failed to save AI settings: ' + error.message);
    }
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
        } as any);

      if (error) throw error;
      setInviteStatus({ type: 'success', msg: `Invitation created for ${inviteEmail}` });
      setInviteEmail('');
    } catch (err: any) {
      setInviteStatus({ type: 'error', msg: err.message });
    }
  };

  const accentColors: { id: AccentColor, hex: string, name: string }[] = [
    { id: 'emerald', hex: '#002E23', name: 'Deep Forest' },
    { id: 'sapphire', hex: '#60A5FA', name: 'Sapphire' },
    { id: 'amethyst', hex: '#A78BFA', name: 'Amethyst' },
    { id: 'amber', hex: '#FBBF24', name: 'Amber' }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-theme-text mb-2">Settings</h1>
        <p className="text-theme-text-muted">Configure your organization and personal preferences.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Nav */}
        <div className="w-full md:w-64 flex flex-col gap-2">
          <button 
            className={cn(
              "px-4 py-3 text-left font-medium transition-all theme-button border border-transparent",
              activeTab === 'general' ? "bg-theme-text text-theme-bg" : "text-theme-text-muted hover:bg-theme-surface-hover hover:text-theme-text"
            )}
            onClick={() => setActiveTab('general')}
          >
            General Details
          </button>
          
          <button 
            className={cn(
              "px-4 py-3 text-left font-medium transition-all theme-button border border-transparent",
              activeTab === 'appearance' ? "bg-theme-text text-theme-bg" : "text-theme-text-muted hover:bg-theme-surface-hover hover:text-theme-text"
            )}
            onClick={() => setActiveTab('appearance')}
          >
            Appearance
          </button>

          {tenant?.role === 'admin' && (
            <>
              <button 
                className={cn(
                  "px-4 py-3 text-left font-medium transition-all theme-button border border-transparent",
                  activeTab === 'team' ? "bg-theme-text text-theme-bg" : "text-theme-text-muted hover:bg-theme-surface-hover hover:text-theme-text"
                )}
                onClick={() => setActiveTab('team')}
              >
                Team & Agents
              </button>
              <button 
                className={cn(
                  "px-4 py-3 text-left font-medium transition-all theme-button border border-transparent",
                  activeTab === 'whatsapp' ? "bg-brand-accent text-white" : "text-theme-text-muted hover:bg-theme-surface-hover hover:text-brand-accent"
                )}
                onClick={() => setActiveTab('whatsapp')}
              >
                WhatsApp API
              </button>
              <button 
                className={cn(
                  "px-4 py-3 text-left font-medium transition-all theme-button border border-transparent",
                  activeTab === 'developer' ? "bg-theme-text text-theme-bg" : "text-theme-text-muted hover:bg-theme-surface-hover hover:text-theme-text"
                )}
                onClick={() => setActiveTab('developer')}
              >
                Developer API
              </button>
              <button 
                className={cn(
                  "px-4 py-3 text-left font-medium transition-all theme-button border border-transparent",
                  activeTab === 'shopify' ? "bg-theme-text text-theme-bg" : "text-theme-text-muted hover:bg-theme-surface-hover hover:text-theme-text"
                )}
                onClick={() => setActiveTab('shopify')}
              >
                Shopify Integration
              </button>
              <button 
                className={cn(
                  "px-4 py-3 text-left font-medium transition-all theme-button border border-transparent",
                  activeTab === 'crm' ? "bg-theme-text text-theme-bg" : "text-theme-text-muted hover:bg-theme-surface-hover hover:text-theme-text"
                )}
                onClick={() => setActiveTab('crm')}
              >
                CRM Sync
              </button>
              <button 
                className={cn(
                  "px-4 py-3 text-left font-medium transition-all theme-button border border-transparent",
                  activeTab === 'quick_replies' ? "bg-theme-text text-theme-bg" : "text-theme-text-muted hover:bg-theme-surface-hover hover:text-theme-text"
                )}
                onClick={() => setActiveTab('quick_replies')}
              >
                Quick Replies
              </button>
              <button 
                className={cn(
                  "px-4 py-3 text-left font-medium transition-all theme-button border border-transparent",
                  activeTab === 'ai_chatbot' ? "bg-brand-accent text-white" : "text-theme-text-muted hover:bg-theme-surface-hover hover:text-brand-accent"
                )}
                onClick={() => setActiveTab('ai_chatbot')}
              >
                <div className="flex items-center gap-2">
                  <Bot size={16} />
                  AI Chatbot
                </div>
              </button>
            </>
          )}
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'general' && (
            <div className="theme-card p-8">
              <h2 className="text-xl font-display font-bold text-theme-text mb-6">Organization Profile</h2>
              <form onSubmit={handleSaveGeneral} className="space-y-6 max-w-xl">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-theme-text-muted">Business Name</label>
                  <input 
                    type="text" 
                    required
                    value={businessName} 
                    onChange={e => setBusinessName(e.target.value)} 
                    className="w-full bg-theme-bg border border-theme-border text-theme-text p-3 focus:outline-none focus:border-brand-accent transition-colors theme-button"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-theme-text-muted">Timezone</label>
                  <select 
                    defaultValue="Asia/Kolkata"
                    className="w-full bg-theme-bg border border-theme-border text-theme-text p-3 focus:outline-none focus:border-brand-accent transition-colors theme-button"
                  >
                    <option value="Asia/Kolkata">India Standard Time (IST)</option>
                    <option value="UTC">Coordinated Universal Time (UTC)</option>
                  </select>
                </div>
                
                <div className="pt-4 border-t border-theme-border">
                  <button 
                    type="submit" 
                    disabled={savingGeneral}
                    className="px-6 py-3 bg-brand-accent hover:bg-brand-accent-light text-white font-bold transition-colors theme-button disabled:opacity-50"
                  >
                    {savingGeneral ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-8">
              <div className="theme-card p-8">
                <h2 className="text-xl font-display font-bold text-theme-text mb-2 flex items-center gap-2"><Monitor size={20} /> Color Mode</h2>
                <p className="text-theme-text-muted mb-6">Choose how the dashboard looks to you.</p>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <button 
                    onClick={() => setColorMode('light')}
                    className={cn(
                      "flex-1 p-6 border-2 flex flex-col items-center gap-4 transition-all theme-button",
                      colorMode === 'light' ? "border-brand-accent bg-brand-accent/5" : "border-theme-border hover:border-theme-text-muted bg-theme-surface"
                    )}
                  >
                    <Sun size={32} className={colorMode === 'light' ? 'text-brand-accent' : 'text-theme-text-muted'} />
                    <span className="font-bold text-theme-text">Light Mode</span>
                  </button>
                  <button 
                    onClick={() => setColorMode('dark')}
                    className={cn(
                      "flex-1 p-6 border-2 flex flex-col items-center gap-4 transition-all theme-button",
                      colorMode === 'dark' ? "border-brand-accent bg-brand-accent/5" : "border-theme-border hover:border-theme-text-muted bg-theme-surface"
                    )}
                  >
                    <Moon size={32} className={colorMode === 'dark' ? 'text-brand-accent' : 'text-theme-text-muted'} />
                    <span className="font-bold text-theme-text">Dark Mode</span>
                  </button>
                  <button 
                    onClick={() => setColorMode('system')}
                    className={cn(
                      "flex-1 p-6 border-2 flex flex-col items-center gap-4 transition-all theme-button",
                      colorMode === 'system' ? "border-brand-accent bg-brand-accent/5" : "border-theme-border hover:border-theme-text-muted bg-theme-surface"
                    )}
                  >
                    <Monitor size={32} className={colorMode === 'system' ? 'text-brand-accent' : 'text-theme-text-muted'} />
                    <span className="font-bold text-theme-text">System</span>
                  </button>
                </div>
              </div>

              <div className="theme-card p-8">
                <h2 className="text-xl font-display font-bold text-theme-text mb-2 flex items-center gap-2"><Palette size={20} /> Accent Color</h2>
                <p className="text-theme-text-muted mb-6">Personalize the primary color used across buttons, active states, and highlights.</p>
                
                <div className="flex flex-wrap gap-4">
                  {accentColors.map(color => (
                    <button
                      key={color.id}
                      onClick={() => setAccentColor(color.id)}
                      className={cn(
                        "flex items-center gap-3 px-5 py-3 border-2 transition-all theme-button",
                        accentColor === color.id ? "border-brand-accent bg-theme-bg shadow-sm" : "border-theme-border hover:border-theme-text-muted bg-theme-surface"
                      )}
                    >
                      <div className="w-6 h-6 rounded-full shadow-sm flex items-center justify-center text-white" style={{ backgroundColor: color.hex }}>
                        {accentColor === color.id && <CheckCircle2 size={14} />}
                      </div>
                      <span className="font-bold text-theme-text">{color.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="theme-card p-8">
                <h2 className="text-xl font-display font-bold text-theme-text mb-2">Design Language</h2>
                <p className="text-theme-text-muted mb-6">Change the structural styling of the entire application. Modifies borders, shadows, and spacing.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(['modern', 'minimal', 'professional'] as const).map(lang => (
                    <button
                      key={lang}
                      onClick={() => setDesignLanguage(lang)}
                      className={cn(
                        "p-6 border-2 text-left transition-all theme-button",
                        designLanguage === lang ? "border-brand-accent bg-brand-accent/5" : "border-theme-border hover:border-theme-text-muted bg-theme-surface"
                      )}
                    >
                      <h3 className="font-bold text-theme-text capitalize mb-2">{lang}</h3>
                      <p className="text-xs text-theme-text-muted leading-relaxed">
                        {lang === 'modern' && "Glassmorphic surfaces, deeply rounded corners, and soft premium drop shadows."}
                        {lang === 'minimal' && "Stark contrast, sharp flat edges, solid backgrounds, and zero shadows."}
                        {lang === 'professional' && "Enterprise layout, subtle borders, standard elevations, and slightly rounded corners."}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'team' && tenant?.role === 'admin' && (
            <div className="space-y-8">
              <div className="theme-card p-8">
                <h2 className="text-xl font-display font-bold text-theme-text mb-2">Invite Team Member</h2>
                <p className="text-theme-text-muted mb-6">Invite an agent or another admin to access your Flought inbox.</p>

                {inviteStatus && (
                  <div className={cn(
                    "p-4 mb-6 text-sm font-medium theme-button",
                    inviteStatus.type === 'error' ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-green-500/10 text-green-500 border border-green-500/20"
                  )}>
                    {inviteStatus.msg}
                  </div>
                )}
                
                <form onSubmit={handleInvite} className="space-y-6 max-w-xl">
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-theme-text-muted">Agent Email</label>
                    <input 
                      type="email" 
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      required
                      placeholder="agent@company.com" 
                      className="w-full bg-theme-bg border border-theme-border text-theme-text p-3 focus:outline-none focus:border-brand-accent transition-colors theme-button"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-theme-text-muted">Role</label>
                    <select 
                      value={inviteRole} 
                      onChange={e => setInviteRole(e.target.value as 'admin' | 'agent')}
                      className="w-full bg-theme-bg border border-theme-border text-theme-text p-3 focus:outline-none focus:border-brand-accent transition-colors theme-button"
                    >
                      <option value="agent">Agent (Inbox only)</option>
                      <option value="admin">Admin (Full Access)</option>
                    </select>
                  </div>
                  
                  <div className="pt-4 border-t border-theme-border">
                    <button type="submit" className="px-6 py-3 bg-theme-text text-theme-bg hover:opacity-80 font-bold transition-opacity theme-button">
                      Send Invitation
                    </button>
                  </div>
                </form>
              </div>

              <TeamList tenantId={tenant.id} />
            </div>
          )}

          {activeTab === 'whatsapp' && tenant?.role === 'admin' && (
            <WhatsAppSettings tenantId={tenant.id} session={session} />
          )}

          {activeTab === 'developer' && tenant?.role === 'admin' && (
            <DeveloperSettings tenantId={tenant.id} session={session} />
          )}

          {activeTab === 'shopify' && tenant?.role === 'admin' && (
            <ShopifySettings tenantId={tenant.id} session={session} />
          )}

          {activeTab === 'crm' && tenant?.role === 'admin' && (
            <CRMSettings tenantId={tenant.id} session={session} />
          )}

          {activeTab === 'quick_replies' && (
            <QuickRepliesSettings tenantId={tenant.id} />
          )}

          {activeTab === 'ai_chatbot' && (
            <div className="theme-card p-8">
              <h2 className="text-xl font-display font-bold text-theme-text mb-2">AI Chatbot & Greetings</h2>
              <p className="text-theme-text-muted mb-6">
                Configure how the AI responds when a customer messages you for the first time.
              </p>
              
              <form onSubmit={handleSaveAiSettings} className="space-y-6 max-w-2xl">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-theme-text-muted">Inbound Greeting Strategy</label>
                  <select 
                    value={aiSettings.welcome_message_type}
                    onChange={(e) => setAiSettings({...aiSettings, welcome_message_type: e.target.value as 'fixed' | 'llm'})}
                    className="w-full bg-theme-bg border border-theme-border text-theme-text p-3 focus:outline-none focus:border-brand-accent transition-colors theme-button"
                  >
                    <option value="fixed">Fixed Welcome Message (Recommended)</option>
                    <option value="llm">LLM-First (AI responds directly to "Hi")</option>
                  </select>
                  <p className="text-xs text-theme-text-muted mt-1">
                    Fixed messages guarantee a brand-safe greeting. LLM-First allows the AI to generate dynamic greetings but is less predictable.
                  </p>
                </div>

                {aiSettings.welcome_message_type === 'fixed' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-theme-text-muted">Fixed Welcome Message</label>
                    <textarea 
                      value={aiSettings.fixed_welcome_message}
                      onChange={(e) => setAiSettings({...aiSettings, fixed_welcome_message: e.target.value})}
                      placeholder="Hi there! Welcome to our business. I'm your AI assistant. How can I help you today?"
                      rows={3}
                      className="w-full bg-theme-bg border border-theme-border text-theme-text p-3 focus:outline-none focus:border-brand-accent transition-colors theme-button resize-none"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-theme-text-muted">AI System Prompt (Persona)</label>
                  <textarea 
                    value={aiSettings.system_prompt}
                    onChange={(e) => setAiSettings({...aiSettings, system_prompt: e.target.value})}
                    placeholder="You are a helpful customer support agent for Acme Corp..."
                    rows={6}
                    className="w-full bg-theme-bg border border-theme-border text-theme-text p-3 focus:outline-none focus:border-brand-accent transition-colors theme-button font-mono text-sm"
                  />
                  <p className="text-xs text-theme-text-muted mt-1">
                    Provide instructions to the LLM about your business, tone, and how it should answer questions.
                  </p>
                </div>

                <div className="pt-4 border-t border-theme-border">
                  <button 
                    type="submit" 
                    disabled={savingAiSettings}
                    className="px-6 py-3 bg-brand-accent text-white font-bold transition-opacity hover:bg-brand-accent-light theme-button disabled:opacity-50 flex items-center gap-2"
                  >
                    <CheckCircle2 size={18} />
                    {savingAiSettings ? 'Saving...' : 'Save AI Settings'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TeamList = ({ tenantId }: { tenantId: string }) => {
  const { data: team = [], refetch } = useQuery({
    queryKey: ['team', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('tenant_users').select('*').eq('tenant_id', tenantId);
      if (error) throw error;
      return data || [];
    }
  });

  const handleUpdateDepartments = async (memberId: string, depsString: string) => {
    const departments = depsString.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const { error } = await (supabase.from('tenant_users') as any).update({ departments: departments as any }).eq('id', memberId);
    if (error) alert('Error updating departments: ' + error.message);
    else refetch();
  };

  return (
    <div className="theme-card p-8">
      <h2 className="text-xl font-display font-bold text-theme-text mb-2">Routing Departments</h2>
      <p className="text-theme-text-muted mb-6">
        Assign comma-separated departments to route conversations to specific agents (e.g. "sales, support, billing").
      </p>
      
      <div className="space-y-4">
        {team.map((member: any) => (
          <div key={member.id} className="border border-theme-border p-5 bg-theme-bg theme-button flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="font-bold text-theme-text font-mono text-sm">User: {member.user_id.substring(0, 8)}...</span>
              <span className="bg-theme-text text-theme-bg text-xs px-2 py-1 uppercase font-bold theme-button">{member.role}</span>
            </div>
            <div>
              <label className="block text-xs font-bold text-theme-text-muted uppercase mb-2">Departments</label>
              <input 
                type="text" 
                className="w-full bg-theme-surface border border-theme-border text-theme-text p-2.5 focus:outline-none focus:border-brand-accent transition-colors theme-button"
                defaultValue={(member.departments || []).join(', ')}
                onBlur={(e) => handleUpdateDepartments(member.id, e.target.value)}
                placeholder="sales, support, billing"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const WhatsAppSettings = ({ tenantId, session }: { tenantId: string, session: any }) => {
  const [bspForm, setBspForm] = useState({ provider: DEFAULT_BSP_PROVIDER, waba_id: '', phone_id: '', api_key: '', catalog_id: '' });
  const [savingBsp, setSavingBsp] = useState(false);

  const { data: bspConfig, isLoading } = useQuery({
    queryKey: ['tenant-bsp', tenantId],
    queryFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/tenant/bsp`, {
        headers: { 
          'Authorization': `Bearer ${session.access_token}`,
          'x-tenant-id': tenantId 
        }
      });
      if (!res.ok) throw new Error('Failed to fetch BSP config');
      return res.json();
    },
  });

  useEffect(() => {
    if (bspConfig) {
      setBspForm({
        provider: bspConfig.bsp_provider || DEFAULT_BSP_PROVIDER,
        waba_id: bspConfig.waba_id || '',
        phone_id: bspConfig.phone_number_id || '',
        catalog_id: bspConfig.catalog_id || '',
        api_key: '' 
      });
    }
  }, [bspConfig]);

  const handleSaveBsp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBsp(true);
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/tenant/bsp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'x-tenant-id': tenantId
        },
        body: JSON.stringify({
          bsp_provider: bspForm.provider,
          waba_id: bspForm.waba_id,
          phone_number_id: bspForm.phone_id,
          api_key: bspForm.api_key,
          catalog_id: bspForm.catalog_id
        })
      });
      
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || errBody.error || `HTTP ${res.status}`);
      }
      alert('WhatsApp Configuration saved successfully!');
      setBspForm(prev => ({ ...prev, api_key: '' })); // clear the key field
    } catch (err: any) {
      alert(`Failed to save WhatsApp configuration.\n\nError: ${err.message}`);
    } finally {
      setSavingBsp(false);
    }
  };

  if (isLoading) {
    return <div className="text-theme-text-muted font-medium">Loading configuration...</div>;
  }

  return (
    <div className="theme-card p-8 border-t-4 border-brand-accent">
      <div className="flex justify-between items-start mb-2">
        <h2 className="text-2xl font-display font-bold text-theme-text">WhatsApp Business API Setup</h2>
        <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-brand-accent hover:text-brand-accent-light font-bold text-sm bg-brand-accent/10 px-3 py-1.5 rounded-full transition-colors">
          <HelpCircle size={16} /> Setup Guide
        </a>
      </div>
      <p className="text-theme-text-muted mb-8">Connect your WhatsApp Business Account (WABA) via your chosen provider to enable automated inbound replies and outbound campaigns.</p>

      <div className="mb-8 p-6 bg-theme-bg border border-theme-border rounded-lg space-y-4">
        <h3 className="font-bold text-theme-text flex items-center gap-2">
          How to get these credentials?
        </h3>
        <ol className="list-decimal list-inside text-theme-text-muted text-sm space-y-2 font-medium">
          <li>Go to the <strong>Meta Developer Portal</strong> and create a new App.</li>
          <li>Add the <strong>WhatsApp product</strong> to your app.</li>
          <li>In the WhatsApp getting started dashboard, copy your <strong>WABA ID</strong> and <strong>Phone Number ID</strong>.</li>
          <li>Create a System User in your Business Manager to generate a permanent <strong>Access Token (API Key)</strong>.</li>
          <li>Paste the credentials below and click <strong>Save Configuration</strong> to generate your Webhook Verify Token.</li>
          <li>Copy the Verify Token and paste it back in your Meta Developer Portal webhook settings.</li>
        </ol>
      </div>
      
      <form onSubmit={handleSaveBsp} className="space-y-6 max-w-2xl">
        <div>
          <label className="block font-bold mb-2 text-theme-text text-sm">Service Provider</label>
          <select 
            value={bspForm.provider}
            onChange={e => setBspForm({...bspForm, provider: e.target.value})}
            className="w-full p-4 border border-theme-border bg-theme-surface text-theme-text focus:border-brand-accent focus:outline-none theme-button font-bold text-base transition-colors"
          >
            {BSP_PROVIDERS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block font-bold mb-2 text-theme-text text-sm">WABA ID</label>
            <input 
              type="text" 
              required
              value={bspForm.waba_id}
              onChange={e => setBspForm({...bspForm, waba_id: e.target.value})}
              placeholder="e.g. 10934892837" 
              className="w-full p-4 border border-theme-border bg-theme-surface text-theme-text focus:border-brand-accent focus:outline-none theme-button font-mono text-sm transition-colors"
            />
          </div>

          <div>
            <label className="block font-bold mb-2 text-theme-text text-sm">Phone Number ID</label>
            <input 
              type="text" 
              required
              value={bspForm.phone_id}
              onChange={e => setBspForm({...bspForm, phone_id: e.target.value})}
              placeholder="e.g. 10582930291" 
              className="w-full p-4 border border-theme-border bg-theme-surface text-theme-text focus:border-brand-accent focus:outline-none theme-button font-mono text-sm transition-colors"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div>
            <label className="block font-bold mb-2 text-theme-text text-sm">API Key / Access Token</label>
            <input 
              type="password" 
              value={bspForm.api_key}
              onChange={e => setBspForm({...bspForm, api_key: e.target.value})}
              placeholder={bspConfig ? "••••••••••••••••••••••••" : "Paste your API key here"} 
              className="w-full p-4 border border-theme-border bg-theme-surface text-theme-text focus:border-brand-accent focus:outline-none theme-button font-mono text-sm transition-colors"
            />
            <p className="text-xs text-theme-text-muted mt-2 font-medium">
              {bspConfig ? "Stored securely. Leave blank to keep current key." : "Required for initial setup."}
            </p>
          </div>
          <div>
            <label className="block font-bold mb-2 text-theme-text text-sm">Meta Commerce Catalog ID (Optional)</label>
            <input 
              type="text" 
              value={bspForm.catalog_id}
              onChange={e => setBspForm({...bspForm, catalog_id: e.target.value})}
              placeholder="e.g. 94837264819" 
              className="w-full p-4 border border-theme-border bg-theme-surface text-theme-text focus:border-brand-accent focus:outline-none theme-button font-mono text-sm transition-colors"
            />
            <p className="text-xs text-theme-text-muted mt-2 font-medium">
              Required to enable Native Commerce features (Subplan 5).
            </p>
          </div>
        </div>
        
        {bspConfig?.webhook_verify_token && bspForm.provider !== 'meta' && (
          <div className="bg-theme-bg p-6 border border-brand-accent/20 mt-6 bg-brand-accent/5" style={{ borderRadius: 'var(--radius-card)' }}>
            <label className="block text-xs font-bold uppercase text-brand-accent mb-2 tracking-wide">Webhook Verify Token (Gupshup)</label>
            <code className="text-theme-text font-mono text-lg break-all font-bold">{bspConfig.webhook_verify_token}</code>
            <p className="text-sm text-theme-text-muted mt-3 font-medium">Copy this token into your Gupshup webhook configuration.</p>
          </div>
        )}

        {bspForm.provider === 'meta' && (
          <div className="bg-theme-bg p-6 border border-blue-500/20 mt-6 bg-blue-500/5" style={{ borderRadius: 'var(--radius-card)' }}>
            <label className="block text-xs font-bold uppercase text-blue-400 mb-2 tracking-wide">Meta Webhook Setup</label>
            <p className="text-sm text-theme-text-muted font-medium">Meta Cloud API uses a single global Verify Token configured as the <code className="text-blue-400 font-mono">META_VERIFY_TOKEN</code> environment variable on your backend server. Do <strong>not</strong> use the per-tenant token shown here — ask your platform administrator for the correct value.</p>
          </div>
        )}

        <div className="pt-6 mt-6 border-t border-theme-border">
          <button 
            type="submit" 
            disabled={savingBsp}
            className="w-full px-6 py-4 bg-brand-accent text-white font-bold tracking-wide hover:bg-brand-accent-light disabled:opacity-50 theme-button shadow-md transition-all text-lg"
          >
            {savingBsp ? 'Saving API Details...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
};

const DeveloperSettings = ({ tenantId, session }: { tenantId: string, session: any }) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState(false);

  const { data: devConfig, isLoading, refetch } = useQuery({
    queryKey: ['tenant-developer', tenantId],
    queryFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/tenant/developer`, {
        headers: { 
          'Authorization': `Bearer ${session.access_token}`,
          'x-tenant-id': tenantId 
        }
      });
      if (!res.ok) throw new Error('Failed to fetch developer config');
      return res.json();
    },
  });

  useEffect(() => {
    if (devConfig?.webhook_url) {
      setWebhookUrl(devConfig.webhook_url);
    }
  }, [devConfig]);

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/tenant/developer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'x-tenant-id': tenantId
        },
        body: JSON.stringify({ webhook_url: webhookUrl })
      });
      if (!res.ok) throw new Error('API Error');
      alert('Webhook URL saved successfully!');
      refetch();
    } catch (err) {
      alert('Failed to save Webhook URL.');
    } finally {
      setSaving(false);
    }
  };

  const handleRotateKey = async () => {
    if (!window.confirm('Are you sure you want to generate a new API key? Any existing integrations using the old key will break immediately.')) return;
    setRotating(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/tenant/developer/rotate-key`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'x-tenant-id': tenantId
        }
      });
      if (!res.ok) throw new Error('API Error');
      alert('API Key rotated successfully!');
      refetch();
    } catch (err) {
      alert('Failed to rotate API Key.');
    } finally {
      setRotating(false);
    }
  };

  if (isLoading) return <div className="text-theme-text-muted">Loading developer settings...</div>;

  return (
    <div className="space-y-8">
      <div className="theme-card p-8">
        <h2 className="text-xl font-display font-bold text-theme-text mb-2 flex items-center gap-2"><Code size={20} /> Developer API</h2>
        <p className="text-theme-text-muted mb-6">Use these credentials to connect Flought HQ with Zapier, Make.com, or your own custom backend.</p>
        
        <div className="space-y-6 max-w-2xl">
          <div>
            <label className="block text-sm font-bold text-theme-text-muted mb-2">Secret API Key</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                readOnly
                value={devConfig?.api_key || ''} 
                className="w-full bg-theme-bg border border-theme-border text-theme-text p-3 font-mono text-sm focus:outline-none theme-button"
              />
              <button 
                onClick={() => { navigator.clipboard.writeText(devConfig?.api_key || ''); alert('Copied to clipboard'); }}
                className="px-4 bg-theme-surface border border-theme-border hover:text-brand-accent transition-colors theme-button"
                title="Copy API Key"
              >
                <Copy size={18} />
              </button>
            </div>
            <p className="text-xs text-theme-text-muted mt-2 font-medium flex items-center justify-between">
              Do not share this key. It grants full access to your account.
              <button onClick={handleRotateKey} disabled={rotating} className="text-red-500 hover:underline flex items-center gap-1">
                <RefreshCw size={12} className={rotating ? 'animate-spin' : ''} /> Roll Key
              </button>
            </p>
          </div>
        </div>
      </div>

      <div className="theme-card p-8">
        <h2 className="text-xl font-display font-bold text-theme-text mb-2">Outbound Webhooks</h2>
        <p className="text-theme-text-muted mb-6">We will send a POST request with a JSON payload to this URL whenever a new message is received.</p>
        
        <form onSubmit={handleSaveWebhook} className="space-y-6 max-w-2xl">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-theme-text-muted">Webhook URL</label>
            <input 
              type="url" 
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.zapier.com/hooks/catch/..." 
              className="w-full bg-theme-bg border border-theme-border text-theme-text p-3 focus:outline-none focus:border-brand-accent transition-colors theme-button font-mono text-sm"
            />
          </div>
          
          <div className="pt-4 border-t border-theme-border">
            <button 
              type="submit" 
              disabled={saving}
              className="px-6 py-3 bg-theme-text text-theme-bg hover:opacity-80 font-bold transition-opacity theme-button disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Webhook'}
            </button>
          </div>
        </form>
      </div>

      <div className="theme-card p-8 border-t-4 border-brand-accent">
        <h2 className="text-xl font-display font-bold text-theme-text mb-2">API Documentation</h2>
        <p className="text-theme-text-muted mb-6">Use these endpoints to programmatically control Flought HQ.</p>

        <div className="space-y-8">
          
          <ApiEndpoint 
            method="POST"
            path="/api/v1/contacts"
            description="Add or update a contact (e.g. from a Facebook Lead Ad)."
            payload={JSON.stringify({ phone_number: "14155552671", name: "John Doe", tags: ["Lead"] }, null, 2)}
          />

          <ApiEndpoint 
            method="POST"
            path="/api/v1/messages/send"
            description="Send a message to a contact."
            payload={JSON.stringify({ conversationId: "uuid", text: "Hello from CRM!" }, null, 2)}
          />

          <ApiEndpoint 
            method="POST"
            path="/api/v1/conversations/:id/takeover"
            description="Pause the AI Bot so a human agent can chat."
            payload="{}"
          />

          <ApiEndpoint 
            method="POST"
            path="/api/v1/conversations/:id/resolve"
            description="Re-activate the AI Bot when the human is done."
            payload="{}"
          />
        </div>
      </div>
    </div>
  );
};

const ApiEndpoint = ({ method, path, description, payload }: { method: string, path: string, description: string, payload: string }) => {
  return (
    <div className="bg-theme-surface border border-theme-border rounded-lg overflow-hidden theme-button">
      <div className="flex items-center gap-4 p-4 border-b border-theme-border bg-theme-bg">
        <span className={cn(
          "font-bold text-xs px-2 py-1 uppercase rounded-md shadow-sm",
          method === 'POST' ? 'bg-green-500/20 text-green-600' : 'bg-blue-500/20 text-blue-600'
        )}>{method}</span>
        <code className="text-sm font-bold text-theme-text">{path}</code>
      </div>
      <div className="p-4">
        <p className="text-sm text-theme-text-muted mb-4 font-medium">{description}</p>
        <div>
          <label className="block text-xs font-bold text-theme-text uppercase mb-2">Headers</label>
          <pre className="text-xs font-mono bg-black text-green-400 p-3 rounded-md overflow-x-auto shadow-inner">
            Authorization: Bearer sk_live_...
            <br />
            Content-Type: application/json
          </pre>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-bold text-theme-text uppercase mb-2">JSON Body</label>
          <pre className="text-xs font-mono bg-black text-green-400 p-3 rounded-md overflow-x-auto shadow-inner">
            {payload}
          </pre>
        </div>
      </div>
    </div>
  );
};

const ShopifySettings = ({ tenantId, session }: { tenantId: string, session: any }) => {
  const [form, setForm] = useState({ store_url: '', webhook_secret: '', is_active: false });
  const [saving, setSaving] = useState(false);

  const { data: config, isLoading, refetch } = useQuery({
    queryKey: ['tenant-shopify', tenantId],
    queryFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/tenant/integrations/shopify`, {
        headers: { 
          'Authorization': `Bearer ${session.access_token}`,
          'x-tenant-id': tenantId 
        }
      });
      if (!res.ok) throw new Error('Failed to fetch Shopify config');
      return res.json();
    },
  });

  useEffect(() => {
    if (config) {
      setForm({
        store_url: config.store_url || '',
        webhook_secret: config.webhook_secret || '',
        is_active: config.is_active ?? false
      });
    }
  }, [config]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/tenant/integrations/shopify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'x-tenant-id': tenantId
        },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error('API Error');
      alert('Shopify Integration saved successfully!');
      refetch();
    } catch (err) {
      alert('Failed to save Shopify Integration.');
    } finally {
      setSaving(false);
    }
  };

  const webhookUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/integrations/shopify/webhook?tenant_id=${tenantId}`;

  if (isLoading) return <div className="text-theme-text-muted">Loading Shopify settings...</div>;

  return (
    <div className="space-y-8">
      <div className="theme-card p-8 border-t-4 border-[#95BF47]">
        <h2 className="text-xl font-display font-bold text-theme-text mb-2 flex items-center gap-2">
          <ShoppingBag size={20} className="text-[#95BF47]" /> Shopify Integration
        </h2>
        <p className="text-theme-text-muted mb-6">
          Connect your Shopify store to automatically send WhatsApp messages for Abandoned Carts and New Orders.
        </p>

        <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
          
          <div className="flex items-center gap-3 bg-theme-surface p-4 border border-theme-border rounded-lg theme-button">
            <input 
              type="checkbox" 
              id="is_active"
              checked={form.is_active}
              onChange={e => setForm({...form, is_active: e.target.checked})}
              className="w-5 h-5 accent-brand-accent cursor-pointer"
            />
            <label htmlFor="is_active" className="font-bold text-theme-text cursor-pointer select-none">
              Enable Shopify Integration
            </label>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-theme-text-muted">Shopify Store URL</label>
            <input 
              type="text" 
              required
              value={form.store_url}
              onChange={e => setForm({...form, store_url: e.target.value})}
              placeholder="e.g. my-store.myshopify.com" 
              className="w-full bg-theme-bg border border-theme-border text-theme-text p-3 focus:outline-none focus:border-[#95BF47] transition-colors theme-button font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-theme-text-muted flex justify-between">
              <span>Webhook API Secret</span>
              <a href="https://help.shopify.com/en/manual/shopify-admin/webhooks" target="_blank" rel="noreferrer" className="text-brand-accent hover:underline text-xs">Where to find this?</a>
            </label>
            <input 
              type="password" 
              required
              value={form.webhook_secret}
              onChange={e => setForm({...form, webhook_secret: e.target.value})}
              placeholder="Paste your Shopify Webhook HMAC Secret here" 
              className="w-full bg-theme-bg border border-theme-border text-theme-text p-3 focus:outline-none focus:border-[#95BF47] transition-colors theme-button font-mono text-sm"
            />
            <p className="text-xs text-theme-text-muted font-medium mt-1">
              Required to verify that incoming requests actually came from your Shopify store.
            </p>
          </div>
          
          <div className="pt-4 border-t border-theme-border">
            <button 
              type="submit" 
              disabled={saving}
              className="px-6 py-3 bg-[#95BF47] text-white hover:opacity-80 font-bold transition-opacity theme-button disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Integration'}
            </button>
          </div>
        </form>

        {config?.is_active && (
          <div className="mt-8 pt-8 border-t border-theme-border">
            <h3 className="font-bold text-theme-text mb-4">Your Webhook URL</h3>
            <p className="text-sm text-theme-text-muted mb-4 font-medium">
              Go to Shopify Admin &gt; Settings &gt; Notifications &gt; Webhooks. Create webhooks for <code className="text-xs bg-theme-surface px-1">orders/create</code> and <code className="text-xs bg-theme-surface px-1">checkouts/update</code> and paste this URL:
            </p>
            <div className="flex gap-2">
              <input 
                type="text" 
                readOnly
                value={webhookUrl} 
                className="w-full bg-theme-surface border border-theme-border text-theme-text p-3 font-mono text-xs focus:outline-none theme-button"
              />
              <button 
                onClick={() => { navigator.clipboard.writeText(webhookUrl); alert('Copied to clipboard'); }}
                className="px-4 bg-theme-text text-theme-bg font-bold transition-colors theme-button whitespace-nowrap"
              >
                Copy URL
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const QuickRepliesSettings = ({ tenantId }: { tenantId: string }) => {
  const [shortcut, setShortcut] = useState('');
  const [content, setContent] = useState('');
  const queryClient = useQueryClient();

  const { data: replies = [], isLoading } = useQuery({
    queryKey: ['quick_replies', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('quick_replies').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async ({ currentShortcut, currentContent }: { currentShortcut: string, currentContent: string }) => {
      const { data, error } = await (supabase.from('quick_replies') as any).insert({ tenant_id: tenantId, shortcut: currentShortcut, content: currentContent });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick_replies', tenantId] });
      setShortcut('');
      setContent('');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('quick_replies').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quick_replies', tenantId] });
    }
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    let s = shortcut.startsWith('/') ? shortcut : `/${shortcut}`;
    saveMutation.mutate({ currentShortcut: s, currentContent: content });
  };

  return (
    <div className="space-y-8">
      <div className="theme-card p-8 border-t-4 border-[#00B2FF]">
        <h2 className="text-xl font-display font-bold text-theme-text mb-2 flex items-center gap-2">
          <Zap size={20} className="text-[#00B2FF]" /> Saved Quick Replies
        </h2>
        <p className="text-theme-text-muted mb-6 font-medium">
          Create shortcuts for messages you send often. Agents can type these shortcuts in the Inbox to instantly paste the content.
        </p>

        <form onSubmit={handleSave} className="space-y-4 max-w-xl bg-theme-surface p-6 border border-theme-border rounded-lg mb-8">
          <h3 className="font-bold text-theme-text mb-4">Add New Quick Reply</h3>
          
          <div className="flex gap-4">
            <div className="w-1/3 space-y-2">
              <label className="block text-sm font-bold text-theme-text-muted">Shortcut</label>
              <input 
                type="text" 
                required
                value={shortcut}
                onChange={e => setShortcut(e.target.value)}
                placeholder="/refund" 
                className="w-full bg-theme-bg border border-theme-border text-theme-text p-3 focus:outline-none focus:border-[#00B2FF] transition-colors theme-button font-mono text-sm"
              />
            </div>
            
            <div className="flex-1 space-y-2">
              <label className="block text-sm font-bold text-theme-text-muted">Content</label>
              <textarea 
                required
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Here is our refund policy..." 
                className="w-full bg-theme-bg border border-theme-border text-theme-text p-3 focus:outline-none focus:border-[#00B2FF] transition-colors theme-button text-sm h-24 resize-none"
              />
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={saveMutation.isPending}
            className="w-full py-3 bg-[#00B2FF] text-white hover:opacity-80 font-bold transition-opacity theme-button disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Saving...' : 'Add Quick Reply'}
          </button>
        </form>

        <div className="space-y-3">
          <h3 className="font-bold text-theme-text mb-4">Existing Quick Replies</h3>
          {isLoading ? (
            <p className="text-theme-text-muted">Loading...</p>
          ) : replies.length === 0 ? (
            <p className="text-theme-text-muted">No quick replies created yet.</p>
          ) : (
            replies.map(reply => (
              <div key={reply.id} className="flex justify-between items-center p-4 bg-theme-surface border border-theme-border rounded-lg group hover:border-[#00B2FF] transition-colors">
                <div>
                  <div className="font-mono text-sm font-bold text-[#00B2FF] mb-1">{reply.shortcut}</div>
                  <div className="text-sm text-theme-text-muted truncate max-w-lg">{reply.content}</div>
                </div>
                <button 
                  onClick={() => deleteMutation.mutate(reply.id)}
                  className="text-theme-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2"
                  title="Delete Quick Reply"
                >
                  <Trash size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const CRMSettings = ({ tenantId, session }: { tenantId: string, session: any }) => {
  const [provider, setProvider] = useState<'hubspot' | 'salesforce'>('hubspot');
  const [form, setForm] = useState({ api_key: '', is_active: false, sync_contacts: true, sync_chats: true });
  const [saving, setSaving] = useState(false);

  const { data: config, isLoading, refetch } = useQuery({
    queryKey: ['tenant-crm', tenantId, provider],
    queryFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/crm/${provider}`, {
        headers: { 
          'Authorization': `Bearer ${session.access_token}`,
          'x-tenant-id': tenantId 
        }
      });
      if (!res.ok) throw new Error('Failed to fetch CRM config');
      return res.json();
    },
  });

  useEffect(() => {
    if (config) {
      setForm({
        api_key: '', // never load raw key
        is_active: config.is_active || false,
        sync_contacts: true, // Only contact sync supported in V1
        sync_chats: false
      });
    } else {
      setForm({ api_key: '', is_active: false, sync_contacts: true, sync_chats: false });
    }
  }, [config, provider]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (!form.api_key && !config) {
        throw new Error('Access Token is required for initial setup.');
      }
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/crm/${provider}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'x-tenant-id': tenantId
        },
        body: JSON.stringify({
          api_key: form.api_key,
          is_active: form.is_active,
          sync_contacts: form.sync_contacts,
          sync_chats: form.sync_chats
        })
      });
      if (!res.ok) throw new Error('API Error');

      alert('CRM Configuration saved successfully!');
      setForm(prev => ({ ...prev, api_key: '' }));
      refetch();
    } catch (err: any) {
      alert('Failed to save CRM configuration: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="text-theme-text-muted">Loading CRM settings...</div>;

  return (
    <div className="theme-card p-8 border-t-4 border-brand-accent">
      <h2 className="text-xl font-display font-bold text-theme-text mb-2 flex items-center gap-2">CRM Native Sync</h2>
      <p className="text-theme-text-muted mb-6">Automatically sync contacts and conversation transcripts to your CRM.</p>

      <div className="flex gap-4 mb-8">
        <button 
          onClick={() => setProvider('hubspot')}
          className={cn("px-6 py-3 font-bold transition-all theme-button", provider === 'hubspot' ? "bg-theme-text text-theme-bg" : "bg-theme-surface text-theme-text hover:bg-theme-surface-hover")}
        >
          HubSpot
        </button>
        <button 
          onClick={() => setProvider('salesforce')}
          className={cn("px-6 py-3 font-bold transition-all theme-button", provider === 'salesforce' ? "bg-theme-text text-theme-bg" : "bg-theme-surface text-theme-text hover:bg-theme-surface-hover")}
        >
          Salesforce
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3 p-4 bg-theme-surface border border-theme-border theme-button">
          <input 
            type="checkbox" 
            id="is_active"
            checked={form.is_active}
            onChange={e => setForm({...form, is_active: e.target.checked})}
            className="w-5 h-5 accent-brand-accent"
          />
          <label htmlFor="is_active" className="font-bold text-theme-text cursor-pointer">Enable {provider === 'hubspot' ? 'HubSpot' : 'Salesforce'} Integration</label>
        </div>

        {form.is_active && (
          <>
            <div>
              <label className="block text-sm font-bold text-theme-text-muted mb-2">
                {provider === 'hubspot' ? 'Private App Access Token' : 'Connected App Token'}
              </label>
              <input 
                type="password" 
                value={form.api_key}
                onChange={e => setForm({...form, api_key: e.target.value})}
                placeholder={config ? "••••••••••••••••••••••••" : "Paste your token here"} 
                className="w-full bg-theme-bg border border-theme-border text-theme-text p-3 focus:outline-none focus:border-brand-accent transition-colors theme-button font-mono text-sm"
              />
              <p className="text-xs text-theme-text-muted mt-2 font-medium">
                {config ? "Stored securely. Leave blank to keep current key." : "Required for initial setup."}
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-theme-text">Sync Options</h3>
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  id="sync_contacts"
                  checked={form.sync_contacts}
                  onChange={e => setForm({...form, sync_contacts: e.target.checked})}
                  className="w-4 h-4 accent-brand-accent"
                />
                <label htmlFor="sync_contacts" className="text-sm font-medium text-theme-text cursor-pointer">Sync new WhatsApp Contacts</label>
              </div>
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  id="sync_chats"
                  checked={form.sync_chats}
                  onChange={e => setForm({...form, sync_chats: e.target.checked})}
                  className="w-4 h-4 accent-brand-accent"
                />
                <label htmlFor="sync_chats" className="text-sm font-medium text-theme-text cursor-pointer">Sync Resolved Chats as Notes/Activities</label>
              </div>
            </div>
          </>
        )}
        
        <div className="pt-4 border-t border-theme-border">
          <button 
            type="submit" 
            disabled={saving}
            className="px-6 py-3 bg-brand-accent text-white font-bold transition-opacity hover:bg-brand-accent-light theme-button disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save CRM Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
};

const DeveloperSettings = ({ tenantId }: { tenantId: string, session: any }) => {
  const [generating, setGenerating] = useState(false);
  
  const { data: devSettings, isLoading, refetch } = useQuery({
    queryKey: ['developer_settings', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('developer_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
  });

  const handleGenerateKey = async () => {
    if (!window.confirm("Generating a new API key will invalidate any existing API key. Are you sure?")) {
      return;
    }
    
    setGenerating(true);
    // Secure random hex for the API key
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    const newKey = `sk_live_${hex}`;

    try {
      const { error } = await supabase
        .from('developer_settings')
        .upsert({
          tenant_id: tenantId,
          api_key: newKey,
          updated_at: new Date().toISOString()
        }, { onConflict: 'tenant_id' });

      if (error) throw error;
      alert('New API Key generated successfully!');
      refetch();
    } catch (err: any) {
      alert('Failed to generate key: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  if (isLoading) return <div className="text-theme-text-muted">Loading Developer settings...</div>;

  return (
    <div className="theme-card p-8 border-t-4 border-brand-accent">
      <h2 className="text-xl font-display font-bold text-theme-text mb-2 flex items-center gap-2">
        <Code size={24} /> Developer API
      </h2>
      <p className="text-theme-text-muted mb-6">
        Generate an API key to authenticate external services like Postman, Zapier, or your custom backend with Flought.
      </p>

      <div className="space-y-6 max-w-2xl">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-theme-text-muted">Secret API Key</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              readOnly
              value={devSettings?.api_key || 'No API key generated yet'}
              className="flex-1 bg-theme-bg border border-theme-border text-theme-text p-3 focus:outline-none transition-colors theme-button font-mono text-sm opacity-80"
            />
            {devSettings?.api_key && (
              <button 
                onClick={() => copyToClipboard(devSettings.api_key)}
                className="px-4 bg-theme-surface hover:bg-theme-surface-hover text-theme-text transition-colors border border-theme-border theme-button flex items-center gap-2"
                title="Copy to clipboard"
              >
                <Copy size={18} />
              </button>
            )}
          </div>
          <p className="text-xs text-theme-text-muted mt-1 font-medium text-red-500/80">
            Store this key securely. It provides full access to your Flought tenant API.
          </p>
        </div>

        <div className="pt-4 border-t border-theme-border flex gap-4">
          <button 
            onClick={handleGenerateKey}
            disabled={generating}
            className="px-6 py-3 bg-brand-accent text-white font-bold transition-opacity hover:bg-brand-accent-light theme-button disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw size={18} className={generating ? "animate-spin" : ""} />
            {devSettings?.api_key ? 'Regenerate API Key' : 'Generate Secret Key'}
          </button>
        </div>

        {devSettings?.api_key && (
          <div className="mt-8 p-6 border border-theme-border bg-theme-surface theme-button">
            <h3 className="font-bold text-theme-text mb-4">Example Request</h3>
            <pre className="bg-[#1A1A1A] text-[#E5E5E5] p-4 rounded-sm font-mono text-sm overflow-x-auto">
{`curl -X POST https://api.flought.com/api/v1/messages/send \\
  -H "Authorization: Bearer ${devSettings.api_key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "conversationId": "uuid-here",
    "text": "Hello from API!"
  }'`}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
