import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, Edit2, X, Check, Sparkles, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useTrialStatus } from '../hooks/useTrialStatus';

type FaqStatus = 'published' | 'draft' | 'rejected';
type FaqTab = 'published' | 'suggestions' | 'rejected';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  match_count: number;
  status?: FaqStatus;
  source?: string;
  needs_review?: boolean;
}

const FAQManager: React.FC = () => {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();
  const trial = useTrialStatus();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FaqTab>('published');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ question: '', answer: '', keywords: '' });

  const { data: faqs = [], isLoading: loading } = useQuery<FAQ[]>({
    queryKey: ['faqs', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as FAQ[];
    },
    enabled: !!tenant?.id,
  });

  const publishedCount = faqs.filter((f) => (f.status ?? 'published') === 'published').length;

  const tabFaqs = faqs.filter((f) => {
    const status = f.status ?? 'published';
    if (activeTab === 'published') return status === 'published';
    if (activeTab === 'suggestions') return status === 'draft';
    return status === 'rejected';
  });

  const filteredFaqs = tabFaqs.filter(
    (f) =>
      f.question.toLowerCase().includes(search.toLowerCase()) ||
      f.answer.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenModal = (faq?: FAQ) => {
    if (faq) {
      setEditingId(faq.id);
      setFormData({
        question: faq.question,
        answer: faq.answer,
        keywords: (faq.keywords || []).join(', '),
      });
    } else {
      setEditingId(null);
      setFormData({ question: '', answer: '', keywords: '' });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      id?: string;
      question: string;
      answer: string;
      keywords: string[];
      status?: FaqStatus;
      reviewed_at?: string;
      needs_review?: boolean;
    }) => {
      if (payload.id) {
        const { data, error } = await (supabase.from('faqs') as any)
          .update({
            question: payload.question,
            answer: payload.answer,
            keywords: payload.keywords,
            updated_at: new Date().toISOString(),
            ...(payload.status ? { status: payload.status } : {}),
            ...(payload.reviewed_at ? { reviewed_at: payload.reviewed_at } : {}),
            ...(payload.needs_review !== undefined ? { needs_review: payload.needs_review } : {}),
          })
          .eq('id', payload.id)
          .eq('tenant_id', tenant!.id)
          .select();
        if (error) throw error;
        return data[0];
      }

      const { data, error } = await (supabase.from('faqs') as any)
        .insert({
          tenant_id: tenant!.id,
          question: payload.question,
          answer: payload.answer,
          keywords: payload.keywords,
          status: 'published',
          source: 'manual',
        })
        .select();
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faqs', tenant?.id] });
      handleCloseModal();
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'published' | 'rejected' }) => {
      const { error } = await (supabase.from('faqs') as any)
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          needs_review: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('tenant_id', tenant!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['faqs', tenant?.id] }),
  });

  const deleteMutation = useMutation<any, Error, string>({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('faqs').delete().eq('id', id).eq('tenant_id', tenant!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['faqs', tenant?.id] }),
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    const keywordsArray = formData.keywords
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k !== '');
    saveMutation.mutate({
      id: editingId || undefined,
      question: formData.question,
      answer: formData.answer,
      keywords: keywordsArray,
    });
  };

  const tabs: { id: FaqTab; label: string; count: number }[] = [
    { id: 'published', label: 'Published', count: faqs.filter((f) => (f.status ?? 'published') === 'published').length },
    { id: 'suggestions', label: 'Suggestions', count: faqs.filter((f) => f.status === 'draft').length },
    { id: 'rejected', label: 'Rejected', count: faqs.filter((f) => f.status === 'rejected').length },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-display font-bold text-theme-text mb-2">FAQ Manager</h1>
          <p className="text-theme-text-muted">
            Published FAQs auto-reply via keyword match. AI-mined suggestions stay draft until you approve.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {trial?.enforceSetupCaps && (
            <span className="px-3 py-1 bg-brand-accent/10 text-brand-accent font-bold rounded-full text-sm whitespace-nowrap">
              Trial Limit: {publishedCount}/10
            </span>
          )}
          <button
            className="px-6 py-3 bg-brand-accent text-white font-bold hover:bg-brand-accent-light transition-colors flex items-center gap-2 theme-button shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => handleOpenModal()}
            disabled={trial?.enforceSetupCaps && publishedCount >= 10}
          >
            <Plus size={18} /> Add New FAQ
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-theme-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-bold border-b-2 -mb-px transition-colors',
              activeTab === tab.id
                ? 'border-brand-accent text-brand-accent'
                : 'border-transparent text-theme-text-muted hover:text-theme-text'
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-2 text-xs bg-theme-bg px-2 py-0.5 rounded-full">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="theme-card">
        <div className="p-6 border-b border-theme-border flex justify-between items-center bg-theme-surface">
          <div className="relative w-1/2">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted" />
            <input
              type="text"
              placeholder="Search FAQs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-theme-border bg-theme-bg text-theme-text focus:border-brand-accent focus:outline-none transition-colors theme-button"
            />
          </div>
          <div className="text-theme-text-muted font-medium text-sm">
            {loading ? 'Loading...' : `${filteredFaqs.length} ${filteredFaqs.length === 1 ? 'entry' : 'entries'}`}
          </div>
        </div>

        <div className="divide-y divide-theme-border bg-theme-surface">
          {filteredFaqs.map((faq) => (
            <div key={faq.id} className="p-6 flex justify-between items-start hover:bg-theme-surface-hover transition-colors">
              <div className="flex-1 pr-8">
                <h3 className="text-lg font-bold text-theme-text flex items-center gap-2 mb-2 flex-wrap">
                  {faq.question}
                  {faq.source === 'auto_miner' && (
                    <span className="text-xs bg-purple-500/10 text-purple-500 border border-purple-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
                      <Sparkles size={12} /> AI suggestion
                    </span>
                  )}
                  {faq.needs_review && (
                    <span className="text-xs bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 px-2 py-0.5 rounded-full font-bold">
                      Needs review
                    </span>
                  )}
                  {faq.match_count > 0 && activeTab === 'published' && (
                    <span className="text-xs bg-brand-accent/10 text-brand-accent border border-brand-accent/20 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
                      <Check size={12} /> {faq.match_count} matches
                    </span>
                  )}
                </h3>
                <p className="text-theme-text-muted leading-relaxed">{faq.answer}</p>
                {faq.keywords && faq.keywords.length > 0 && (
                  <div className="flex gap-2 mt-4 flex-wrap">
                    {faq.keywords.map((kw, i) => (
                      <span key={i} className="text-xs bg-theme-bg border border-theme-border px-2 py-1 text-theme-text-muted font-mono theme-button">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {activeTab === 'suggestions' && (
                  <>
                    <button
                      className="p-2 text-green-600 hover:bg-green-500/10 transition-colors theme-button"
                      title="Approve & publish"
                      onClick={() => reviewMutation.mutate({ id: faq.id, status: 'published' })}
                    >
                      <Check size={18} />
                    </button>
                    <button
                      className="p-2 text-theme-text-muted hover:text-brand-accent hover:bg-brand-accent/10 transition-colors theme-button"
                      onClick={() => handleOpenModal(faq)}
                      aria-label="Edit before publish"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      className="p-2 text-red-500 hover:bg-red-500/10 transition-colors theme-button"
                      title="Reject"
                      onClick={() => reviewMutation.mutate({ id: faq.id, status: 'rejected' })}
                    >
                      <XCircle size={18} />
                    </button>
                  </>
                )}
                {activeTab === 'published' && (
                  <>
                    <button className="p-2 text-theme-text-muted hover:text-brand-accent hover:bg-brand-accent/10 transition-colors theme-button" onClick={() => handleOpenModal(faq)}>
                      <Edit2 size={18} />
                    </button>
                    <button className="p-2 text-theme-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors theme-button" onClick={() => deleteMutation.mutate(faq.id)}>
                      <Trash2 size={18} />
                    </button>
                  </>
                )}
                {activeTab === 'rejected' && (
                  <button className="p-2 text-theme-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors theme-button" onClick={() => deleteMutation.mutate(faq.id)}>
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {!loading && filteredFaqs.length === 0 && (
            <div className="p-12 text-center text-theme-text-muted font-medium">
              <p>
                {activeTab === 'suggestions'
                  ? 'No pending suggestions. The nightly miner creates drafts when it finds repeated questions.'
                  : activeTab === 'rejected'
                    ? 'No rejected FAQs.'
                    : 'No published FAQs yet.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="theme-card p-8 w-full max-w-2xl relative">
            <button className="absolute top-4 right-4 text-theme-text-muted hover:text-theme-text transition-colors" onClick={handleCloseModal}>
              <X size={24} />
            </button>

            <h2 className="text-2xl font-display font-bold text-theme-text mb-6">{editingId ? 'Edit FAQ' : 'Add New FAQ'}</h2>

            <form onSubmit={handleSave} className="flex flex-col gap-6">
              <div>
                <label className="block text-sm font-bold text-theme-text-muted mb-2">Question</label>
                <input
                  type="text"
                  required
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  className="w-full bg-theme-bg border border-theme-border p-3 text-theme-text focus:border-brand-accent focus:outline-none transition-colors theme-button"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-theme-text-muted mb-2">Answer (AI Response)</label>
                <textarea
                  required
                  value={formData.answer}
                  onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                  className="w-full bg-theme-bg border border-theme-border p-3 text-theme-text focus:border-brand-accent focus:outline-none transition-colors min-h-[100px] resize-none theme-button"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-theme-text-muted mb-2">Keywords (comma separated)</label>
                <input
                  type="text"
                  value={formData.keywords}
                  onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                  className="w-full bg-theme-bg border border-theme-border p-3 text-theme-text focus:border-brand-accent focus:outline-none transition-colors theme-button"
                  placeholder="e.g. hours, timing, open"
                />
              </div>

              <div className="flex justify-end gap-4 mt-4 pt-4 border-t border-theme-border">
                <button type="button" onClick={handleCloseModal} className="px-6 py-2 border border-theme-border text-theme-text hover:bg-theme-surface-hover transition-colors theme-button">
                  Cancel
                </button>
                <button type="submit" disabled={saveMutation.isPending} className="px-6 py-2 bg-brand-accent hover:bg-brand-accent-light text-white font-bold disabled:opacity-50 transition-colors theme-button shadow-sm">
                  {saveMutation.isPending ? 'Saving...' : 'Save FAQ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FAQManager;
