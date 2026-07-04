import React, { useState, useEffect } from 'react';
import { CreditCard, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import './Billing.css';

const Billing: React.FC = () => {
  const { tenant } = useAuth();
  const [sub, setSub] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant) return;
    
    const fetchData = async () => {
      setLoading(true);
      
      // Fetch subscription and usage in parallel
      const billingPeriod = new Date();
      billingPeriod.setDate(1);
      const periodStr = billingPeriod.toISOString().split('T')[0];
      
      const [subRes, usageRes] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('status', 'active')
          .single(),
        supabase
          .from('usage_tracking')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('billing_period', periodStr)
          .single()
      ]);
      
      if (!subRes.error && subRes.data) setSub(subRes.data);
      if (!usageRes.error && usageRes.data) setUsage(usageRes.data);
      
      setLoading(false);
    };
    
    fetchData();
  }, [tenant]);

  const messagesSent = usage?.messages_sent || 0;
  const llmCalls = usage?.llm_calls || 0;
  const sttMinutes = Number(usage?.stt_minutes || 0).toFixed(1);
  const capMessages = sub?.cap_messages || 1500;
  
  const msgPercent = Math.min(100, Math.round((messagesSent / capMessages) * 100));
  const llmPercent = Math.min(100, Math.round((llmCalls / 1500) * 100));

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
                    <span style={{ fontWeight: 600 }}>Messages Sent</span>
                    <span className="font-record">{messagesSent.toLocaleString()} / {capMessages.toLocaleString()}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill bg-indigo" style={{ width: `${msgPercent}%` }}></div>
                  </div>
                  <div className="text-gray" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                    Overage rate: ₹0.30 per message
                  </div>
                </div>

                <div className="usage-item">
                  <div className="usage-header">
                    <span style={{ fontWeight: 600 }}>AI RAG Queries (LLM Calls)</span>
                    <span className="font-record">{llmCalls.toLocaleString()} / 1,500</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill bg-indigo" style={{ width: `${llmPercent}%` }}></div>
                  </div>
                </div>

                <div className="usage-item">
                  <div className="usage-header">
                    <span style={{ fontWeight: 600 }}>Voice Note Transcription (STT)</span>
                    <span className="font-record">{sttMinutes} minutes</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill bg-red" style={{ width: `${Math.min(100, Number(sttMinutes) / 60 * 100)}%` }}></div>
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
