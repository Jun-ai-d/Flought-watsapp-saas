import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Search, Edit2, Check, X, Tag, Plus, Download, Upload, Trash2, AlertTriangle, Info, CheckCircle, Trash } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import Papa from 'papaparse';
import { extractPhoneFromRow, extractNameFromRow, isValidWhatsAppFormat } from '../lib/csv-utils';

export default function Contacts() {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{name: string, phone: string, tags: string, notes: string}>({name: '', phone: '', tags: '', notes: ''});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('last_contacted_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async (vars: { id: string, name: string, phone: string, tags: string[], notes: string }) => {
      const { error } = await (supabase.from('contacts') as any)
        .update({ name: vars.name, phone_number: vars.phone, tags: vars.tags, notes: vars.notes })
        .eq('id', vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', tenant?.id] });
      setEditingId(null);
    }
  });

  const insertMutation = useMutation({
    mutationFn: async (vars: { name: string, tags: string[], notes: string, phone: string }) => {
      const { error } = await supabase.from('contacts').insert({
        tenant_id: tenant!.id,
        name: vars.name,
        phone_number: vars.phone,
        tags: vars.tags,
        notes: vars.notes,
        last_contacted_at: new Date().toISOString()
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', tenant?.id] });
      setEditingId(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('contacts').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', tenant?.id] });
      setSelectedIds([]);
    }
  });

  const importMutation = useMutation({
    mutationFn: async (contactsData: any[]) => {
      const rows = contactsData.map(c => ({
        tenant_id: tenant!.id,
        name: extractNameFromRow(c),
        phone_number: extractPhoneFromRow(c),
        tags: [],
        notes: '',
        last_contacted_at: new Date().toISOString()
      })).filter(c => c.phone_number);

      if (rows.length === 0) throw new Error('No valid contacts with phone numbers found in CSV');

      const { error } = await supabase.from('contacts').insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', tenant?.id] });
      alert('Contacts imported successfully!');
    },
    onError: (err: any) => {
      alert('Failed to import contacts: ' + err.message);
    }
  });

  const handlePhoneChange = (val: string) => {
    let cleaned = val.replace(/[^\d+]/g, '');
    if (cleaned.length > 0 && /^[1-9]/.test(cleaned)) {
      cleaned = '+' + cleaned;
    }
    if (cleaned.length > 1) {
      cleaned = '+' + cleaned.replace(/\+/g, '');
    }
    setEditForm({ ...editForm, phone: cleaned });
  };

  const handleEdit = (contact: any) => {
    setEditingId(contact.id);
    setEditForm({
      name: contact.name || '',
      phone: contact.phone_number || '',
      tags: (contact.tags || []).join(', '),
      notes: contact.notes || ''
    });
  };

  const handleSave = () => {
    if (!editingId) return;
    const tagsArray = editForm.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    
    if (editingId === 'new') {
      if (!editForm.phone) {
        alert("Phone number is required to add a new contact.");
        return;
      }
      insertMutation.mutate({
        name: editForm.name,
        tags: tagsArray,
        notes: editForm.notes,
        phone: editForm.phone
      });
    } else {
      updateMutation.mutate({
        id: editingId,
        name: editForm.name,
        phone: editForm.phone,
        tags: tagsArray,
        notes: editForm.notes
      });
    }
  };

  const handleAddNew = () => {
    setEditingId('new');
    setEditForm({ name: '', phone: '', tags: '', notes: '' });
  };

  const handleExportCSV = () => {
    if (contacts.length === 0) return alert('No contacts to export.');
    const csv = Papa.unparse(contacts.map((c: any) => ({
      Name: c.name,
      Phone: c.phone_number,
      Tags: (c.tags || []).join(', '),
      Notes: c.notes,
      'Last Contacted': c.last_contacted_at
    })));
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts.csv';
    a.click();
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (window.confirm(`Found ${results.data.length} rows. Import these contacts?`)) {
          importMutation.mutate(results.data);
        }
        e.target.value = ''; // Reset input
      },
      error: (err: any) => {
        alert('Failed to parse CSV file.');
        console.error(err);
      }
    });
  };

  const filtered = contacts.filter((c: any) => 
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.phone_number || '').includes(searchTerm) ||
    (c.tags || []).some((t: string) => t.includes(searchTerm.toLowerCase()))
  );

  const toggleAll = () => {
    if (selectedIds.length === filtered.length && filtered.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((c: any) => c.id));
    }
  };

  const toggleRow = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleDeleteSelected = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} contact(s)?`)) {
      deleteMutation.mutate(selectedIds);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-xl md:text-3xl font-display font-bold text-theme-text mb-2 flex items-center gap-2">
            <Users className="text-brand-accent" size={24} /> Contacts
          </h1>
          <p className="text-theme-text-muted">Manage your customers, add tags, and track relationships.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted" />
            <input 
              type="text" 
              placeholder="Search name, phone, or tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-theme-border bg-theme-surface text-theme-text focus:border-brand-accent focus:outline-none transition-colors theme-button"
            />
          </div>
          <button 
            onClick={handleAddNew}
            className="px-4 py-2 bg-brand-accent text-white font-bold hover:bg-brand-accent-light transition-colors flex items-center gap-2 theme-button shadow-sm"
          >
            <Plus size={16} /> New
          </button>
          <div className="relative">
            <input 
              type="file" 
              accept=".csv"
              onChange={handleImportCSV}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <button className="px-4 py-2 border border-theme-border text-theme-text font-bold hover:bg-theme-surface-hover transition-colors flex items-center gap-2 theme-button">
              <Upload size={16} /> Import
            </button>
          </div>
          <button 
            onClick={handleExportCSV}
            className="px-4 py-2 border border-theme-border text-theme-text font-bold hover:bg-theme-surface-hover transition-colors flex items-center gap-2 theme-button"
          >
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="bg-brand-accent/10 border border-brand-accent p-3 md:p-4 rounded-xl flex justify-between items-center animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-brand-accent font-bold">
            <CheckCircle size={20} />
            {selectedIds.length} contact{selectedIds.length !== 1 ? 's' : ''} selected
          </div>
          <button 
            onClick={handleDeleteSelected}
            disabled={deleteMutation.isPending}
            className="px-4 py-2 bg-red-500 text-white font-bold tracking-wide hover:bg-red-600 transition-colors flex items-center gap-2 theme-button shadow-sm"
          >
            <Trash2 size={16} /> Delete Selected
          </button>
        </div>
      )}

      <div className="theme-card overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-theme-surface border-b border-theme-border text-theme-text-muted text-xs uppercase tracking-wider font-bold">
                <th className="p-4 w-12 text-center">
                  <input type="checkbox" className="w-4 h-4 rounded border-theme-border text-brand-accent focus:ring-brand-accent theme-button cursor-pointer" checked={selectedIds.length === filtered.length && filtered.length > 0} onChange={toggleAll} />
                </th>
                <th className="p-4">Customer</th>
                <th className="p-4">Phone Number</th>
                <th className="p-4">Tags</th>
                <th className="p-4">Notes</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-theme-text-muted font-medium">Loading contacts...</td>
                </tr>
              ) : filtered.length === 0 && editingId !== 'new' ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-theme-text-muted font-medium">No contacts found.</td>
                </tr>
              ) : (
                <>
                  {editingId === 'new' && (
                    <tr className="hover:bg-theme-surface-hover transition-colors">
                      <td className="p-4"></td>
                      <td className="p-4">
                        <input 
                          type="text" 
                          value={editForm.name} 
                          onChange={e => setEditForm({...editForm, name: e.target.value})}
                          className="w-full p-2 border border-brand-accent bg-theme-bg text-theme-text focus:outline-none theme-button"
                          placeholder="Name"
                        />
                      </td>
                      <td className="p-4 relative">
                        <input 
                          type="text" 
                          value={editForm.phone} 
                          onChange={e => handlePhoneChange(e.target.value)}
                          className={cn(
                            "w-full p-2 border bg-theme-bg text-theme-text focus:outline-none theme-button font-mono text-sm",
                            editForm.phone && !isValidWhatsAppFormat(editForm.phone) ? "border-red-500 focus:border-red-500" : "border-brand-accent focus:border-brand-accent"
                          )}
                          placeholder="+1234567890"
                        />
                      </td>
                      <td className="p-4">
                        <input 
                          type="text" 
                          value={editForm.tags} 
                          onChange={e => setEditForm({...editForm, tags: e.target.value})}
                          className="w-full p-2 border border-brand-accent bg-theme-bg text-theme-text focus:outline-none theme-button"
                          placeholder="vip, lead"
                        />
                      </td>
                      <td className="p-4">
                        <input 
                          type="text" 
                          value={editForm.notes} 
                          onChange={e => setEditForm({...editForm, notes: e.target.value})}
                          className="w-full p-2 border border-brand-accent bg-theme-bg text-theme-text focus:outline-none theme-button"
                          placeholder="Notes"
                        />
                      </td>
                      <td className="p-4 text-right flex justify-end gap-2">
                        <button 
                          onClick={handleSave} 
                          className="p-2 bg-green-500 text-white theme-button shadow-sm hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed" 
                          disabled={insertMutation.isPending || (!!editForm.phone && !isValidWhatsAppFormat(editForm.phone))}
                        >
                          <Check size={16} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-2 bg-theme-surface text-theme-text-muted border border-theme-border theme-button hover:text-theme-text"><X size={16} /></button>
                      </td>
                    </tr>
                  )}
                  {filtered.map((c: any) => (
                    <tr key={c.id} className="hover:bg-theme-surface-hover transition-colors">
                      {editingId === c.id ? (
                        <>
                          <td className="p-4"></td>
                          <td className="p-4">
                            <input 
                              type="text" 
                              value={editForm.name} 
                              onChange={e => setEditForm({...editForm, name: e.target.value})}
                              className="w-full p-2 border border-brand-accent bg-theme-bg text-theme-text focus:outline-none theme-button"
                              placeholder="Name"
                            />
                          </td>
                          <td className="p-4 relative">
                            <input 
                              type="text" 
                              value={editForm.phone} 
                              onChange={e => handlePhoneChange(e.target.value)}
                              className={cn(
                                "w-full p-2 border bg-theme-bg text-theme-text focus:outline-none theme-button font-mono text-sm",
                                editForm.phone && !isValidWhatsAppFormat(editForm.phone) ? "border-red-500 focus:border-red-500" : "border-brand-accent focus:border-brand-accent"
                              )}
                              placeholder="+1234567890"
                            />
                          </td>
                          <td className="p-4">
                            <input 
                              type="text" 
                              value={editForm.tags} 
                              onChange={e => setEditForm({...editForm, tags: e.target.value})}
                              className="w-full p-2 border border-brand-accent bg-theme-bg text-theme-text focus:outline-none theme-button"
                              placeholder="vip, lead"
                            />
                          </td>
                          <td className="p-4">
                            <input 
                              type="text" 
                              value={editForm.notes} 
                              onChange={e => setEditForm({...editForm, notes: e.target.value})}
                              className="w-full p-2 border border-brand-accent bg-theme-bg text-theme-text focus:outline-none theme-button"
                              placeholder="Notes"
                            />
                          </td>
                          <td className="p-4 text-right flex justify-end gap-2">
                            <button 
                              onClick={handleSave} 
                              className="p-2 bg-green-500 text-white theme-button shadow-sm hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={updateMutation.isPending || (!!editForm.phone && !isValidWhatsAppFormat(editForm.phone))}
                            >
                              <Check size={16} />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-2 bg-theme-surface text-theme-text-muted border border-theme-border theme-button hover:text-theme-text"><X size={16} /></button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-4 w-12 text-center">
                            <input type="checkbox" className="w-4 h-4 rounded border-theme-border text-brand-accent focus:ring-brand-accent theme-button cursor-pointer" checked={selectedIds.includes(c.id)} onChange={() => toggleRow(c.id)} />
                          </td>
                          <td className="p-4 font-bold text-theme-text">{c.name || 'Unknown'}</td>
                          <td className="p-4 font-mono text-sm text-theme-text-muted">
                            <div className="flex items-center gap-2">
                              {c.phone_number}
                              {!isValidWhatsAppFormat(c.phone_number) && (
                                <div className="group relative flex items-center justify-center">
                                  <AlertTriangle size={14} className="text-yellow-500 cursor-help" />
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-theme-text text-theme-bg text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center font-sans font-medium">
                                    Invalid WhatsApp format. Must be international e.g., +1234567890
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1">
                              {(c.tags || []).map((t: string) => (
                                <span key={t} className="px-2 py-0.5 bg-brand-accent/10 border border-brand-accent/20 text-brand-accent text-xs font-bold uppercase tracking-wider flex items-center gap-1 theme-button">
                                  <Tag size={10} /> {t}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-4 text-sm text-theme-text-muted max-w-xs truncate">{c.notes || '-'}</td>
                          <td className="p-4 text-right flex justify-end gap-1">
                            <button onClick={() => handleEdit(c)} className="p-2 text-theme-text-muted hover:text-brand-accent transition-colors">
                              <Edit2 size={16} />
                            </button>
                            <button onClick={() => { if(window.confirm('Delete this contact?')) deleteMutation.mutate([c.id]) }} className="p-2 text-theme-text-muted hover:text-red-500 transition-colors">
                              <Trash size={16} />
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile List View */}
        <div className="md:hidden divide-y divide-theme-border">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-theme-text-muted font-medium">Loading contacts...</div>
          ) : filtered.length === 0 && editingId !== 'new' ? (
            <div className="p-4 text-center text-sm text-theme-text-muted font-medium">No contacts found.</div>
          ) : (
            <ul className="flex flex-col">
              {editingId === 'new' && (
                <li className="p-4 bg-theme-surface-hover">
                  <div className="space-y-2">
                    <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full p-1.5 px-2 text-sm md:p-2 border border-brand-accent bg-theme-bg text-theme-text focus:outline-none theme-button" placeholder="Name" />
                    <input type="text" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full p-1.5 px-2 text-sm md:p-2 border border-brand-accent bg-theme-bg text-theme-text focus:outline-none theme-button font-mono" placeholder="+1234567890" />
                    <input type="text" value={editForm.tags} onChange={e => setEditForm({...editForm, tags: e.target.value})} className="w-full p-1.5 px-2 text-sm md:p-2 border border-brand-accent bg-theme-bg text-theme-text focus:outline-none theme-button" placeholder="Tags (e.g. vip, lead)" />
                    <input type="text" value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} className="w-full p-1.5 px-2 text-sm md:p-2 border border-brand-accent bg-theme-bg text-theme-text focus:outline-none theme-button" placeholder="Notes" />
                    <div className="flex gap-2 justify-end pt-2">
                      <button onClick={handleSave} className="p-1.5 px-3 text-sm bg-green-500 text-white theme-button shadow-sm hover:bg-green-600 flex items-center gap-1" disabled={insertMutation.isPending}><Check size={14} /> Save</button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 px-3 text-sm bg-theme-surface text-theme-text-muted border border-theme-border theme-button hover:text-theme-text flex items-center gap-1"><X size={14} /> Cancel</button>
                    </div>
                  </div>
                </li>
              )}
              {filtered.map((c: any) => (
                <li key={c.id} className="p-4 hover:bg-theme-surface-hover transition-colors">
                  {editingId === c.id ? (
                    <div className="space-y-2">
                      <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full p-1.5 px-2 text-sm md:p-2 border border-brand-accent bg-theme-bg text-theme-text focus:outline-none theme-button" placeholder="Name" />
                      <input type="text" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full p-1.5 px-2 text-sm md:p-2 border border-brand-accent bg-theme-bg text-theme-text focus:outline-none theme-button font-mono" placeholder="+1234567890" />
                      <input type="text" value={editForm.tags} onChange={e => setEditForm({...editForm, tags: e.target.value})} className="w-full p-1.5 px-2 text-sm md:p-2 border border-brand-accent bg-theme-bg text-theme-text focus:outline-none theme-button" placeholder="Tags (e.g. vip, lead)" />
                      <input type="text" value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} className="w-full p-1.5 px-2 text-sm md:p-2 border border-brand-accent bg-theme-bg text-theme-text focus:outline-none theme-button" placeholder="Notes" />
                      <div className="flex gap-2 justify-end pt-2">
                        <button onClick={handleSave} className="p-1.5 px-3 text-sm bg-green-500 text-white theme-button shadow-sm hover:bg-green-600 flex items-center gap-1"><Check size={14} /> Save</button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 px-3 text-sm bg-theme-surface text-theme-text-muted border border-theme-border theme-button hover:text-theme-text flex items-center gap-1"><X size={14} /> Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start gap-3">
                      <div className="mt-1">
                        <input type="checkbox" className="w-4 h-4 rounded border-theme-border text-brand-accent focus:ring-brand-accent theme-button cursor-pointer" checked={selectedIds.includes(c.id)} onChange={() => toggleRow(c.id)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-theme-text text-base truncate">{c.name || 'Unknown Customer'}</div>
                        <div className="font-mono text-xs text-theme-text-muted mt-0.5 mb-2 flex items-center gap-1">
                          {c.phone_number}
                          {!isValidWhatsAppFormat(c.phone_number) && (
                            <AlertTriangle size={12} className="text-yellow-500" />
                          )}
                        </div>
                        
                        {(c.tags && c.tags.length > 0) && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {c.tags.map((t: string) => (
                              <span key={t} className="px-2 py-0.5 bg-brand-accent/10 border border-brand-accent/20 text-brand-accent text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 theme-button">
                                <Tag size={8} /> {t}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {c.notes && (
                          <p className="text-xs text-theme-text-muted line-clamp-2 mt-1">{c.notes}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <button onClick={() => handleEdit(c)} className="p-2 bg-theme-surface border border-theme-border text-theme-text-muted hover:text-brand-accent transition-colors rounded-xl flex-shrink-0">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => { if(window.confirm('Delete this contact?')) deleteMutation.mutate([c.id]) }} className="p-2 bg-theme-surface border border-theme-border text-theme-text-muted hover:text-red-500 transition-colors rounded-xl flex-shrink-0">
                          <Trash size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
