import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Users, MessageSquare, Clock, ArrowUpRight, ArrowDownRight, Bot } from 'lucide-react';

interface DashboardMetrics {
  totalMessages: number;
  botHandledCount: number;
  faqMatchTotal: number;
  handoverCount: number;
  recentHandovers?: any[];
}

const Dashboard: React.FC = () => {
  const { tenant, session } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      if (!tenant || !session) return;
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
        const res = await fetch(`${apiUrl}/api/metrics/${tenant.id}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        if (!res.ok) throw new Error('Failed to fetch metrics');
        const data = await res.json();
        setMetrics(data);
      } catch (err) {
        console.error('Error fetching metrics', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, [tenant, session]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C1440E]"></div>
      </div>
    );
  }

  const defaultMetrics: DashboardMetrics = {
    totalMessages: 0,
    botHandledCount: 0,
    faqMatchTotal: 0,
    handoverCount: 0,
  };

  const displayMetrics = metrics || defaultMetrics;
  
  const aiHandledRate = displayMetrics.totalMessages > 0 
    ? Math.round((displayMetrics.botHandledCount / displayMetrics.totalMessages) * 100) 
    : 0;

  const statCards = [
    {
      title: "Active Handovers",
      value: (displayMetrics.handoverCount ?? 0).toString(),
      change: "Live",
      trend: "up",
      icon: Users
    },
    {
      title: "Total Messages",
      value: (displayMetrics.totalMessages ?? 0).toLocaleString(),
      change: "+8%",
      trend: "up",
      icon: MessageSquare
    },
    {
      title: "AI Resolution Rate",
      value: `${aiHandledRate}%`,
      change: "-2%",
      trend: "down",
      icon: Bot
    },
    {
      title: "FAQ Matches",
      value: (displayMetrics.faqMatchTotal ?? 0).toString(),
      change: "Automated",
      trend: "up",
      icon: Clock
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b-2 border-[#1A1A1A] pb-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-[#1A1A1A]">Dashboard</h1>
          <p className="text-[#666666] mt-1">Overview of your WhatsApp operations</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => navigate('/inbox')}
            className="px-6 py-2 bg-[#C1440E] text-white font-medium hover:bg-[#d65a24] transition-colors border-2 border-[#C1440E]"
          >
            Open Inbox
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, idx) => {
          const Icon = stat.icon;
          const isPositiveTrend = stat.trend === 'up';
          
          return (
            <div key={idx} className="bg-white border-2 border-[#E5E5E5] p-6 hover:border-[#1A1A1A] transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-[#F5F5F0] border-2 border-[#E5E5E5]">
                  <Icon className="h-5 w-5 text-[#1A1A1A]" />
                </div>
                <div className={cn(
                  "flex items-center text-sm font-medium",
                  isPositiveTrend ? "text-[#16A34A]" : "text-[#DC2626]"
                )}>
                  {stat.change}
                  {isPositiveTrend ? <ArrowUpRight className="ml-1 h-4 w-4" /> : <ArrowDownRight className="ml-1 h-4 w-4" />}
                </div>
              </div>
              <div>
                <h3 className="text-[#666666] text-sm font-medium">{stat.title}</h3>
                <p className="text-3xl font-display font-bold text-[#1A1A1A] mt-1">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-white border-2 border-[#E5E5E5] p-6">
          <h2 className="text-xl font-display font-bold text-[#1A1A1A] mb-4">Recent Handovers</h2>
          <div className="space-y-3">
            {displayMetrics.recentHandovers && displayMetrics.recentHandovers.length > 0 ? (
              displayMetrics.recentHandovers.map((handover: any, idx: number) => (
                <div 
                  key={idx} 
                  className="flex justify-between items-center p-3 bg-[#F5F5F0] border-2 border-[#E5E5E5] hover:border-[#C1440E] cursor-pointer transition-colors"
                  onClick={() => navigate(`/inbox`)}
                >
                  <div>
                    <p className="font-medium text-[#1A1A1A]">{handover.customer_phone}</p>
                    <p className="text-xs text-[#C1440E] mt-1 font-medium">Reason: {handover.handover_reason || 'Human Support Requested'}</p>
                  </div>
                  <button className="text-sm bg-white border-2 border-[#1A1A1A] px-3 py-1 font-medium text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white transition-colors">
                    Reply
                  </button>
                </div>
              ))
            ) : (
              <p className="text-[#666666] italic text-sm">No pending handovers right now. AI is handling everything! 🚀</p>
            )}
          </div>
        </div>
        
        <div className="bg-[#1A1A1A] border-2 border-[#1A1A1A] p-6 text-white">
          <h2 className="text-xl font-display font-bold mb-2">Need to update AI knowledge?</h2>
          <p className="text-gray-300 text-sm mb-6">
            The AI assistant uses your Knowledge Base and FAQs to answer customer queries automatically.
          </p>
          <div className="flex gap-4">
            <button 
              onClick={() => navigate('/faqs')}
              className="px-4 py-2 bg-white text-[#1A1A1A] font-medium hover:bg-gray-100 transition-colors"
            >
              Manage FAQs
            </button>
            <button 
              onClick={() => navigate('/knowledge')}
              className="px-4 py-2 border-2 border-white text-white font-medium hover:bg-white/10 transition-colors"
            >
              Knowledge Base
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Simple generic cn function for this file if utils isn't fully imported correctly
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export default Dashboard;
