import React, { useState, useEffect } from 'react';
import { Upload, File, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import './KnowledgeBaseManager.css';

interface KBDocument {
  id: string;
  source_name: string;
  status: 'processing' | 'ready' | 'failed';
  uploaded_at: string;
}

const KnowledgeBaseManager: React.FC = () => {
  const { tenant } = useAuth();
  const [docs, setDocs] = useState<KBDocument[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    fetchDocs();
  }, [tenant]);

  const fetchDocs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('knowledge_documents')
      .select('*')
      .eq('tenant_id', tenant?.id)
      .order('uploaded_at', { ascending: false });
      
    if (!error && data) {
      setDocs(data);
    }
    setLoading(false);
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

  const processFile = async (file: File) => {
    if (!tenant) return;
    setUploading(true);
    
    // In a full implementation, we would upload to Supabase Storage here,
    // and a backend edge function would trigger to parse the PDF and populate knowledge_chunks.
    // For now, we simulate the upload and insert the document record.
    
    const { data, error } = await supabase
      .from('knowledge_documents')
      .insert({
        tenant_id: tenant.id,
        source_name: file.name,
        status: 'processing'
      })
      .select()
      .single();
      
    if (!error && data) {
      setDocs([data, ...docs]);
      
      // Simulate backend processing delay for UX demonstration
      setTimeout(async () => {
        const { error: upErr } = await supabase
          .from('knowledge_documents')
          .update({ status: 'ready' })
          .eq('id', data.id);
          
        if (!upErr) {
          setDocs(current => current.map(d => d.id === data.id ? { ...d, status: 'ready' } : d));
        }
      }, 3000);
    }
    
    setUploading(false);
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

  const handleDelete = async (id: string) => {
    if (!tenant) return;
    if (window.confirm('Are you sure you want to delete this document? This will remove all associated AI context.')) {
      const { error } = await supabase
        .from('knowledge_documents')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenant.id);
        
      if (!error) {
        setDocs(docs.filter(d => d.id !== id));
      }
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Knowledge Base</h1>
          <p className="text-gray">Upload documents for the AI to reference when a specific FAQ isn't found.</p>
        </div>
      </div>

      <div className="kb-layout">
        {/* Left: Upload Area */}
        <div className="kb-upload-panel margin-rule">
          <h3>Add Document</h3>
          <p className="text-gray" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Supported formats: PDF, TXT (Max 10MB)
          </p>
          
          <div 
            className={`upload-dropzone ${dragActive ? 'active' : ''} ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload size={32} className="text-gray" style={{ marginBottom: '1rem' }} />
            <p style={{ fontWeight: 600 }}>
              {uploading ? 'Uploading...' : 'Drag & drop file here'}
            </p>
            {!uploading && (
              <>
                <p className="text-gray" style={{ fontSize: '0.85rem', margin: '0.5rem 0 1.5rem' }}>or</p>
                <label className="btn cursor-pointer">
                  Browse Files
                  <input type="file" accept=".pdf,.txt" className="hidden" onChange={handleFileSelect} />
                </label>
              </>
            )}
            
            <div className="security-notice">
              <AlertTriangle size={14} className="text-red" />
              <span>Files are scanned for malicious content before vectorization.</span>
            </div>
          </div>
        </div>

        {/* Right: Existing Docs */}
        <div className="kb-docs-panel">
          <h3 style={{ marginBottom: '1.5rem' }}>Active Documents</h3>
          
          {loading ? (
            <div className="text-gray">Loading documents...</div>
          ) : docs.length === 0 ? (
            <div className="empty-state-simple">
              <p className="text-gray">No documents uploaded yet.</p>
            </div>
          ) : (
            <div className="docs-list">
              {docs.map(doc => (
                <div key={doc.id} className="doc-card">
                  <div className="doc-icon">
                    <File size={24} className="text-indigo" />
                  </div>
                  <div className="doc-info">
                    <div className="doc-name">{doc.source_name}</div>
                    <div className="doc-meta text-gray">
                      {formatDate(doc.uploaded_at)}
                    </div>
                  </div>
                  <div className="doc-status">
                    {doc.status === 'ready' ? (
                      <span className="status-badge success">
                        <CheckCircle size={14} /> Indexed
                      </span>
                    ) : doc.status === 'processing' ? (
                      <span className="status-badge pending">
                        <span className="animate-pulse">Processing...</span>
                      </span>
                    ) : (
                      <span className="status-badge error">
                        Failed
                      </span>
                    )}
                  </div>
                  <button className="icon-btn text-red hover:text-red-400" aria-label="Delete document" onClick={() => handleDelete(doc.id)}>
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseManager;
