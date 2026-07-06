import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle, Clock, XCircle, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const TemplateManager: React.FC = () => {
  const queryClient = useQueryClient();
  const { tenant, session } = useAuth();
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('utility');
  const [body, setBody] = useState('');
  const [headerType, setHeaderType] = useState('none');
  const [headerContent, setHeaderContent] = useState('');
  const [footer, setFooter] = useState('');
  const [buttons, setButtons] = useState<{ type: string, text: string, url: string }[]>([]);

  const { data: templates = [], isLoading: loading } = useQuery<any[]>({
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

  const createMutation = useMutation({
    mutationFn: async (payload: { 
      name: string, category: string, body: string, 
      headerType?: string, headerContent?: string, footer?: string, buttons?: any[] 
    }) => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/templates/${tenant!.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session!.access_token}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to create template');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates', tenant?.id] });
      setShowModal(false);
      setName('');
      setBody('');
      setHeaderType('none');
      setHeaderContent('');
      setFooter('');
      setButtons([]);
    },
    onError: (err: Error) => {
      alert(err.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !session) return;
    createMutation.mutate({ 
      name, category, body, 
      headerType: headerType !== 'none' ? headerType : undefined,
      headerContent: headerType !== 'none' ? headerContent : undefined,
      footer: footer || undefined,
      buttons: buttons.length > 0 ? buttons : undefined
    });
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-8 animate-pulse">
        <div className="flex justify-between items-end">
          <div className="space-y-2">
            <div className="h-8 w-64 bg-theme-border/30 rounded"></div>
            <div className="h-4 w-96 bg-theme-border/20 rounded"></div>
          </div>
          <div className="h-12 w-40 bg-theme-border/30 rounded"></div>
        </div>
        <div className="theme-card overflow-hidden">
          <div className="h-12 bg-theme-border/20 border-b border-theme-border"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 border-b border-theme-border/10"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-display font-bold text-theme-text mb-2">Message Templates</h1>
          <p className="text-theme-text-muted">Manage pre-approved WhatsApp templates for outbound messaging.</p>
        </div>
        <button 
          className="px-6 py-3 bg-brand-accent text-white font-bold hover:bg-brand-accent-light transition-colors flex items-center gap-2 theme-button shadow-sm"
          onClick={() => setShowModal(true)}
        >
          <Plus size={18} /> New Template
        </button>
      </div>

      <div className="theme-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-theme-bg border-b border-theme-border">
                  <th className="p-4 font-bold text-theme-text-muted uppercase tracking-wider text-sm">Template Name</th>
                  <th className="p-4 font-bold text-theme-text-muted uppercase tracking-wider text-sm">Category</th>
                  <th className="p-4 font-bold text-theme-text-muted uppercase tracking-wider text-sm">Status</th>
                  <th className="p-4 font-bold text-theme-text-muted uppercase tracking-wider text-sm">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border bg-theme-surface">
                {templates.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-theme-text-muted py-8 font-medium">
                      No templates created yet.
                    </td>
                  </tr>
                )}
                {templates.map((template: any) => (
                  <tr key={template.id} className="hover:bg-theme-surface-hover transition-colors">
                    <td className="p-4">
                      <div className="flex flex-col">
                        <strong className="text-theme-text font-bold">{template.name}</strong>
                        <div className="flex gap-1 mt-1">
                          {template.header_type && template.header_type !== 'text' && (
                            <span className="text-[0.6rem] bg-purple-500/10 text-purple-500 border border-purple-500/20 px-1 py-0.5 rounded font-bold uppercase">
                              {template.header_type}
                            </span>
                          )}
                          {template.buttons && template.buttons.length > 0 && (
                            <span className="text-[0.6rem] bg-blue-500/10 text-blue-500 border border-blue-500/20 px-1 py-0.5 rounded font-bold uppercase">
                              {template.buttons.length} Buttons
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-theme-text capitalize">{template.category}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                        template.status === 'approved' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                        template.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                        template.status === 'rejected' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                        'bg-theme-bg text-theme-text-muted border-theme-border'
                      }`}>
                        {template.status === 'approved' && <CheckCircle size={14} />}
                        {template.status === 'pending' && <Clock size={14} />}
                        {template.status === 'rejected' && <XCircle size={14} />}
                        {template.status}
                      </span>
                    </td>
                    <td className="p-4 text-theme-text-muted font-medium">
                      {new Date(template.updated_at || template.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="theme-card p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
            <div className="flex justify-between items-center mb-6 border-b border-theme-border pb-4">
              <h2 className="text-2xl font-display font-bold text-theme-text">Create Template</h2>
              <button onClick={() => setShowModal(false)} className="text-theme-text-muted hover:text-theme-text transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-theme-text-muted mb-2">Template Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  placeholder="e.g. order_update_v1"
                  required 
                  className="w-full p-3 border border-theme-border bg-theme-bg text-theme-text focus:border-brand-accent focus:outline-none transition-colors font-mono text-sm theme-button"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-theme-text-muted mb-2">Category</label>
                <select 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-3 border border-theme-border bg-theme-bg text-theme-text focus:border-brand-accent focus:outline-none transition-colors theme-button"
                >
                  <option value="utility">Utility</option>
                  <option value="marketing">Marketing</option>
                  <option value="authentication">Authentication</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-theme-text-muted mb-2">Message Body</label>
                <textarea 
                  value={body} 
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Hello {{1}}, your order is confirmed."
                  required 
                  rows={4}
                  className="w-full p-3 border border-theme-border bg-theme-bg text-theme-text focus:border-brand-accent focus:outline-none transition-colors resize-none theme-button"
                ></textarea>
                <p className="text-xs text-theme-text-muted mt-2 font-medium">Use {'{{1}}'}, {'{{2}}'} for variables.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-theme-text-muted mb-2">Header (Optional)</label>
                <select 
                  value={headerType} 
                  onChange={(e) => setHeaderType(e.target.value)}
                  className="w-full p-3 border border-theme-border bg-theme-bg text-theme-text focus:border-brand-accent focus:outline-none mb-3 theme-button"
                >
                  <option value="none">None</option>
                  <option value="text">Text</option>
                  <option value="image">Image URL</option>
                  <option value="video">Video URL</option>
                  <option value="document">Document URL</option>
                </select>
                {headerType !== 'none' && (
                  <input 
                    type="text" 
                    value={headerContent} 
                    onChange={(e) => setHeaderContent(e.target.value)}
                    placeholder={headerType === 'text' ? "e.g. Welcome" : "https://example.com/media.png"}
                    className="w-full p-3 border border-theme-border bg-theme-bg text-theme-text focus:border-brand-accent focus:outline-none theme-button"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-theme-text-muted mb-2">Footer (Optional)</label>
                <input 
                  type="text" 
                  value={footer} 
                  onChange={(e) => setFooter(e.target.value)}
                  placeholder="e.g. Reply STOP to opt out"
                  className="w-full p-3 border border-theme-border bg-theme-bg text-theme-text focus:border-brand-accent focus:outline-none theme-button"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-theme-text-muted mb-3">Buttons (Optional, Max 3)</label>
                {buttons.map((btn, idx) => (
                  <div key={idx} className="flex gap-3 mb-3 items-center bg-theme-bg p-3 border border-theme-border" style={{ borderRadius: 'var(--radius-button)' }}>
                    <select 
                      value={btn.type}
                      onChange={(e) => {
                        const newBtns = [...buttons];
                        newBtns[idx].type = e.target.value;
                        setButtons(newBtns);
                      }}
                      className="w-1/3 p-2 bg-theme-surface border border-theme-border text-theme-text focus:outline-none text-sm theme-button"
                    >
                      <option value="quick_reply">Quick Reply</option>
                      <option value="url">URL</option>
                    </select>
                    <input 
                      type="text"
                      placeholder="Button Text"
                      value={btn.text}
                      onChange={(e) => {
                        const newBtns = [...buttons];
                        newBtns[idx].text = e.target.value;
                        setButtons(newBtns);
                      }}
                      className="w-1/3 p-2 bg-theme-surface border border-theme-border text-theme-text focus:outline-none text-sm theme-button"
                    />
                    {btn.type === 'url' && (
                      <input 
                        type="url"
                        placeholder="https://..."
                        value={btn.url}
                        onChange={(e) => {
                          const newBtns = [...buttons];
                          newBtns[idx].url = e.target.value;
                          setButtons(newBtns);
                        }}
                        className="w-1/3 p-2 bg-theme-surface border border-theme-border text-theme-text focus:outline-none text-sm theme-button"
                      />
                    )}
                    <button type="button" onClick={() => setButtons(buttons.filter((_, i) => i !== idx))} className="text-red-500 hover:bg-red-500/10 p-2 rounded-full transition-colors ml-auto">
                      <X size={16}/>
                    </button>
                  </div>
                ))}
                {buttons.length < 3 && (
                  <button 
                    type="button" 
                    onClick={() => setButtons([...buttons, { type: 'quick_reply', text: '', url: '' }])}
                    className="text-sm font-bold text-brand-accent hover:text-brand-accent-light flex items-center gap-1 mt-2"
                  >
                    <Plus size={16}/> Add Button
                  </button>
                )}
              </div>

              <div className="pt-4 border-t border-theme-border flex gap-4">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 border border-theme-border text-theme-text font-bold hover:bg-theme-surface-hover transition-colors theme-button"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={createMutation.isPending}
                  className="flex-1 bg-brand-accent text-white font-bold py-3 hover:bg-brand-accent-light transition-colors disabled:opacity-50 theme-button shadow-sm"
                >
                  {createMutation.isPending ? 'Submitting...' : 'Submit to BSP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateManager;
