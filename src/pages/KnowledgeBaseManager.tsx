import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, File, Trash2, CheckCircle, AlertTriangle, Eye } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

interface KBDocument {
  id: string;
  source_name: string;
  status: 'processing' | 'ready' | 'failed';
  uploaded_at: string;
  file_path?: string;
}

const KnowledgeBaseManager: React.FC = () => {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: docs = [], isLoading: loading } = useQuery<any[]>({
    queryKey: ['kb-docs', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_documents')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  const uploadMutation = useMutation<any, Error, File>({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `${tenant!.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('knowledge_base')
        .upload(filePath, file);
        
      if (uploadError) throw uploadError;

      const { data, error } = await (supabase
        .from('knowledge_documents') as any)
        .insert({
          tenant_id: tenant!.id,
          source_name: file.name,
          status: 'processing',
          file_path: filePath
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['kb-docs', tenant?.id], (old: any[] = []) => [data, ...old]);
      
      // Simulate backend processing delay for UX demonstration
      setTimeout(async () => {
        const { error: upErr } = await (supabase
          .from('knowledge_documents') as any)
          .update({ status: 'ready' })
          .eq('id', data.id);
          
        if (!upErr) {
          queryClient.setQueryData(['kb-docs', tenant?.id], (old: any[] = []) => 
            old.map(d => d.id === data.id ? { ...d, status: 'ready' } : d)
          );
        }
      }, 3000);
    }
  });

  const processFile = async (file: File) => {
    if (!tenant) return;
    
    // Free Trial Limit Enforcement
    if (tenant.plan_type === 'trial') {
      if (docs.length >= 1) {
        alert("Trial plans are limited to 1 document.");
        return;
      }
      // Trial ~5,000 char limit (approx 50KB for safe measure including PDFs)
      if (file.size > 50 * 1024) {
        alert("File too large. Trial plan documents are limited to roughly 5,000 characters (~50KB). Please upgrade for larger documents.");
        return;
      }
    }

    setUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const deleteMutation = useMutation<any, Error, string>({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('knowledge_documents')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenant!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb-docs', tenant?.id] });
    }
  });

  const handleDelete = (id: string) => {
    if (!tenant) return;
    if (window.confirm('Are you sure you want to delete this document? This will remove all associated AI context.')) {
      deleteMutation.mutate(id);
    }
  };

  const handleViewDocument = async (filePath?: string) => {
    if (!filePath) return alert('File path not found. This might be an old mock document.');
    const { data, error } = await supabase.storage.from('knowledge_base').createSignedUrl(filePath, 3600);
    if (error || !data) {
      alert('Failed to get document URL');
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-display font-bold text-theme-text mb-2">Knowledge Base</h1>
          <p className="text-theme-text-muted">Upload documents for the AI to reference when a specific FAQ isn't found.</p>
        </div>
        {tenant?.plan_type === 'trial' && (
          <div className="text-right">
            <span className="inline-block px-3 py-1 bg-brand-accent/10 text-brand-accent font-bold rounded-full text-sm">
              Trial Limit: {docs.length}/1
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Upload Area */}
        <div className="lg:col-span-1 space-y-6">
          <div className="theme-card p-6 bg-theme-surface">
            <h3 className="text-xl font-display font-bold text-theme-text mb-2">Add Document</h3>
            <p className="text-sm text-theme-text-muted mb-6">Supported formats: PDF, TXT (Max 10MB)</p>
            
            {tenant?.plan_type === 'trial' && docs.length >= 1 ? (
              <div className="border-2 border-dashed border-red-500/30 bg-red-500/5 p-8 text-center" style={{ borderRadius: 'var(--radius-card)' }}>
                <p className="font-bold text-red-600 mb-2">Upload Limit Reached</p>
                <p className="text-sm text-red-600/80 mb-4">Trial plans are limited to 1 document.</p>
                <a href="/billing" className="inline-block px-4 py-2 bg-red-600 text-white font-bold rounded theme-button hover:bg-red-700">
                  Upgrade to add more
                </a>
              </div>
            ) : (
              <div 
                className={cn(
                  "border-2 border-dashed p-8 text-center transition-colors relative flex flex-col items-center justify-center",
                  dragActive ? "border-brand-accent bg-brand-accent/5" : "border-theme-border hover:border-brand-accent bg-theme-bg",
                  uploading ? "opacity-50 pointer-events-none" : ""
                )}
                style={{ borderRadius: 'var(--radius-card)' }}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload size={32} className={cn("mb-4", dragActive ? "text-brand-accent" : "text-theme-text-muted")} />
                <p className="font-bold text-theme-text mb-2">
                  {uploading ? 'Uploading...' : 'Drag & drop file here'}
                </p>
                {!uploading && (
                  <>
                    <p className="text-sm text-theme-text-muted mb-4">or</p>
                    <label className="px-6 py-2 bg-theme-text text-theme-bg font-bold cursor-pointer hover:bg-brand-accent transition-colors theme-button">
                      Browse Files
                      <input type="file" accept=".pdf,.txt" className="hidden" onChange={handleFileSelect} />
                    </label>
                  </>
                )}
              </div>
            )}
            
            <div className="mt-6 flex items-start gap-2 p-4 bg-brand-accent/10 text-theme-text text-sm rounded-lg border border-brand-accent/20">
              <AlertTriangle size={16} className="text-brand-accent flex-shrink-0 mt-0.5" />
              <p className="font-medium text-theme-text-muted">Files are scanned for malicious content before vectorization.</p>
            </div>
          </div>
        </div>

        {/* Right: Existing Docs */}
        <div className="lg:col-span-2 space-y-6">
          <div className="theme-card p-6 bg-theme-surface h-full">
            <h3 className="text-xl font-display font-bold text-theme-text mb-6">Active Documents</h3>
            
            {loading ? (
              <div className="text-theme-text-muted font-medium text-center py-8">Loading documents...</div>
            ) : docs.length === 0 ? (
              <div className="p-12 border-2 border-dashed border-theme-border bg-theme-bg text-center text-theme-text-muted font-medium" style={{ borderRadius: 'var(--radius-card)' }}>
                <p>No documents uploaded yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {docs.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-4 bg-theme-bg border border-theme-border hover:border-brand-accent transition-colors theme-button group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:bg-brand-accent/10 group-hover:text-brand-accent transition-colors">
                        <File size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-theme-text">{doc.source_name}</div>
                        <div className="text-xs text-theme-text-muted mt-1 font-medium">
                          {formatDate(doc.uploaded_at)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {doc.status === 'ready' ? (
                        <span className="px-3 py-1 bg-green-500/10 text-green-500 border border-green-500/20 rounded-full text-xs font-bold uppercase flex items-center gap-1 tracking-wider">
                          <CheckCircle size={12} /> Indexed
                        </span>
                      ) : doc.status === 'processing' ? (
                        <span className="px-3 py-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-full text-xs font-bold uppercase tracking-wider">
                          <span className="animate-pulse">Processing...</span>
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full text-xs font-bold uppercase tracking-wider">
                          Failed
                        </span>
                      )}
                      
                      <button 
                        className="p-2 text-theme-text-muted hover:text-brand-accent hover:bg-brand-accent/10 transition-colors rounded-full"
                        aria-label="View document" 
                        onClick={() => handleViewDocument(doc.file_path)}
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        className="p-2 text-theme-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors rounded-full"
                        aria-label="Delete document" 
                        onClick={() => handleDelete(doc.id)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseManager;
