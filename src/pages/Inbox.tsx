import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, MessageSquare, AlertCircle, Bot, User, Send, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

/**
 * Inbox (Human Handover Interface)
 * 
 * This is the primary interface for human agents to take over conversations
 * from the AI. It uses Supabase Realtime subscriptions to push new messages
 * and conversation state changes directly to the UI without polling.
 */
const Inbox: React.FC = () => {
  const { tenant, session } = useAuth();
  
  // selectedId tracks which conversation is currently active in the Detail Pane.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'handover_pending' | 'resolved'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [conversations, setConversations] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  
  // Template state
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [templateParams, setTemplateParams] = useState<string[]>([]);
  const [sendingTemplate, setSendingTemplate] = useState(false);

  // 1. Initial Fetch: Conversations List and Templates
  useEffect(() => {
    if (!tenant) return;
    
    const fetchData = async () => {
      setLoading(true);
      
      const [convRes, tempRes] = await Promise.all([
        supabase
          .from('conversations')
          .select('*')
          .eq('tenant_id', tenant.id)
          .order('last_message_at', { ascending: false })
          .limit(50),
        supabase
          .from('message_templates')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('status', 'approved')
      ]);
        
      if (!convRes.error && convRes.data) {
        setConversations(convRes.data);
      }
      if (!tempRes.error && tempRes.data) {
        setTemplates(tempRes.data);
      }
      setLoading(false);
    };
    
    fetchData();
  }, [tenant]);

  // 2. Initial Fetch: Messages for the selected conversation
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', selectedId)
        .order('created_at', { ascending: true });
        
      if (!error && data) {
        setMessages(data);
      }
    };
    
    fetchMessages();
  }, [selectedId]);

  // 3. Supabase Realtime Subscription: Conversations
  useEffect(() => {
    if (!tenant) return;

    const channel = supabase.channel('inbox-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'conversations', 
        filter: `tenant_id=eq.${tenant.id}` 
      }, (payload) => {
        setConversations(prev => {
          const exists = prev.find(c => c.id === payload.new.id);
          if (exists) {
            return prev.map(c => c.id === payload.new.id ? payload.new : c);
          }
          return [payload.new, ...prev];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant]);

  // 4. Supabase Realtime Subscription: Messages
  useEffect(() => {
    if (!selectedId || !tenant) return;
    
    const msgChannel = supabase.channel(`messages-${selectedId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages', 
        filter: `conversation_id=eq.${selectedId}` 
      }, (payload) => {
        setMessages(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
    };
  }, [selectedId, tenant]);

  const selectedConv = conversations.find(c => c.id === selectedId);

  const handleClaim = useCallback(async () => {
    if (!selectedId || !tenant) return;
    const { data, error } = await supabase
      .from('conversations')
      .update({ 
        status: 'handover_active',
        assigned_agent_id: (await supabase.auth.getUser()).data.user?.id
      })
      .eq('id', selectedId)
      .eq('status', 'handover_pending')
      .select();
      
    if (!error && data && data.length > 0) {
      setConversations(conversations.map(c => c.id === selectedId ? { ...c, status: 'handover_active' } : c));
    }
  }, [selectedId, tenant, conversations]);

  const handleReturnToBot = useCallback(async () => {
    if (!selectedId) return;
    const { error } = await supabase
      .from('conversations')
      .update({ status: 'bot' })
      .eq('id', selectedId);
      
    if (!error) {
      setConversations(conversations.map(c => c.id === selectedId ? { ...c, status: 'bot' } : c));
      setSelectedId(null);
    }
  }, [selectedId, conversations]);

  const handleSendReply = useCallback(async () => {
    if (!selectedId || !replyText.trim() || !tenant || !session) return;
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/send`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          tenantId: tenant.id,
          conversationId: selectedId,
          text: replyText,
          providerName: 'gupshup'
        })
      });

      if (!res.ok) {
        throw new Error('Failed to send message');
      }

      setReplyText('');
    } catch (error) {
      console.error('Error sending message via API:', error);
      alert('Failed to send message. Is the backend server running?');
    }
  }, [selectedId, replyText, tenant, session, messages]);

  const formatTime = useCallback((ts: string) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  const memoizedConversations = useMemo(() => {
    if (loading) {
      return <div className="p-8 text-center text-[#666666] font-medium">Loading...</div>;
    }
    if (conversations.length === 0) {
      return <div className="p-8 text-center text-[#666666] font-medium">No conversations found.</div>;
    }
    
    let filtered = conversations;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = conversations.filter(c => 
        (c.customer_name && c.customer_name.toLowerCase().includes(lower)) ||
        (c.customer_phone && c.customer_phone.includes(lower))
      );
    }
    
    if (filtered.length === 0) {
      return <div className="p-8 text-center text-[#666666] font-medium">No matches found for "{searchTerm}".</div>;
    }

    return filtered.map(conv => (
      <li 
        key={conv.id} 
        className={cn(
          "p-4 border-b-2 border-[#E5E5E5] cursor-pointer hover:bg-gray-50 transition-colors",
          selectedId === conv.id ? "bg-orange-50 border-l-4 border-l-[#C1440E]" : ""
        )}
        onClick={() => setSelectedId(conv.id)}
      >
        <div className="flex justify-between items-start mb-2">
          <span className="font-mono text-sm text-[#666666]">{conv.customer_phone}</span>
          <span className="text-xs text-[#666666] font-medium">{formatTime(conv.last_message_at)}</span>
        </div>
        <div className="flex justify-between items-center mt-1">
          <div className="font-bold text-[#1A1A1A]">{conv.customer_name || 'Customer'}</div>
          <div className={cn(
            "px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider border",
            conv.status === 'bot' ? "bg-blue-50 text-blue-700 border-blue-200" :
            conv.status === 'handover_pending' ? "bg-orange-100 text-[#C1440E] border-orange-200" :
            conv.status === 'handover_active' ? "bg-purple-50 text-purple-700 border-purple-200" :
            "bg-green-50 text-green-700 border-green-200"
          )}>
            {conv.status.replace('_', ' ')}
          </div>
        </div>
      </li>
    ));
  }, [loading, conversations, selectedId, formatTime]);

  const memoizedMessages = useMemo(() => {
    if (messages.length === 0) {
      return <div className="text-center text-[#666666] font-medium mt-8">No messages loaded.</div>;
    }
    return messages.map(msg => (
      <div key={msg.id} className={cn("flex flex-col max-w-[75%]", msg.direction === 'inbound' ? "self-start items-start" : "self-end items-end ml-auto")}>
        <div className={cn(
          "px-4 py-3 border-2 shadow-sm text-[0.95rem]",
          msg.direction === 'inbound' 
            ? "bg-white border-[#E5E5E5] text-[#1A1A1A] rounded-tr-xl rounded-br-xl rounded-bl-xl" 
            : "bg-[#1A1A1A] border-[#1A1A1A] text-white rounded-tl-xl rounded-tr-xl rounded-bl-xl"
        )}>
          {msg.content || '(Unsupported message type)'}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-[#666666] font-medium">{formatTime(msg.created_at)}</span>
          {msg.sender === 'agent' && <User size={12} className="text-[#C1440E]" />}
          {msg.sender === 'bot' && <Bot size={12} className="text-blue-600" />}
        </div>
      </div>
    ));
  }, [messages, formatTime]);

  return (
    <div className="flex h-[calc(100vh-4rem)] border-2 border-[#E5E5E5] bg-white overflow-hidden">
      {/* List Pane */}
      <div className="w-1/3 border-r-2 border-[#E5E5E5] flex flex-col bg-white">
        <div className="p-4 border-b-2 border-[#E5E5E5] bg-[#F5F5F0]">
          <h2 className="text-xl font-display font-bold text-[#1A1A1A] mb-4">Inbox</h2>
          
          <div className="flex gap-2 mb-4">
            <button 
              className={cn("px-3 py-1.5 text-sm font-medium border-2 transition-colors", filter === 'all' ? "bg-[#1A1A1A] text-white border-[#1A1A1A]" : "bg-white text-[#666666] border-[#E5E5E5] hover:border-[#1A1A1A]")} 
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button 
              className={cn("px-3 py-1.5 text-sm font-medium border-2 transition-colors", filter === 'handover_pending' ? "bg-[#C1440E] text-white border-[#C1440E]" : "bg-white text-[#666666] border-[#E5E5E5] hover:border-[#C1440E]")} 
              onClick={() => setFilter('handover_pending')}
            >
              Handover
            </button>
            <button 
              className={cn("px-3 py-1.5 text-sm font-medium border-2 transition-colors", filter === 'resolved' ? "bg-green-700 text-white border-green-700" : "bg-white text-[#666666] border-[#E5E5E5] hover:border-green-700")} 
              onClick={() => setFilter('resolved')}
            >
              Resolved
            </button>
          </div>
          
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]" />
            <input 
              type="text" 
              placeholder="Search conversations..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border-2 border-[#E5E5E5] focus:border-[#1A1A1A] focus:outline-none transition-colors"
            />
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto">
          {memoizedConversations}
        </ul>
      </div>

      {/* Detail Pane */}
      <div className="w-2/3 flex flex-col bg-[#F5F5F0]">
        {selectedConv ? (
          <>
            <div className="p-6 bg-white border-b-2 border-[#E5E5E5] flex justify-between items-start shadow-sm z-10">
              <div>
                <h2 className="text-2xl font-display font-bold text-[#1A1A1A]">{selectedConv.customer_phone}</h2>
                <div className="font-mono text-sm text-[#666666] mt-1">ID: {selectedConv.id.substring(0, 8)}...</div>
              </div>
              <div className="flex gap-3">
                {selectedConv.status === 'handover_pending' ? (
                  <button className="px-4 py-2 bg-[#C1440E] text-white font-bold tracking-wide hover:bg-[#d65a24] transition-colors border-2 border-[#C1440E] flex items-center" onClick={handleClaim}>
                    <User size={18} className="mr-2" /> Claim & Reply
                  </button>
                ) : selectedConv.status === 'handover_active' ? (
                  <button className="px-4 py-2 bg-white text-[#1A1A1A] font-bold tracking-wide hover:bg-gray-50 transition-colors border-2 border-[#1A1A1A] flex items-center" onClick={handleReturnToBot}>
                    <Bot size={18} className="mr-2" /> Return to Bot
                  </button>
                ) : selectedConv.status === 'resolved' ? (
                  <button 
                    className="px-4 py-2 bg-white text-[#1A1A1A] font-bold tracking-wide hover:bg-gray-50 transition-colors border-2 border-[#1A1A1A]"
                    onClick={handleReturnToBot}
                  >
                    Reopen
                  </button>
                ) : null}
              </div>
            </div>
            
            <div className="px-6 py-3 bg-gray-100 border-b-2 border-[#E5E5E5] flex items-center">
              <span className="text-xs font-bold text-[#666666] tracking-wider uppercase">Audit Trail:</span>
              <span className="text-sm text-[#1A1A1A] font-medium ml-2 flex items-center">
                {selectedConv.handover_reason ? (
                  <><AlertCircle size={14} className="text-[#C1440E] mr-1" /> Trigger: {selectedConv.handover_reason}</>
                ) : 'Standard flow'}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {memoizedMessages}
            </div>

            <div className="p-6 bg-white border-t-2 border-[#E5E5E5]">
              <div className="flex flex-col gap-3">
                <textarea 
                  placeholder="Type a reply to send as human agent..." 
                  className="w-full p-3 border-2 border-[#E5E5E5] focus:border-[#1A1A1A] focus:outline-none resize-none h-24 transition-colors disabled:bg-gray-100 disabled:text-gray-400"
                  disabled={selectedConv.status === 'resolved' || selectedConv.status === 'handover_pending' || selectedConv.status === 'bot'}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                ></textarea>
                <div className="flex justify-between items-center">
                  <button 
                    className="px-4 py-2 font-medium text-[#666666] hover:text-[#1A1A1A] transition-colors flex items-center" 
                    onClick={() => setShowTemplateModal(true)}
                  >
                    <Send size={16} className="mr-2" /> Use Template
                  </button>
                  <button 
                    className="px-6 py-2 bg-[#1A1A1A] text-white font-bold hover:bg-black disabled:opacity-50 transition-colors border-2 border-[#1A1A1A] flex items-center" 
                    disabled={selectedConv.status === 'resolved' || selectedConv.status === 'handover_pending' || selectedConv.status === 'bot'}
                    onClick={handleSendReply}
                  >
                    Send Reply
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 bg-white border-2 border-[#E5E5E5] rounded-full flex items-center justify-center mb-4">
              <MessageSquare size={32} className="text-[#666666]" />
            </div>
            <h3 className="text-2xl font-display font-bold text-[#1A1A1A] mb-2">Select a conversation</h3>
            <p className="text-[#666666] max-w-sm">Choose from the list on the left to view customer history, bot interactions, or to step in and reply manually.</p>
          </div>
        )}
      </div>

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white border-2 border-[#1A1A1A] p-6 w-[500px] shadow-[8px_8px_0px_0px_rgba(26,26,26,1)]">
            <div className="flex justify-between items-center mb-6 border-b-2 border-[#E5E5E5] pb-4">
              <h2 className="text-xl font-display font-bold text-[#1A1A1A]">Send Template</h2>
              <button onClick={() => { setShowTemplateModal(false); setSelectedTemplate(null); setTemplateParams([]); }} className="text-[#666666] hover:text-[#1A1A1A]">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSendTemplate} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#1A1A1A] mb-1">Select Template</label>
                <select 
                  className="w-full p-2 border-2 border-[#E5E5E5] focus:border-[#1A1A1A] focus:outline-none transition-colors"
                  onChange={(e) => {
                    const t = templates.find(t => t.id === e.target.value);
                    setSelectedTemplate(t);
                    if (t) {
                      const paramMatches = t.body.match(/\{\{(\d+)\}\}/g);
                      const paramCount = paramMatches ? new Set(paramMatches).size : 0;
                      setTemplateParams(new Array(paramCount).fill(''));
                    } else {
                      setTemplateParams([]);
                    }
                  }}
                  value={selectedTemplate?.id || ''}
                >
                  <option value="">-- Choose a template --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {templates.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">No approved templates found. Create one in the Template Manager.</p>
                )}
              </div>

              {selectedTemplate && (
                <>
                  <div className="p-3 bg-gray-50 border border-gray-200 text-sm font-mono whitespace-pre-wrap">
                    {selectedTemplate.body}
                  </div>
                  
                  {templateParams.map((param, index) => (
                    <div key={index}>
                      <label className="block text-sm font-bold text-[#1A1A1A] mb-1">Variable {'{{'}{index + 1}{'}}'}</label>
                      <input 
                        type="text" 
                        required
                        value={param}
                        onChange={(e) => {
                          const newParams = [...templateParams];
                          newParams[index] = e.target.value;
                          setTemplateParams(newParams);
                        }}
                        className="w-full p-2 border-2 border-[#E5E5E5] focus:border-[#1A1A1A] focus:outline-none transition-colors"
                      />
                    </div>
                  ))}
                  
                  <button 
                    type="submit" 
                    disabled={sendingTemplate}
                    className="w-full bg-[#1A1A1A] text-white font-bold py-3 hover:bg-[#C1440E] transition-colors border-2 border-transparent disabled:opacity-50 mt-4"
                  >
                    {sendingTemplate ? 'Sending...' : 'Send Template'}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inbox;
