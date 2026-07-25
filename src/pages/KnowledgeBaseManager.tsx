import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, File, Trash2, CheckCircle, AlertTriangle, Eye, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useTrialStatus } from '../hooks/useTrialStatus';

interface KBDocument {
  id: string;
  source_name: string;
  status: 'processing' | 'ready' | 'failed';
  uploaded_at: string;
  file_path?: string;
  error_message?: string | null;
  chunk_count?: number | null;
}

const STUCK_PROCESSING_MS = 10 * 60 * 1000;

function truncate(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function isStuckProcessing(doc: KBDocument): boolean {
  if (doc.status !== 'processing') return false;
  return Date.now() - new Date(doc.uploaded_at).getTime() > STUCK_PROCESSING_MS;
}

const KnowledgeBaseManager: React.FC = () => {
  const queryClient = useQueryClient();
  const { tenant } = useAuth();
  const trial = useTrialStatus();
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);

  const enqueueIngest = async (documentId: string) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const res = await fetch(`${apiUrl}/api/tenant/kb/documents/${documentId}/ingest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': tenant!.id,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Failed to enqueue document for indexing');
    }
  };

  const { data: docs = [], isLoading: loading, error: loadError, refetch } = useQuery<KBDocument[]>({
    queryKey: ['kb-docs', tenant?.id],
    queryFn: async () => {
      if (trial?.enforceSetupCaps) {
        await supabase.rpc('reconcile_trial_kb_doc_count', { p_tenant_id: tenant.id } as never);
      }

      const { data, error } = await supabase
        .from('knowledge_documents')
        .select('id, source_name, status, uploaded_at, file_path, error_message, chunk_count')
        .eq('tenant_id', tenant!.id)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return (data || []) as KBDocument[];
    },
    enabled: !!tenant?.id,
    refetchInterval: (query) =>
      query.state.data?.some((d) => d.status === 'processing') ? 3000 : false,
  });

  const { data: kbHealth } = useQuery({
    queryKey: ['kb-health'],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/tenant/kb/health`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { ok: false, message: 'Could not reach backend health endpoint' };
      return res.json();
    },
    staleTime: 60_000,
  });

  const uploadMutation = useMutation<KBDocument, Error, File>({
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
          file_path: filePath,
        })
        .select()
        .single();
      if (error) throw error;

      await enqueueIngest(data.id);
      return data as KBDocument;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['kb-docs', tenant?.id], (old: KBDocument[] = []) => [data, ...old]);
    },
  });

  const retryMutation = useMutation<void, Error, string>({
    mutationFn: enqueueIngest,
    onMutate: async (docId) => {
      queryClient.setQueryData(['kb-docs', tenant?.id], (old: KBDocument[] = []) =>
        old.map((d) =>
          d.id === docId ? { ...d, status: 'processing' as const, error_message: null } : d
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kb-docs', tenant?.id] });
    },
    onError: (err) => {
      alert(err.message || 'Retry failed');
      queryClient.invalidateQueries({ queryKey: ['kb-docs', tenant?.id] });
    },
  });

  const processFile = async (file: File) => {
    if (!tenant) return;

    if (trial?.enforceSetupCaps) {
      if (docs.length >= 1) {
        alert('Trial plans are limited to 1 document.');
        return;
      }
      if (file.size > 50 * 1024) {
        alert(
          'File too large. Trial plan documents are limited to roughly 5,000 characters (~50KB). Please upgrade for larger documents.'
        );
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
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
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

  const deleteMutation = useMutation<void, Error, string>({
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
    },
  });

  const handleDelete = (id: string) => {
    if (!tenant) return;
    if (
      window.confirm(
        'Are you sure you want to delete this document? This will remove all associated AI context.'
      )
    ) {
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
          <p className="text-theme-text-muted">
            Upload documents for the AI to reference when a specific FAQ isn't found.
          </p>
        </div>
        {trial?.enforceSetupCaps && (
          <div className="text-right">
            <span className="inline-block px-3 py-1 bg-brand-accent/10 text-brand-accent font-bold rounded-full text-sm">
              Trial Limit: {docs.length}/1
            </span>
          </div>
        )}
      </div>

      {loadError && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 text-sm flex items-center justify-between gap-4">
          <span>Failed to load documents: {(loadError as Error).message}</span>
          <button onClick={() => refetch()} className="font-bold underline shrink-0">
            Retry
          </button>
        </div>
      )}

      {kbHealth && !kbHealth.ok && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-800 text-sm flex items-start gap-2">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{kbHealth.message} — new uploads may stay stuck in Processing until DATABASE_URL is set on the backend.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="theme-card p-6 bg-theme-surface">
            <h3 className="text-xl font-display font-bold text-theme-text mb-2">Add Document</h3>
            <p className="text-sm text-theme-text-muted mb-6">Supported formats: PDF, TXT (Max 10MB)</p>

            {trial?.enforceSetupCaps && docs.length >= 1 ? (
              <div
                className="border-2 border-dashed border-red-500/30 bg-red-500/5 p-8 text-center"
                style={{ borderRadius: 'var(--radius-card)' }}
              >
                <p className="font-bold text-red-600 mb-2">Upload Limit Reached</p>
                <p className="text-sm text-red-600/80 mb-4">Trial plans are limited to 1 document.</p>
                <a
                  href="/billing"
                  className="inline-block px-4 py-2 bg-red-600 text-white font-bold rounded theme-button hover:bg-red-700"
                >
                  Upgrade to add more
                </a>
              </div>
            ) : (
              <div
                className={cn(
                  'border-2 border-dashed p-8 text-center transition-colors relative flex flex-col items-center justify-center',
                  dragActive ? 'border-brand-accent bg-brand-accent/5' : 'border-theme-border hover:border-brand-accent bg-theme-bg',
                  uploading ? 'opacity-50 pointer-events-none' : ''
                )}
                style={{ borderRadius: 'var(--radius-card)' }}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload size={32} className={cn('mb-4', dragActive ? 'text-brand-accent' : 'text-theme-text-muted')} />
                <p className="font-bold text-theme-text mb-2">
                  {uploading ? 'Uploading...' : 'Drag & drop file here'}
                </p>
                {!uploading && (
                  <>
                    <p className="text-sm text-theme-text-muted mb-4">or</p>
                    <label className="px-6 py-2 bg-theme-text text-theme-bg font-bold cursor-pointer hover:bg-brand-accent transition-colors theme-button">
                      Browse Files
                      <input type="file" accept=".pdf,.txt,.md" className="hidden" onChange={handleFileSelect} />
                    </label>
                  </>
                )}
              </div>
            )}

            <div className="mt-6 flex items-start gap-2 p-4 bg-brand-accent/10 text-theme-text text-sm rounded-lg border border-brand-accent/20">
              <AlertTriangle size={16} className="text-brand-accent flex-shrink-0 mt-0.5" />
              <p className="font-medium text-theme-text-muted">
                Files are scanned for malicious content before vectorization.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="theme-card p-6 bg-theme-surface h-full">
            <h3 className="text-xl font-display font-bold text-theme-text mb-6">Active Documents</h3>

            {loading ? (
              <div className="text-theme-text-muted font-medium text-center py-8">Loading documents...</div>
            ) : docs.length === 0 ? (
              <div
                className="p-12 border-2 border-dashed border-theme-border bg-theme-bg text-center text-theme-text-muted font-medium space-y-2"
                style={{ borderRadius: 'var(--radius-card)' }}
              >
                <p>No documents uploaded yet.</p>
                <p className="text-sm">
                  Upload a PDF or TXT file on the left. The AI uses indexed chunks when FAQs do not match.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 bg-theme-bg border border-theme-border hover:border-brand-accent transition-colors theme-button group"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:bg-brand-accent/10 group-hover:text-brand-accent transition-colors flex-shrink-0">
                        <File size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-theme-text truncate">{doc.source_name}</div>
                        <div className="text-xs text-theme-text-muted mt-1 font-medium">
                          {formatDate(doc.uploaded_at)}
                          {doc.status === 'ready' && doc.chunk_count != null && (
                            <span className="ml-2 text-green-600/80">· {doc.chunk_count} chunks</span>
                          )}
                        </div>
                        {doc.status === 'failed' && doc.error_message && (
                          <p className="text-xs text-red-500/90 mt-1 font-medium" title={doc.error_message}>
                            {truncate(doc.error_message)}
                          </p>
                        )}
                        {isStuckProcessing(doc) && (
                          <p className="text-xs text-yellow-600/90 mt-1 font-medium">
                            Processing for over 10 minutes — try Retry or check backend logs.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
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

                      {(doc.status === 'failed' || isStuckProcessing(doc)) && (
                        <button
                          className="p-2 text-theme-text-muted hover:text-brand-accent hover:bg-brand-accent/10 transition-colors rounded-full disabled:opacity-50"
                          aria-label="Retry indexing"
                          disabled={retryMutation.isPending}
                          onClick={() => retryMutation.mutate(doc.id)}
                        >
                          <RefreshCw size={18} className={retryMutation.isPending ? 'animate-spin' : ''} />
                        </button>
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
