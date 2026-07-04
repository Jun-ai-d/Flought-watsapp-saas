import React from 'react';
import { AlertCircle, CreditCard, Download } from 'lucide-react';
import './Billing.css';

const Billing: React.FC = () => {
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Usage & Billing</h1>
          <p className="text-gray">Monitor your current billing cycle usage and overage limits.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} disabled>
            <CreditCard size={18} /> Update Payment Method
          </button>
          <span className="text-gray" style={{ fontSize: '0.85rem' }}>* Payments via Razorpay coming soon</span>
        </div>
      </div>

      {/* Razorpay Placeholder Notice */}
      <div className="margin-rule" style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#fff3cd', border: '1px solid #ffeeba', color: '#856404' }}>
        <strong>Testing Phase:</strong> Billing integration is currently paused while we test Razorpay for the Indian market. The usage stats below are simulated placeholders for now.
      </div>

      <div className="billing-grid">
        {/* Current Plan & Limits */}
        <div className="content-panel plan-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Current Plan: Growth</h2>
              <p className="font-record text-gray">₹4,999/mo</p>
            </div>
            <div className="stamp-badge">ACTIVE</div>
          </div>
          
          <div className="usage-stats">
            <div className="usage-item">
              <div className="usage-header">
                <span style={{ fontWeight: 600 }}>Utility/Service Messages</span>
                <span className="font-record">2,850 / 4,000</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill bg-indigo" style={{ width: '71%' }}></div>
              </div>
              <div className="text-gray" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                Overage rate: ₹0.30 per message
              </div>
            </div>

            <div className="usage-item">
              <div className="usage-header">
                <span style={{ fontWeight: 600 }}>Marketing Messages</span>
                <span className="font-record">480 / 500</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill bg-red" style={{ width: '96%' }}></div>
              </div>
              <div className="security-notice" style={{ marginTop: '0.5rem' }}>
                <AlertCircle size={14} className="text-red" />
                <span className="text-red">Nearing limit. Overage applies soon.</span>
              </div>
            </div>

            <div className="usage-item">
              <div className="usage-header">
                <span style={{ fontWeight: 600 }}>AI RAG Queries</span>
                <span className="font-record">1,200 / 1,500</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill bg-indigo" style={{ width: '80%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice History */}
        <div className="content-panel invoice-panel">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Invoice History</h2>
          
          <table className="templates-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Invoice</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Jul 01, 2026</td>
                <td className="font-record">₹4,999</td>
                <td><span className="status-badge approved">PAID</span></td>
                <td>
                  <button className="icon-btn text-indigo"><Download size={18} /></button>
                </td>
              </tr>
              <tr>
                <td>Jun 01, 2026</td>
                <td className="font-record">₹5,149</td>
                <td><span className="status-badge approved">PAID</span></td>
                <td>
                  <button className="icon-btn text-indigo"><Download size={18} /></button>
                </td>
              </tr>
              <tr>
                <td>May 01, 2026</td>
                <td className="font-record">₹4,999</td>
                <td><span className="status-badge approved">PAID</span></td>
                <td>
                  <button className="icon-btn text-indigo"><Download size={18} /></button>
                </td>
              </tr>
            </tbody>
          </table>
          
          <p className="text-gray" style={{ fontSize: '0.85rem', marginTop: '1.5rem' }}>
            * Note: June invoice includes ₹150 in overage charges for Marketing messages.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Billing;
