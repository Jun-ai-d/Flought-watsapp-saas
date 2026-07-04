import React, { useState } from 'react';
import { Upload, File, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import './KnowledgeBaseManager.css';

// Mock Data
const MOCK_DOCS = [
  { id: 1, name: 'clinic_services_menu_2026.pdf', size: '2.4 MB', status: 'processed', chunks: 142, date: '2026-07-01' },
  { id: 2, name: 'refund_policy_v2.pdf', size: '0.8 MB', status: 'processed', chunks: 45, date: '2026-07-02' },
  { id: 3, name: 'post_op_care_instructions.pdf', size: '5.1 MB', status: 'processing', chunks: 0, date: 'Today' },
];

const KnowledgeBaseManager: React.FC = () => {
  const [docs, setDocs] = useState(MOCK_DOCS);
  const [dragActive, setDragActive] = useState(false);

  // VibeSec: In a real app, strict server-side validation is required for:
  // 1. File Type (Magic Bytes, not just extension)
  // 2. File Size
  // 3. File Content (Parsing PDFs securely without vulnerable libraries)
  
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
    // Real implementation would validate file type/size before setting state
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
            className={`upload-dropzone ${dragActive ? 'active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload size={32} className="text-gray" style={{ marginBottom: '1rem' }} />
            <p style={{ fontWeight: 600 }}>Drag & drop file here</p>
            <p className="text-gray" style={{ fontSize: '0.85rem', margin: '0.5rem 0 1.5rem' }}>or</p>
            <button className="btn">Browse Files</button>
            
            {/* VibeSec constraint explicit in UI */}
            <div className="security-notice">
              <AlertTriangle size={14} className="text-red" />
              <span>Files are scanned for malicious content.</span>
            </div>
          </div>
        </div>

        {/* Right: Existing Docs */}
        <div className="kb-docs-panel">
          <h3 style={{ marginBottom: '1.5rem' }}>Active Documents</h3>
          
          <div className="docs-list">
            {docs.map(doc => (
              <div key={doc.id} className="doc-card">
                <div className="doc-icon">
                  <File size={24} className="text-indigo" />
                </div>
                <div className="doc-info">
                  <div className="doc-name">{doc.name}</div>
                  <div className="doc-meta text-gray">
                    <span className="font-record">{doc.size}</span> &bull; {doc.date}
                  </div>
                </div>
                <div className="doc-status">
                  {doc.status === 'processed' ? (
                    <span className="status-badge success">
                      <CheckCircle size={14} /> Indexed ({doc.chunks} chunks)
                    </span>
                  ) : (
                    <span className="status-badge pending">
                      Processing...
                    </span>
                  )}
                </div>
                <button className="icon-btn text-red" aria-label="Delete document">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseManager;
