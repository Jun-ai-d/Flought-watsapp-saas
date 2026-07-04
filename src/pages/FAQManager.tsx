import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Edit2, X, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import './FAQManager.css';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  match_count: number;
}

const FAQManager: React.FC = () => {
  const { tenant } = useAuth();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ question: '', answer: '', keywords: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    fetchFaqs();
  }, [tenant]);

  const fetchFaqs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('faqs')
      .select('*')
      .eq('tenant_id', tenant?.id)
      .order('created_at', { ascending: false });
      
    if (!error && data) {
      setFaqs(data);
    }
    setLoading(false);
  };

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;
    
    setIsSubmitting(true);
    const keywordsArray = formData.keywords.split(',').map(k => k.trim()).filter(k => k !== '');

    if (editingId) {
      // Update
      const { error } = await supabase
        .from('faqs')
        .update({
          question: formData.question,
          answer: formData.answer,
          keywords: keywordsArray,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingId)
        .eq('tenant_id', tenant.id);
        
      if (!error) {
        setFaqs(faqs.map(f => f.id === editingId ? { ...f, question: formData.question, answer: formData.answer, keywords: keywordsArray } : f));
      }
    } else {
      // Insert
      const { data, error } = await supabase
        .from('faqs')
        .insert({
          tenant_id: tenant.id,
          question: formData.question,
          answer: formData.answer,
          keywords: keywordsArray
        })
        .select()
        .single();
        
      if (!error && data) {
        setFaqs([data, ...faqs]);
      }
    }
    
    setIsSubmitting(false);
    handleCloseModal();
  };

  const handleDelete = async (id: string) => {
    if (!tenant) return;
    if (window.confirm('Are you sure you want to delete this FAQ?')) {
      const { error } = await supabase
        .from('faqs')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenant.id);
        
      if (!error) {
        setFaqs(faqs.filter(f => f.id !== id));
      }
    }
  };

  return (
    <div className="page-container relative">
      <div className="page-header">
        <div>
          <h1 className="page-title">FAQ Manager</h1>
          <p className="text-gray">These answers are used by the AI to instantly resolve common queries.</p>
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => handleOpenModal()}>
          <Plus size={18} /> Add New FAQ
        </button>
      </div>

      <div className="content-panel margin-rule" style={{ marginLeft: '1rem' }}>
        <div className="panel-controls">
          <div className="search-box">
            <Search size={18} className="text-gray" />
            <input 
              type="text" 
              placeholder="Search existing FAQs..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="text-gray" style={{ fontSize: '0.9rem' }}>
            {loading ? 'Loading...' : `${filteredFaqs.length} ${filteredFaqs.length === 1 ? 'entry' : 'entries'}`}
          </div>
        </div>

        <div className="faq-list">
          {filteredFaqs.map(faq => (
            <div key={faq.id} className="faq-card flex justify-between items-start">
              <div className="faq-content">
                <h3 className="faq-question flex items-center gap-2">
                  {faq.question}
                  {faq.match_count > 0 && (
                    <span className="text-xs bg-[#C1440E]/20 text-[#C1440E] px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check size={12} /> {faq.match_count} matches
                    </span>
                  )}
                </h3>
                <p className="faq-answer text-gray">{faq.answer}</p>
                {faq.keywords && faq.keywords.length > 0 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {faq.keywords.map((kw, i) => (
                      <span key={i} className="text-xs bg-white/5 border border-white/10 px-2 py-1 text-gray-400 font-record">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="faq-actions flex flex-col gap-2">
                <button className="icon-btn text-gray hover:text-white" onClick={() => handleOpenModal(faq)} aria-label="Edit FAQ"><Edit2 size={18} /></button>
                <button className="icon-btn text-red hover:text-red-400" onClick={() => handleDelete(faq.id)} aria-label="Delete FAQ"><Trash2 size={18} /></button>
              </div>
            </div>
          ))}

          {!loading && filteredFaqs.length === 0 && (
            <div className="empty-state-simple">
              <p className="text-gray">No FAQs found matching your search.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 p-8 w-full max-w-2xl relative shadow-2xl">
            <button className="absolute top-4 right-4 text-gray hover:text-white" onClick={handleCloseModal}>
              <X size={24} />
            </button>
            <h2 className="text-2xl font-bold mb-6">{editingId ? 'Edit FAQ' : 'Add New FAQ'}</h2>
            
            <form onSubmit={handleSave} className="flex flex-col gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Question</label>
                <input 
                  type="text" 
                  required
                  value={formData.question}
                  onChange={e => setFormData({...formData, question: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 p-3 text-white focus:border-[#C1440E] outline-none"
                  placeholder="e.g. What are your hours of operation?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Answer (AI Response)</label>
                <textarea 
                  required
                  value={formData.answer}
                  onChange={e => setFormData({...formData, answer: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 p-3 text-white focus:border-[#C1440E] outline-none min-h-[100px]"
                  placeholder="e.g. We are open Monday to Friday from 9 AM to 6 PM."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Keywords (Comma separated)</label>
                <input 
                  type="text" 
                  value={formData.keywords}
                  onChange={e => setFormData({...formData, keywords: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 p-3 text-white focus:border-[#C1440E] outline-none"
                  placeholder="e.g. hours, timing, open"
                />
              </div>
              <div className="flex justify-end gap-4 mt-4">
                <button type="button" onClick={handleCloseModal} className="px-6 py-2 border border-white/10 hover:bg-white/5">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-[#C1440E] hover:bg-[#d65a24] text-white disabled:opacity-50">
                  {isSubmitting ? 'Saving...' : 'Save FAQ'}
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
