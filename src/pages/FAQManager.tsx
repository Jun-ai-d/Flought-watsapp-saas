import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, Edit2, X, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  match_count: number;
}

const FAQManager: React.FC = () => {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();
  const [search, setSearch] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ question: '', answer: '', keywords: '' });

  const { data: faqs = [], isLoading: loading } = useQuery<any[]>({
    queryKey: ['faqs', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  const filteredFaqs = faqs.filter(f => 
    f.question.toLowerCase().includes(search.toLowerCase()) || 
    f.answer.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenModal = (faq?: FAQ) => {
    if (faq) {
      setEditingId(faq.id);
      setFormData({
        question: faq.question,
        answer: faq.answer,
        keywords: (faq.keywords || []).join(', ')
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
    mutationFn: async (payload: { id?: string, question: string, answer: string, keywords: string[] }) => {
      if (payload.id) {
        const { data, error } = await (supabase
          .from('faqs') as any)
          .update({
            question: payload.question,
            answer: payload.answer,
            keywords: payload.keywords,
            updated_at: new Date().toISOString()
          })
          .eq('id', payload.id)
          .eq('tenant_id', tenant!.id)
          .select();
        if (error) throw error;
        return data[0];
      } else {
        const { data, error } = await (supabase
          .from('faqs') as any)
          .insert({
            tenant_id: tenant!.id,
            question: payload.question,
            answer: payload.answer,
            keywords: payload.keywords
          })
          .select();
        if (error) throw error;
        return data[0];
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faqs', tenant?.id] });
      handleCloseModal();
    }
  });

  const deleteMutation = useMutation<any, Error, string>({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('faqs')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenant!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faqs', tenant?.id] });
    }
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    const keywordsArray = formData.keywords.split(',').map(k => k.trim()).filter(k => k !== '');
    saveMutation.mutate({
      id: editingId || undefined,
      question: formData.question,
      answer: formData.answer,
      keywords: keywordsArray
    });
  };

  const handleDelete = (id: string) => {
    if (!tenant) return;
    if (window.confirm('Are you sure you want to delete this FAQ?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-display font-bold text-theme-text mb-2">FAQ Manager</h1>
          <p className="text-theme-text-muted">These answers are used by the AI to instantly resolve common queries.</p>
        </div>
        <div className="flex items-center gap-4">
          {tenant?.plan_type === 'trial' && (
            <span className="px-3 py-1 bg-brand-accent/10 text-brand-accent font-bold rounded-full text-sm whitespace-nowrap">
              Trial Limit: {faqs.length}/10
            </span>
          )}
          <button 
            className="px-6 py-3 bg-brand-accent text-white font-bold hover:bg-brand-accent-light transition-colors flex items-center gap-2 theme-button shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => handleOpenModal()}
            disabled={tenant?.plan_type === 'trial' && faqs.length >= 10}
            title={tenant?.plan_type === 'trial' && faqs.length >= 10 ? "Trial limit reached. Please upgrade to add more." : ""}
          >
            <Plus size={18} /> Add New FAQ
          </button>
        </div>
      </div>

      <div className="theme-card">
        <div className="p-6 border-b border-theme-border flex justify-between items-center bg-theme-surface">
          <div className="relative w-1/2">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted" />
            <input 
              type="text" 
              placeholder="Search existing FAQs..." 
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
          {filteredFaqs.map(faq => (
            <div key={faq.id} className="p-6 flex justify-between items-start hover:bg-theme-surface-hover transition-colors">
              <div className="flex-1 pr-8">
                <h3 className="text-lg font-bold text-theme-text flex items-center gap-2 mb-2">
                  {faq.question}
                  {faq.match_count > 0 && (
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
                <button 
                  className="p-2 text-theme-text-muted hover:text-brand-accent hover:bg-brand-accent/10 transition-colors theme-button"
                  onClick={() => handleOpenModal(faq)} 
                  aria-label="Edit FAQ"
                >
                  <Edit2 size={18} />
                </button>
                <button 
                  className="p-2 text-theme-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors theme-button"
                  onClick={() => handleDelete(faq.id)} 
                  aria-label="Delete FAQ"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}

          {!loading && filteredFaqs.length === 0 && (
            <div className="p-12 text-center text-theme-text-muted font-medium">
              <p>No FAQs found matching your search.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="theme-card p-8 w-full max-w-2xl relative">
            <button 
              className="absolute top-4 right-4 text-theme-text-muted hover:text-theme-text transition-colors" 
              onClick={handleCloseModal}
            >
              <X size={24} />
            </button>
            
            <h2 className="text-2xl font-display font-bold text-theme-text mb-6">
              {editingId ? 'Edit FAQ' : 'Add New FAQ'}
            </h2>
            
            <form onSubmit={handleSave} className="flex flex-col gap-6">
              <div>
                <label className="block text-sm font-bold text-theme-text-muted mb-2">Question</label>
                <input 
                  type="text" 
                  required
                  value={formData.question}
                  onChange={e => setFormData({...formData, question: e.target.value})}
                  className="w-full bg-theme-bg border border-theme-border p-3 text-theme-text focus:border-brand-accent focus:outline-none transition-colors theme-button"
                  placeholder="e.g. What are your hours of operation?"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-theme-text-muted mb-2">Answer (AI Response)</label>
                <textarea 
                  required
                  value={formData.answer}
                  onChange={e => setFormData({...formData, answer: e.target.value})}
                  className="w-full bg-theme-bg border border-theme-border p-3 text-theme-text focus:border-brand-accent focus:outline-none transition-colors min-h-[100px] resize-none theme-button"
                  placeholder="e.g. We are open Monday to Friday from 9 AM to 6 PM."
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-theme-text-muted mb-2">Keywords (Comma separated)</label>
                <input 
                  type="text" 
                  value={formData.keywords}
                  onChange={e => setFormData({...formData, keywords: e.target.value})}
                  className="w-full bg-theme-bg border border-theme-border p-3 text-theme-text focus:border-brand-accent focus:outline-none transition-colors theme-button"
                  placeholder="e.g. hours, timing, open"
                />
              </div>
              
              <div className="flex justify-end gap-4 mt-4 pt-4 border-t border-theme-border">
                <button 
                  type="button" 
                  onClick={handleCloseModal} 
                  className="px-6 py-2 border border-theme-border text-theme-text hover:bg-theme-surface-hover transition-colors theme-button"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saveMutation.isPending} 
                  className="px-6 py-2 bg-brand-accent hover:bg-brand-accent-light text-white font-bold disabled:opacity-50 transition-colors theme-button shadow-sm"
                >
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
