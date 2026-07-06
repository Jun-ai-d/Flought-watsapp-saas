import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Clock, Save, Play, Upload } from 'lucide-react';
import Papa from 'papaparse';
import { extractPhoneFromRow } from '../lib/csv-utils';

const DripSequences: React.FC = () => {
  const { tenant, session } = useAuth();
  const queryClient = useQueryClient();
  const [showBuilder, setShowBuilder] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [steps, setSteps] = useState<{ templateId: string, delayHours: number, stepOrder: number }[]>([]);
  
  const [selectedCampaignForEnrollment, setSelectedCampaignForEnrollment] = useState('');
  const [contacts, setContacts] = useState<any[]>([]);
  const [fileName, setFileName] = useState('');
  const [enrollResult, setEnrollResult] = useState<{ enrolledCount: number, scheduledJobs: number } | null>(null);

  const { data: campaigns = [], isLoading: loadingCampaigns } = useQuery<any[]>({
    queryKey: ['campaigns', tenant?.id],
    queryFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/campaigns/${tenant!.id}`, {
        headers: { 'Authorization': `Bearer ${session!.access_token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch campaigns');
      return res.json();
    },
    enabled: !!tenant?.id && !!session?.access_token,
  });

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ['templates', tenant?.id],
    queryFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/templates/${tenant!.id}`, {
        headers: { 'Authorization': `Bearer ${session!.access_token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch templates');
      return res.json();
    },
    enabled: !!tenant?.id && !!session?.access_token,
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (payload: { name: string, steps: any[] }) => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/campaigns/${tenant!.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session!.access_token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to create campaign');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', tenant?.id] });
      setShowBuilder(false);
      setNewCampaignName('');
      setSteps([]);
    },
    onError: (err: Error) => alert(err.message)
  });

  const enrollMutation = useMutation({
    mutationFn: async (payload: { campaignId: string, contacts: any[] }) => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/campaigns/${tenant!.id}/${payload.campaignId}/enroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session!.access_token}`
        },
        body: JSON.stringify({ contacts: payload.contacts })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to enroll');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setEnrollResult({ enrolledCount: data.enrolledCount, scheduledJobs: data.scheduledJobs });
    },
    onError: (err: Error) => alert(err.message)
  });

  const handleAddStep = () => {
    setSteps([...steps, { templateId: '', delayHours: 0, stepOrder: steps.length + 1 }]);
  };

  const updateStep = (index: number, field: string, value: any) => {
    const newSteps = [...steps];
    (newSteps[index] as any)[field] = value;
    setSteps(newSteps);
  };

  const handleCreateCampaign = () => {
    if (!newCampaignName) return alert('Name is required');
    if (steps.length === 0) return alert('Add at least one step');
    if (steps.some(s => !s.templateId)) return alert('All steps must have a template selected');
    
    createCampaignMutation.mutate({ name: newCampaignName, steps });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setEnrollResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => setContacts(results.data),
      error: () => alert('Failed to parse CSV')
    });
  };

  const handleEnroll = () => {
    if (!selectedCampaignForEnrollment) return alert('Select a campaign first');
    if (contacts.length === 0) return alert('No valid contacts in CSV');

    const validContacts = contacts.map(c => ({
      ...c,
      phone: extractPhoneFromRow(c)
    })).filter(c => c.phone);

    if (validContacts.length === 0) return alert('CSV must contain a column named "phone".');

    enrollMutation.mutate({ campaignId: selectedCampaignForEnrollment, contacts: validContacts });
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-theme-text mb-2">Drip Campaigns</h1>
          <p className="text-theme-text-muted">Automate multi-step WhatsApp message sequences.</p>
        </div>
      </div>
      
      {/* List / Enroll Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Existing Campaigns */}
        <div className="theme-card p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-display font-bold text-theme-text">Your Drip Campaigns</h2>
            <button 
              onClick={() => setShowBuilder(!showBuilder)}
              className="bg-theme-text text-theme-bg px-4 py-2 font-bold flex items-center gap-2 hover:bg-brand-accent hover:text-white transition-colors theme-button shadow-sm"
            >
              <Plus size={18} /> New Campaign
            </button>
          </div>
          
          {loadingCampaigns ? (
            <p className="text-theme-text-muted font-medium">Loading campaigns...</p>
          ) : campaigns.length === 0 ? (
            <p className="text-theme-text-muted italic bg-theme-surface p-4 border border-dashed border-theme-border rounded-lg text-center">No drip campaigns found. Create one to get started.</p>
          ) : (
            <div className="space-y-4">
              {campaigns.map((c: any) => (
                <div key={c.id} className="border border-theme-border bg-theme-surface p-4 hover:border-brand-accent transition-colors theme-button cursor-pointer flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-theme-text text-lg">{c.name}</h3>
                    <p className="text-sm text-brand-accent mt-1 font-medium bg-brand-accent/10 inline-block px-2 py-0.5 rounded-full">{c.drip_steps.length} steps configured</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Enrollment */}
        <div className="theme-card p-6">
          <h2 className="text-xl font-display font-bold text-theme-text mb-4">Enroll Contacts</h2>
          
          <div className="space-y-4">
            <select 
              className="w-full border border-theme-border bg-theme-surface p-3 focus:border-brand-accent text-theme-text focus:outline-none theme-button font-bold"
              value={selectedCampaignForEnrollment}
              onChange={(e) => setSelectedCampaignForEnrollment(e.target.value)}
            >
              <option value="">-- Choose a Campaign --</option>
              {campaigns.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <div className="border-2 border-dashed border-theme-border p-8 text-center hover:border-brand-accent transition-colors relative bg-theme-surface" style={{ borderRadius: 'var(--radius-card)' }}>
              <input 
                type="file" 
                accept=".csv"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="mx-auto h-8 w-8 text-theme-text-muted mb-3" />
              <p className="font-bold text-theme-text">{fileName ? fileName : 'Upload CSV'}</p>
              <p className="text-xs text-theme-text-muted mt-2">Automatic phone number mapping enabled.</p>
            </div>

            <button 
              onClick={handleEnroll}
              disabled={!selectedCampaignForEnrollment || contacts.length === 0 || enrollMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-brand-accent text-white font-bold py-4 hover:bg-brand-accent-light transition-colors disabled:opacity-50 theme-button shadow-md"
            >
              <Play size={18} />
              {enrollMutation.isPending ? 'Enrolling...' : 'Start Campaign'}
            </button>

            {enrollResult && (
              <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-700" style={{ borderRadius: 'var(--radius-card)' }}>
                <h3 className="font-bold flex items-center gap-2">Success</h3>
                <p className="text-sm mt-1">
                  Enrolled {enrollResult.enrolledCount} contacts.<br/>
                  Scheduled {enrollResult.scheduledJobs} background jobs.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Builder Section */}
      {showBuilder && (
        <div className="theme-card p-8 bg-theme-surface mt-8 shadow-xl">
          <h2 className="text-2xl font-display font-bold text-theme-text mb-6 border-b border-theme-border pb-4">Build Drip Sequence</h2>
          
          <div className="mb-6">
            <label className="block font-bold text-theme-text-muted mb-2">Campaign Name</label>
            <input 
              type="text" 
              className="w-full border border-theme-border bg-theme-bg p-3 focus:border-brand-accent text-theme-text focus:outline-none theme-button"
              placeholder="e.g. Black Friday Welcome Series"
              value={newCampaignName}
              onChange={(e) => setNewCampaignName(e.target.value)}
            />
          </div>

          <div className="space-y-4 mb-8">
            <h3 className="font-bold text-theme-text">Sequence Steps</h3>
            {steps.map((step, idx) => (
              <div key={idx} className="flex gap-4 items-center bg-theme-bg border border-theme-border p-4 relative theme-button shadow-sm">
                <div className="bg-theme-text text-theme-bg w-8 h-8 flex items-center justify-center font-bold" style={{ borderRadius: 'var(--radius-button)' }}>
                  {idx + 1}
                </div>
                
                <div className="flex-1">
                  <label className="block text-xs font-bold text-theme-text-muted uppercase mb-1">Send Template</label>
                  <select 
                    className="w-full border border-theme-border bg-theme-surface p-2 focus:border-brand-accent text-theme-text focus:outline-none theme-button"
                    value={step.templateId}
                    onChange={(e) => updateStep(idx, 'templateId', e.target.value)}
                  >
                    <option value="">-- Select Template --</option>
                    {templates.filter((t: any) => t.status === 'approved').map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1">
                  <label className="block text-xs font-bold text-theme-text-muted uppercase mb-1 flex items-center gap-1">
                    <Clock size={12}/> Delay (Hours)
                  </label>
                  <input 
                    type="number"
                    min="0"
                    className="w-full border border-theme-border bg-theme-surface p-2 focus:border-brand-accent text-theme-text focus:outline-none theme-button"
                    value={step.delayHours}
                    onChange={(e) => updateStep(idx, 'delayHours', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-[10px] text-theme-text-muted mt-1">Wait time before sending</p>
                </div>
              </div>
            ))}
            
            <button 
              onClick={handleAddStep}
              className="text-brand-accent font-bold text-sm flex items-center gap-1 hover:text-brand-accent-light"
            >
              <Plus size={16} /> Add Step
            </button>
          </div>

          <button 
            onClick={handleCreateCampaign}
            disabled={createCampaignMutation.isPending}
            className="w-full bg-theme-text text-theme-bg py-4 font-bold flex items-center justify-center gap-2 hover:bg-brand-accent transition-colors theme-button shadow-lg"
          >
            <Save size={18} /> {createCampaignMutation.isPending ? 'Saving...' : 'Save Campaign'}
          </button>
        </div>
      )}
    </div>
  );
};

export default DripSequences;
