import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { Megaphone, Upload, Play, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { extractPhoneFromRow, extractNameFromRow } from '../lib/csv-utils';

const OneOffBroadcast: React.FC = () => {
  const { tenant, session } = useAuth();
  const navigate = useNavigate();
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [contacts, setContacts] = useState<any[]>([]);
  const [fileName, setFileName] = useState('');
  const [broadcastResult, setBroadcastResult] = useState<{ success: number, fail: number } | null>(null);

  const { data: templates = [], isLoading: loadingTemplates } = useQuery<any[]>({
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

  const broadcastMutation = useMutation({
    mutationFn: async (payload: { templateId: string, contacts: any[] }) => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/templates/${tenant!.id}/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session!.access_token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to broadcast');
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      setBroadcastResult({ status: data.status, jobCount: data.jobCount } as any);
    },
    onError: (err: Error) => {
      alert(err.message);
    }
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setBroadcastResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setContacts(results.data);
      },
      error: (err: any) => {
        console.error(err);
        alert('Failed to parse CSV file.');
      }
    });
  };

  const handleBroadcast = () => {
    if (!selectedTemplate) return alert('Select a template first.');
    if (contacts.length === 0) return alert('No valid contacts found in CSV.');
    
    // Ensure contacts have 'phone' or 'Phone'
    const validContacts = contacts.map(c => ({
      ...c,
      phone: extractPhoneFromRow(c),
      name: extractNameFromRow(c)
    })).filter(c => c.phone);

    if (validContacts.length === 0) {
      return alert('CSV must contain a column named "phone".');
    }

    if (window.confirm(`Are you sure you want to broadcast to ${validContacts.length} contacts?`)) {
      broadcastMutation.mutate({ templateId: selectedTemplate, contacts: validContacts });
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-theme-text mb-2">One-Off Broadcast</h1>
          <p className="text-theme-text-muted">Send a mass message to a list of contacts instantly.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="theme-card p-6 bg-theme-surface">
            <h2 className="text-xl font-display font-bold text-theme-text mb-4">1. Select Template</h2>
            {loadingTemplates ? (
              <p className="text-theme-text-muted font-medium">Loading templates...</p>
            ) : (
              <select 
                className="w-full border border-theme-border bg-theme-bg p-3 focus:border-brand-accent text-theme-text focus:outline-none transition-colors theme-button"
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
              >
                <option value="">-- Choose a template --</option>
                {templates.filter((t: any) => t.status === 'approved').map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                ))}
              </select>
            )}
            <p className="mt-4 text-sm text-theme-text-muted font-medium flex items-center gap-2">
              Don't see your template? 
              <button onClick={() => navigate('/templates')} className="text-brand-accent hover:text-brand-accent-light font-bold flex items-center gap-1 transition-colors">
                Create one here <ExternalLink size={14} />
              </button>
            </p>
          </div>

          <div className="theme-card p-6 bg-theme-surface">
            <h2 className="text-xl font-display font-bold text-theme-text mb-4">2. Upload Contacts (CSV)</h2>
            <div className="border-2 border-dashed border-theme-border bg-theme-bg p-8 text-center hover:border-brand-accent transition-colors relative" style={{ borderRadius: 'var(--radius-card)' }}>
              <input 
                type="file" 
                accept=".csv"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="mx-auto h-8 w-8 text-theme-text-muted mb-3" />
              <p className="font-bold text-theme-text">
                {fileName ? fileName : 'Click or drag CSV here'}
              </p>
              <p className="text-sm text-theme-text-muted mt-2 font-medium">Automatic phone number mapping enabled.</p>
            </div>
          </div>
          
          <button 
            onClick={handleBroadcast}
            disabled={!selectedTemplate || contacts.length === 0 || broadcastMutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-brand-accent text-white font-bold py-4 hover:bg-brand-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed theme-button shadow-md"
          >
            <Play size={20} />
            {broadcastMutation.isPending ? 'Queuing Broadcast...' : `Broadcast to ${contacts.length} Contacts`}
          </button>

          {broadcastResult && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20" style={{ borderRadius: 'var(--radius-card)' }}>
              <h3 className="font-bold flex items-center gap-2 text-blue-600">
                <CheckCircle className="text-blue-600" />
                Broadcast Queued
              </h3>
              <p className="mt-2 text-sm text-blue-600/80 font-medium">
                Successfully queued <strong className="text-blue-700">{(broadcastResult as any).jobCount}</strong> messages for background processing.<br/>
                They are being sent automatically by our job queue.
              </p>
            </div>
          )}
        </div>

        <div className="theme-card p-6 self-start bg-theme-surface">
          <h2 className="text-xl font-display font-bold text-theme-text mb-4">CSV Preview</h2>
          {contacts.length === 0 ? (
            <p className="text-theme-text-muted text-center italic py-12 border-2 border-dashed border-theme-border bg-theme-bg" style={{ borderRadius: 'var(--radius-card)' }}>No data to preview. Upload a CSV file.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-theme-border">
              <table className="w-full text-left text-sm border-collapse bg-theme-bg">
                <thead>
                  <tr className="border-b border-theme-border bg-theme-surface-hover">
                    {Object.keys(contacts[0]).slice(0, 4).map(key => (
                      <th key={key} className="py-3 px-4 font-bold text-theme-text-muted uppercase tracking-wider text-xs border-r border-theme-border last:border-r-0">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border">
                  {contacts.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="hover:bg-theme-surface-hover transition-colors">
                      {Object.keys(contacts[0]).slice(0, 4).map(key => (
                        <td key={key} className="py-3 px-4 text-theme-text border-r border-theme-border last:border-r-0">{row[key]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {contacts.length > 5 && (
                <p className="text-center text-xs text-brand-accent mt-0 font-bold uppercase tracking-wider bg-brand-accent/5 py-3 border-t border-theme-border">
                  + {contacts.length - 5} more rows
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OneOffBroadcast;
