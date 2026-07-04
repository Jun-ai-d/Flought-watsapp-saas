import React from 'react';
import { Plus, CheckCircle, Clock, XCircle } from 'lucide-react';
import './TemplateManager.css';

const MOCK_TEMPLATES = [
  { id: 1, name: 'appointment_reminder_24h', category: 'Utility', status: 'approved', lastUpdated: '2026-06-15' },
  { id: 2, name: 'post_visit_feedback', category: 'Utility', status: 'approved', lastUpdated: '2026-06-18' },
  { id: 3, name: 'diwali_special_offer', category: 'Marketing', status: 'rejected', lastUpdated: '2026-07-02', reason: 'Promotional content must be categorized as Marketing, not Utility.' },
  { id: 4, name: 'monthly_newsletter', category: 'Marketing', status: 'pending', lastUpdated: 'Today' },
];

const TemplateManager: React.FC = () => {
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Message Templates</h1>
          <p className="text-gray">Manage pre-approved WhatsApp templates for outbound messaging.</p>
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.5, cursor: 'not-allowed' }} disabled>
          <Plus size={18} /> New Template
        </button>
      </div>

      <div className="margin-rule" style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'rgba(193, 68, 14, 0.1)', border: '1px solid rgba(193, 68, 14, 0.2)', color: '#C1440E', borderRadius: '8px' }}>
        <strong>🚧 Coming Soon:</strong> Template creation and management will be available once you connect your BSP provider in Settings. The data below is sample preview data.
      </div>

      <div className="content-panel margin-rule" style={{ marginLeft: '1rem' }}>
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
            {MOCK_TEMPLATES.map(template => (
              <tr key={template.id}>
                <td>
                  <strong>{template.name}</strong>
                  {template.status === 'rejected' && (
                    <div className="text-red" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      Reason: {template.reason}
                    </div>
                  )}
                </td>
                <td>{template.category}</td>
                <td>
                  <span className={`status-badge ${template.status}`}>
                    {template.status === 'approved' && <CheckCircle size={14} />}
                    {template.status === 'pending' && <Clock size={14} />}
                    {template.status === 'rejected' && <XCircle size={14} />}
                    {template.status.toUpperCase()}
                  </span>
                </td>
                <td className="text-gray">{template.lastUpdated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TemplateManager;
