import React, { useState, useEffect } from 'react';
import { AlertCircle, CreditCard, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import './Billing.css';

const Billing: React.FC = () => {
  const { tenant } = useAuth();
  const [sub, setSub] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant) return;
    
    const fetchSubscription = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active')
        .single();
        
      if (!error && data) {
        setSub(data);
      }
      setLoading(false);
    };
    
    fetchSubscription();
  }, [tenant]);

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
      <div className="margin-rule" style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: 'rgba(193, 68, 14, 0.1)', border: '1px solid rgba(193, 68, 14, 0.2)', color: '#C1440E', borderRadius: '8px' }}>
        <strong>Testing Phase:</strong> Billing integration is currently paused while we test Razorpay for the Indian market. The usage stats below are simulated placeholders for your active plan.
      </div>

      <div className="billing-grid">
        {/* Current Plan & Limits */}
        <div className="content-panel plan-panel">
          {loading ? (
            <div className="text-gray">Loading subscription details...</div>
          ) : sub ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem', textTransform: 'capitalize' }}>
                    Current Plan: {sub.plan}
                  </h2>
                  <p className="font-record text-gray">₹{sub.price_inr?.toLocaleString()}/mo</p>
                </div>
                <div className="stamp-badge">ACTIVE</div>
              </div>
              
              <div className="usage-stats">
                <div className="usage-item">
                  <div className="usage-header">
                    <span style={{ fontWeight: 600 }}>Utility/Service Messages</span>
                    <span className="font-record">0 / {sub.cap_messages?.toLocaleString()}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill bg-indigo" style={{ width: '0%' }}></div>
                  </div>
                  <div className="text-gray" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                    Overage rate: ₹0.30 per message
                  </div>
                </div>

                <div className="usage-item">
                  <div className="usage-header">
                    <span style={{ fontWeight: 600 }}>Marketing Messages</span>
                    <span className="font-record">0 / 500</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill bg-red" style={{ width: '0%' }}></div>
                  </div>
                </div>

                <div className="usage-item">
                  <div className="usage-header">
                    <span style={{ fontWeight: 600 }}>AI RAG Queries</span>
                    <span className="font-record">0 / 1,500</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill bg-indigo" style={{ width: '0%' }}></div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-gray">No active subscription found. Please contact support.</div>
          )}
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
              {/* Still Mocked for demo since we don't have stripe/razorpay invoices yet */}
              <tr>
                <td>Jul 01, 2026</td>
                <td className="font-record">₹{sub?.price_inr?.toLocaleString() || '0'}</td>
                <td><span className="status-badge approved">PAID</span></td>
                <td>
                  <button className="icon-btn text-indigo" disabled><Download size={18} /></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Billing;
