import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Server, TrendingUp, MessageSquare, Building, DollarSign, Activity, PieChart, Plus, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const AdminOverview: React.FC = () => {
  const { session, isPlatformAdmin, loading } = useAuth();
  
  const [expenseForm, setExpenseForm] = useState({ name: '', amount_inr: 0 });
  const [addingExpense, setAddingExpense] = useState(false);

  const { data: metrics, isLoading: loadingMetrics, refetch } = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/admin/metrics`, {
        headers: { 'Authorization': `Bearer ${session!.access_token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch metrics');
      return res.json();
    },
    enabled: !!session?.access_token && isPlatformAdmin,
    refetchInterval: 60000, // refresh every minute to keep P&L live
  });

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !expenseForm.name || expenseForm.amount_inr <= 0) return;
    setAddingExpense(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/admin/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(expenseForm)
      });
      if (!res.ok) throw new Error('API Error');
      setExpenseForm({ name: '', amount_inr: 0 });
      refetch();
    } catch (err) {
      alert('Failed to add expense');
    } finally {
      setAddingExpense(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!session || !window.confirm('Delete this expense?')) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      await fetch(`${apiUrl}/api/admin/expenses/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      refetch();
    } catch (err) {
      alert('Failed to delete expense');
    }
  };

  if (loading || loadingMetrics) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent"></div>
      </div>
    );
  }
  
  if (!isPlatformAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="border-b border-theme-border pb-4">
        <h1 className="text-3xl font-bold text-theme-text flex items-center tracking-tight">
          <Server className="mr-3 h-8 w-8 text-brand-accent" />
          Platform Overview
        </h1>
        <p className="text-theme-text-muted mt-2 text-lg font-medium">Global SaaS KPIs and high-level platform health.</p>
      </div>

      {/* Main P&L Hero Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-6 bg-theme-surface border border-theme-border rounded shadow-sm hover:shadow-md transition-shadow border-t-4 border-t-emerald-500">
          <div className="text-theme-text-muted text-xs font-bold uppercase tracking-wider mb-2 flex items-center">
            <TrendingUp size={16} className="mr-2 text-emerald-500" /> Total Income (MRR)
          </div>
          <div className="text-3xl font-mono font-bold text-theme-text">
            ₹{metrics?.mrr?.toLocaleString() || '0'}
          </div>
        </div>
        
        <div className="p-6 bg-theme-surface border border-theme-border rounded shadow-sm hover:shadow-md transition-shadow border-t-4 border-t-rose-500">
          <div className="text-theme-text-muted text-xs font-bold uppercase tracking-wider mb-2 flex items-center">
            <Activity size={16} className="mr-2 text-rose-500" /> Total Expenses
          </div>
          <div className="text-3xl font-mono font-bold text-theme-text">
            ₹{metrics?.financials?.totalExpenses?.toLocaleString() || '0'}
          </div>
        </div>

        <div className="p-6 bg-theme-surface border border-theme-border rounded shadow-sm hover:shadow-md transition-shadow border-t-4 border-t-indigo-500">
          <div className="text-theme-text-muted text-xs font-bold uppercase tracking-wider mb-2 flex items-center">
            <DollarSign size={16} className="mr-2 text-brand-accent" /> Net Profit
          </div>
          <div className="text-3xl font-mono font-bold text-theme-text">
            ₹{metrics?.financials?.netProfit?.toLocaleString() || '0'}
          </div>
        </div>

        <div className="p-6 bg-theme-surface border border-theme-border rounded shadow-sm hover:shadow-md transition-shadow border-t-4 border-t-sky-500">
          <div className="text-theme-text-muted text-xs font-bold uppercase tracking-wider mb-2 flex items-center">
            <PieChart size={16} className="mr-2 text-sky-500" /> Profit Margin
          </div>
          <div className="text-3xl font-mono font-bold text-theme-text">
            {metrics?.financials?.profitMargin?.toFixed(1) || '0'}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Dynamic API Costs */}
        <div className="p-6 bg-theme-surface border border-theme-border rounded">
          <h2 className="text-xl font-bold text-theme-text mb-6 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-rose-500" /> Dynamic API Costs (This Month)
          </h2>
          
          <div className="space-y-4">
            <div className="p-4 bg-theme-bg border border-theme-border rounded flex justify-between items-center">
              <div>
                <div className="font-bold text-theme-text">WhatsApp API</div>
                <div className="text-xs text-theme-text-muted font-mono">{metrics?.volume?.toLocaleString() || '0'} messages @ ₹0.75</div>
              </div>
              <div className="font-mono font-bold text-rose-400">
                ₹{metrics?.financials?.breakdown?.msgCost?.toLocaleString() || '0'}
              </div>
            </div>

            <div className="p-4 bg-theme-bg border border-theme-border rounded flex justify-between items-center">
              <div>
                <div className="font-bold text-theme-text">OpenAI / LLM</div>
                <div className="text-xs text-theme-text-muted font-mono">Calculated Calls @ ₹1.50</div>
              </div>
              <div className="font-mono font-bold text-rose-400">
                ₹{metrics?.financials?.breakdown?.llmCost?.toLocaleString() || '0'}
              </div>
            </div>

            <div className="p-4 bg-theme-bg border border-theme-border rounded flex justify-between items-center">
              <div>
                <div className="font-bold text-theme-text">Voice STT Minutes</div>
                <div className="text-xs text-theme-text-muted font-mono">Calculated Mins @ ₹0.50</div>
              </div>
              <div className="font-mono font-bold text-rose-400">
                ₹{metrics?.financials?.breakdown?.sttCost?.toLocaleString() || '0'}
              </div>
            </div>
            
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded flex justify-between items-center mt-6">
              <div className="font-bold text-rose-500 uppercase text-sm tracking-wider">Total API Infrastructure</div>
              <div className="font-mono font-bold text-xl text-rose-500">
                ₹{metrics?.financials?.apiCosts?.toLocaleString() || '0'}
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Expenses Manager */}
        <div className="p-6 bg-theme-surface border border-theme-border rounded">
          <h2 className="text-xl font-bold text-theme-text mb-6 flex items-center">
            <Building className="w-5 h-5 mr-2 text-theme-text-muted" /> Fixed Monthly Expenses
          </h2>
          
          <form onSubmit={handleAddExpense} className="flex gap-3 mb-6">
            <input 
              type="text"
              placeholder="Expense Name (e.g. AWS)"
              value={expenseForm.name}
              onChange={e => setExpenseForm({...expenseForm, name: e.target.value})}
              className="flex-1 bg-theme-bg border border-theme-border text-theme-text rounded px-4 py-2 focus:border-indigo-500 focus:outline-none text-sm font-medium"
              required
            />
            <input 
              type="number"
              placeholder="Amount ₹"
              value={expenseForm.amount_inr || ''}
              onChange={e => setExpenseForm({...expenseForm, amount_inr: parseFloat(e.target.value) || 0})}
              className="w-32 bg-theme-bg border border-theme-border text-theme-text rounded px-4 py-2 focus:border-indigo-500 focus:outline-none font-mono text-sm"
              required
            />
            <button 
              type="submit"
              disabled={addingExpense}
              className="px-4 py-2 bg-indigo-600 text-theme-text font-bold rounded hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>

          <div className="space-y-3">
            {metrics?.expensesList?.length === 0 ? (
              <div className="text-center py-6 text-theme-text-muted italic text-sm border border-dashed border-theme-border rounded">
                No fixed expenses logged.
              </div>
            ) : (
              metrics?.expensesList?.map((exp: any) => (
                <div key={exp.id} className="p-3 bg-theme-bg border border-theme-border rounded flex justify-between items-center group">
                  <div className="font-bold text-theme-text text-sm">{exp.name}</div>
                  <div className="flex items-center gap-4">
                    <div className="font-mono font-bold text-theme-text-muted">₹{exp.amount_inr?.toLocaleString()}</div>
                    <button 
                      onClick={() => handleDeleteExpense(exp.id)}
                      className="text-theme-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                      title="Delete Expense"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
            
            <div className="p-4 bg-theme-surface-hover/50 rounded flex justify-between items-center mt-6 border-t border-theme-border">
              <div className="font-bold text-theme-text-muted uppercase text-sm tracking-wider">Total Fixed Costs</div>
              <div className="font-mono font-bold text-lg text-theme-text">
                ₹{metrics?.financials?.fixedExpenses?.toLocaleString() || '0'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
