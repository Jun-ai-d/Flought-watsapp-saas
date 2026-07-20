import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Users, MessageSquare, Clock, Bot, ArrowRight, CheckCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';

interface DashboardMetrics {
  totalMessages: number;
  botHandledCount: number;
  faqMatchTotal: number;
  handoverCount: number;
  recentHandovers?: any[];
  timeSeries?: Array<{ name: string, fullDate: string, messages: number, botHandled: number, agentResponseTime?: number, aiResponseTime?: number, adSpend?: number, adRevenue?: number }>;
  topicDistribution?: Array<{ name: string, value: number }>;
  currentUsage?: { messages_sent: number, llm_calls: number, stt_minutes: number };
  avgAiResponseTime?: number;
  avgAgentResponseTime?: number;
}

const formatDuration = (seconds?: number): string => {
  if (seconds === undefined || seconds === null) return '0s';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
};

const COLORS = ['#00C49F', '#0088FE', '#FFBB28', '#FF8042', '#8884d8', '#ff6b6b'];

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const Dashboard: React.FC = () => {
  const { tenant, session } = useAuth();
  const navigate = useNavigate();
  const { data: metrics, isLoading: loading } = useQuery({
    queryKey: ['dashboard-metrics', tenant?.id],
    queryFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/metrics/${tenant!.id}`, {
        headers: {
          'Authorization': `Bearer ${session!.access_token}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch metrics');
      return res.json() as Promise<DashboardMetrics>;
    },
    enabled: !!tenant?.id && !!session?.access_token,
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-theme-border/30 rounded animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-theme-border/20 rounded-xl animate-pulse"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-theme-border/20 rounded-xl animate-pulse"></div>
          <div className="h-96 bg-theme-border/20 rounded-xl animate-pulse"></div>
        </div>
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
  
  // Actual response times from backend (or 0 if not available yet)
  const chartData = (displayMetrics.timeSeries || []).map(d => ({
    ...d,
    agentResponseTime: d.agentResponseTime ?? 0,
    aiResponseTime: d.aiResponseTime ?? 0,
    adSpend: d.adSpend ?? 0,
    adRevenue: d.adRevenue ?? 0,
  }));

  const aiHandledRate = displayMetrics.totalMessages > 0 
    ? Math.round((displayMetrics.botHandledCount / displayMetrics.totalMessages) * 100) 
    : 0;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getEmoji = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '☕';
    if (hour < 18) return '☀️';
    return '🌙';
  };

  const userName = session?.user?.email?.split('@')[0] || 'there';
  const formattedName = userName.charAt(0).toUpperCase() + userName.slice(1);

  const statCards = [
    {
      title: "Active Handovers",
      value: (displayMetrics.handoverCount ?? 0).toString(),
      subtitle: "Live now",
      icon: Users,
      color: "text-red-500",
      bg: "bg-red-500/10"
    },
    {
      title: "Avg Response Time",
      value: displayMetrics.avgAiResponseTime !== undefined ? formatDuration(displayMetrics.avgAiResponseTime) : '0s',
      subtitle: displayMetrics.avgAgentResponseTime !== undefined ? `Agent: ${formatDuration(displayMetrics.avgAgentResponseTime)}` : "First reply",
      icon: Clock,
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    },
    {
      title: "AI Resolution Rate",
      value: `${aiHandledRate}%`,
      subtitle: "Bot-handled",
      icon: Bot,
      color: "text-brand-accent",
      bg: "bg-brand-accent/10"
    },
    {
      title: "FAQ Matches",
      value: (displayMetrics.faqMatchTotal ?? 0).toString(),
      subtitle: "Automated",
      icon: Clock,
      color: "text-purple-500",
      bg: "bg-purple-500/10"
    }
  ];

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="space-y-6"
    >
      <motion.div variants={fadeUp} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4">
        <div>
          <h1 className="text-lg md:text-3xl font-display font-bold text-theme-text">
            {getGreeting()}, <span className="text-brand-accent">{formattedName}</span> {getEmoji()}
          </h1>
          <p className="text-theme-text-muted mt-2 font-medium">Here's what's happening with your WhatsApp operations today.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => navigate('/inbox')}
            className="px-6 py-2.5 bg-brand-accent text-white font-bold shadow-lg hover:shadow-xl transition-all hover:scale-105 theme-button"
          >
            Open Inbox
          </button>
        </div>
      </motion.div>

      {/* Metrics Grid */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, idx) => {
          const Icon = stat.icon;
          
          return (
            <motion.div 
              key={idx} 
              whileHover={{ y: -5 }}
              className="theme-card p-3 md:p-6 group"
            >
              <div className="flex justify-between items-start mb-3 md:mb-6">
                <div className={`p-2 md:p-3 rounded-xl md:rounded-2xl ${stat.bg}`}>
                  <Icon className={`h-4 w-4 md:h-6 md:w-6 ${stat.color}`} />
                </div>
                <div className="flex items-center text-[10px] md:text-sm font-bold text-theme-text-muted bg-theme-text/5 px-2 py-0.5 md:px-3 md:py-1 rounded-full border border-theme-border/50">
                  {stat.subtitle}
                </div>
              </div>
              <div>
                <p className="text-2xl md:text-4xl font-display font-extrabold text-theme-text tracking-tight">{stat.value}</p>
                <h3 className="text-theme-text-muted text-sm font-bold mt-2 uppercase tracking-wide group-hover:text-theme-text transition-colors">{stat.title}</h3>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Usage Analytics Grid (Phase 4 addition) */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="theme-card p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-theme-text-muted uppercase tracking-wide">AI LLM Tokens</p>
            <p className="text-3xl font-display font-extrabold text-theme-text mt-2">{displayMetrics.currentUsage?.llm_calls || 0}</p>
          </div>
          <div className="p-4 rounded-full bg-brand-accent/10 text-brand-accent">
            <Bot size={24} />
          </div>
        </div>
        <div className="theme-card p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-theme-text-muted uppercase tracking-wide">Audio Transcribed (STT)</p>
            <p className="text-3xl font-display font-extrabold text-theme-text mt-2">{displayMetrics.currentUsage?.stt_minutes || 0} min</p>
          </div>
          <div className="p-4 rounded-full bg-purple-500/10 text-purple-500">
            <MessageSquare size={24} />
          </div>
        </div>
        <div className="theme-card p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-theme-text-muted uppercase tracking-wide">Monthly Messages Sent</p>
            <p className="text-3xl font-display font-extrabold text-theme-text mt-2">{displayMetrics.currentUsage?.messages_sent || 0}</p>
          </div>
          <div className="p-4 rounded-full bg-green-500/10 text-green-500">
            <CheckCircle size={24} />
          </div>
        </div>
      </motion.div>

      {/* Analytics Chart */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="theme-card p-8 lg:col-span-2">
          <h2 className="text-xl font-display font-bold text-theme-text mb-8">Message Volume (Last 7 Days)</h2>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-theme-text)" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="var(--color-theme-text)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorBot" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-brand-accent)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="var(--color-brand-accent)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="var(--color-theme-text-muted)" fontSize={12} tickLine={false} axisLine={false} dy={10} fontWeight={600} />
                <YAxis stroke="var(--color-theme-text-muted)" fontSize={12} tickLine={false} axisLine={false} dx={-10} fontWeight={600} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--color-theme-surface)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid var(--color-theme-border)',
                    borderRadius: 'var(--radius-theme-card)',
                    boxShadow: 'var(--shadow-theme-card)',
                    color: 'var(--color-theme-text)'
                  }}
                  labelStyle={{ fontWeight: 'bold', color: 'var(--color-theme-text)', marginBottom: '8px' }}
                  cursor={{ stroke: 'var(--color-theme-border)', strokeWidth: 2, strokeDasharray: '4 4' }}
                />
                <Area type="monotone" dataKey="messages" name="Total Messages" stroke="var(--color-theme-text)" strokeWidth={3} fillOpacity={1} fill="url(#colorMessages)" />
                <Area type="monotone" dataKey="botHandled" name="AI Handled" stroke="var(--color-brand-accent)" strokeWidth={3} fillOpacity={1} fill="url(#colorBot)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="theme-card p-8">
          <h2 className="text-xl font-display font-bold text-theme-text mb-4">Topic Breakdown</h2>
          <p className="text-sm text-theme-text-muted font-medium mb-6">AI-extracted topics from resolved chats.</p>
          <div className="h-[250px] w-full flex items-center justify-center relative">
            {displayMetrics.topicDistribution && displayMetrics.topicDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={displayMetrics.topicDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {displayMetrics.topicDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--color-theme-surface)',
                      borderColor: 'var(--color-theme-border)',
                      borderRadius: '8px',
                      color: 'var(--color-theme-text)'
                    }}
                    itemStyle={{ color: 'var(--color-theme-text)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-theme-text-muted font-medium">
                <CheckCircle size={32} className="mx-auto mb-2 opacity-20" />
                No topics extracted yet. Resolve chats to see data.
              </div>
            )}
            {displayMetrics.topicDistribution && displayMetrics.topicDistribution.length > 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="text-2xl font-bold text-theme-text">{displayMetrics.topicDistribution.reduce((a, b) => a + b.value, 0)}</div>
                  <div className="text-xs text-theme-text-muted">Total</div>
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {(displayMetrics.topicDistribution || []).map((topic, idx) => (
              <div key={idx} className="flex items-center text-xs font-bold text-theme-text-muted">
                <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                {topic.name}
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Response Time Analytics */}
      <motion.div variants={fadeUp} className="mt-6 theme-card p-8">
        <h2 className="text-xl font-display font-bold text-theme-text mb-2">Response Times (Last 7 Days)</h2>
        <p className="text-sm text-theme-text-muted font-medium mb-8">Compare average seconds to first reply between Human Agents and AI.</p>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-theme-border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--color-theme-text-muted)" fontSize={12} tickLine={false} axisLine={false} dy={10} fontWeight={600} />
              <YAxis stroke="var(--color-theme-text-muted)" fontSize={12} tickLine={false} axisLine={false} dx={-10} fontWeight={600} tickFormatter={(val) => `${val}s`} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--color-theme-surface)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid var(--color-theme-border)',
                  borderRadius: 'var(--radius-theme-card)',
                  boxShadow: 'var(--shadow-theme-card)',
                  color: 'var(--color-theme-text)'
                }}
                labelStyle={{ fontWeight: 'bold', color: 'var(--color-theme-text)', marginBottom: '8px' }}
                cursor={{ stroke: 'var(--color-theme-border)', strokeWidth: 2, strokeDasharray: '4 4' }}
                formatter={(value: number) => [`${value}s`, undefined]}
              />
              <Line type="monotone" dataKey="agentResponseTime" name="Agent (Seconds)" stroke="#FF8042" strokeWidth={3} dot={{ r: 4, fill: '#FF8042', strokeWidth: 0 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="aiResponseTime" name="AI (Seconds)" stroke="var(--color-brand-accent)" strokeWidth={3} dot={{ r: 4, fill: 'var(--color-brand-accent)', strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* ROAS Tracking Analytics (Phase 4 addition) */}
      <motion.div variants={fadeUp} className="mt-6 theme-card p-8">
        <h2 className="text-xl font-display font-bold text-theme-text mb-2">Return on Ad Spend (ROAS)</h2>
        <p className="text-sm text-theme-text-muted font-medium mb-8">Compare daily Ad Spend vs. Revenue generated from Click-to-WhatsApp ads.</p>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff6b6b" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#ff6b6b" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00C49F" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#00C49F" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="name" stroke="var(--color-theme-text-muted)" fontSize={12} tickLine={false} axisLine={false} dy={10} fontWeight={600} />
              <YAxis stroke="var(--color-theme-text-muted)" fontSize={12} tickLine={false} axisLine={false} dx={-10} fontWeight={600} tickFormatter={(val) => `$${val}`} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--color-theme-surface)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid var(--color-theme-border)',
                  borderRadius: 'var(--radius-theme-card)',
                  boxShadow: 'var(--shadow-theme-card)',
                  color: 'var(--color-theme-text)'
                }}
                labelStyle={{ fontWeight: 'bold', color: 'var(--color-theme-text)', marginBottom: '8px' }}
                cursor={{ stroke: 'var(--color-theme-border)', strokeWidth: 2, strokeDasharray: '4 4' }}
                formatter={(value: number) => [`$${value}`, undefined]}
              />
              <Area type="monotone" dataKey="adSpend" name="Ad Spend" stroke="#ff6b6b" strokeWidth={3} fillOpacity={1} fill="url(#colorSpend)" />
              <Area type="monotone" dataKey="adRevenue" name="Revenue" stroke="#00C49F" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Quick Actions Area */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="theme-card p-8">
          <h2 className="text-xl font-display font-bold text-theme-text mb-6">Recent Handovers</h2>
          <div className="space-y-4">
            {displayMetrics.recentHandovers && displayMetrics.recentHandovers.length > 0 ? (
              displayMetrics.recentHandovers.map((handover: any, idx: number) => (
                <div 
                  key={idx} 
                  className="flex justify-between items-center p-4 bg-theme-text/5 border border-transparent hover:border-theme-border cursor-pointer transition-all hover:bg-theme-text/10 group"
                  style={{ borderRadius: 'var(--radius-theme-card)' }}
                  onClick={() => navigate(`/inbox`)}
                >
                  <div>
                    <p className="font-bold text-theme-text">{handover.customer_phone}</p>
                    <p className="text-sm text-brand-accent mt-1 font-medium bg-brand-accent/10 inline-block px-2 py-0.5 rounded-full">
                      {handover.handover_reason || 'Human Support Requested'}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-theme-surface flex items-center justify-center shadow-sm text-theme-text-muted group-hover:text-brand-accent transition-colors">
                    <ArrowRight size={18} />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 bg-theme-text/5 border border-dashed border-theme-border" style={{ borderRadius: 'var(--radius-theme-card)' }}>
                <p className="text-theme-text-muted font-medium">No pending handovers right now.<br/>AI is handling everything! 🚀</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="theme-card p-8 relative overflow-hidden bg-theme-text text-theme-bg">
          <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-brand-accent/20 blur-[60px] pointer-events-none"></div>
          <h2 className="text-2xl font-display font-bold mb-4 relative z-10 text-theme-bg">Scale your AI's Knowledge</h2>
          <p className="text-theme-bg/80 text-base mb-8 relative z-10 leading-relaxed max-w-md font-medium">
            Your AI assistant uses the Knowledge Base and FAQs to instantly resolve customer queries. Keep it updated for the best automated resolution rate.
          </p>
          <div className="flex flex-wrap gap-4 relative z-10">
            <button 
              onClick={() => navigate('/faqs')}
              className="px-6 py-3 bg-theme-bg text-theme-text font-bold hover:opacity-90 transition-colors shadow-lg theme-button border border-theme-bg"
            >
              Manage FAQs
            </button>
            <button 
              onClick={() => navigate('/knowledge')}
              className="px-6 py-3 border border-theme-bg/20 bg-theme-bg/10 text-theme-bg font-bold hover:bg-theme-bg/20 transition-colors backdrop-blur-md theme-button"
            >
              Upload PDF Base
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default React.memo(Dashboard);
