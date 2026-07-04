import React, { useState, useEffect } from 'react';
import { Plus, CheckCircle, Clock, XCircle, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './TemplateManager.css';

const TemplateManager: React.FC = () => {
  const { tenant, session } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('utility');
  const [body, setBody] = useState('');

  const fetchTemplates = async () => {
    if (!tenant || !session) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/templates/${tenant.id}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [tenant, session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !session) return;
    setCreating(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/templates/${tenant.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ name, category, body })
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to create template');
      }

      await fetchTemplates();
      setShowModal(false);
      setName('');
      setBody('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Message Templates</h1>
          <p className="text-gray">Manage pre-approved WhatsApp templates for outbound messaging.</p>
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setShowModal(true)}>
          <Plus size={18} /> New Template
        </button>
      </div>

      <div className="content-panel margin-rule" style={{ marginLeft: '1rem' }}>
        {loading ? (
          <div className="p-4 text-gray">Loading templates...</div>
        ) : (
          <table className="templates-table">
            <thead>
              <tr>
                <th>Template Name</th>
                <th>Category</th>
                <th>Status</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {templates.length === 0 && (
                <tr><td colSpan={4} className="text-center text-gray py-4">No templates created yet.</td></tr>
              )}
              {templates.map(template => (
                <tr key={template.id}>
                  <td>
                    <strong>{template.name}</strong>
                  </td>
                  <td style={{ textTransform: 'capitalize' }}>{template.category}</td>
                  <td>
                    <span className={`status-badge ${template.status}`}>
                      {template.status === 'approved' && <CheckCircle size={14} />}
                      {template.status === 'pending' && <Clock size={14} />}
                      {template.status === 'rejected' && <XCircle size={14} />}
                      {template.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="text-gray">{new Date(template.updated_at || template.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white border-2 border-[#1A1A1A] p-6 w-[500px] shadow-[8px_8px_0px_0px_rgba(26,26,26,1)]">
            <div className="flex justify-between items-center mb-6 border-b-2 border-[#E5E5E5] pb-4">
              <h2 className="text-xl font-display font-bold text-[#1A1A1A]">Create Template</h2>
              <button onClick={() => setShowModal(false)} className="text-[#666666] hover:text-[#1A1A1A]">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#1A1A1A] mb-1">Template Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  placeholder="e.g. order_update_v1"
                  required 
                  className="w-full p-2 border-2 border-[#E5E5E5] focus:border-[#1A1A1A] focus:outline-none transition-colors font-mono text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-[#1A1A1A] mb-1">Category</label>
                <select 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2 border-2 border-[#E5E5E5] focus:border-[#1A1A1A] focus:outline-none transition-colors"
                >
                  <option value="utility">Utility</option>
                  <option value="marketing">Marketing</option>
                  <option value="authentication">Authentication</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-[#1A1A1A] mb-1">Message Body</label>
                <textarea 
                  value={body} 
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Hello {{1}}, your order is confirmed."
                  required 
                  rows={4}
                  className="w-full p-2 border-2 border-[#E5E5E5] focus:border-[#1A1A1A] focus:outline-none transition-colors resize-none"
                ></textarea>
                <p className="text-xs text-[#666666] mt-1">Use {'{{1}}'}, {'{{2}}'} for variables.</p>
              </div>

              <button 
                type="submit" 
                disabled={creating}
                className="w-full bg-[#1A1A1A] text-white font-bold py-3 hover:bg-[#C1440E] transition-colors border-2 border-transparent disabled:opacity-50 mt-4"
              >
                {creating ? 'Submitting...' : 'Submit to BSP'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateManager;
