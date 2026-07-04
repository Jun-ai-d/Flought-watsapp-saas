import React, { useState, useEffect } from 'react';
import { Search, MessageSquare, AlertCircle, Bot, User } from 'lucide-react';
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
  
  const [conversations, setConversations] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');

  // 1. Initial Fetch: Conversations List
  useEffect(() => {
    if (!tenant) return;
    
    const fetchConversations = async () => {
      setLoading(true);
      let query = supabase
        .from('conversations')
        .select('*')
        .order('last_message_at', { ascending: false });
        
      if (filter !== 'all') {
        query = query.eq('status', filter);
      }
      
      const { data, error } = await query;
      if (!error && data) {
        setConversations(data);
      }
      setLoading(false);
    };
    
    fetchConversations();
  }, [tenant, filter]);

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
  // This channel listens for ANY inserts or updates on the 'conversations' table.
  // It instantly updates the List Pane when a customer triggers a handover or sends a new message.
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
          // If the conversation already exists in state, update it.
          const exists = prev.find(c => c.id === payload.new.id);
          if (exists) {
            return prev.map(c => c.id === payload.new.id ? payload.new : c);
          }
          // Otherwise, add it to the top of the list.
          return [payload.new, ...prev];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant]);

  // 4. Supabase Realtime Subscription: Messages
  // This channel specifically listens for new messages inserted into the currently active conversation.
  // It drives the "live chat" experience in the Detail Pane.
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
          // Prevent duplicates if we optimistically rendered the message
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

  const handleClaim = async () => {
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
  };

  const handleReturnToBot = async () => {
    if (!selectedId) return;
    const { error } = await supabase
      .from('conversations')
      .update({ status: 'bot' })
      .eq('id', selectedId);
      
    if (!error) {
      setConversations(conversations.map(c => c.id === selectedId ? { ...c, status: 'bot' } : c));
      setSelectedId(null);
    }
  };

  const handleSendReply = async () => {
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
      setMessages([...messages, { 
        id: Date.now().toString(), 
        direction: 'outbound', 
        message_type: 'text',
        content: replyText,
        sender: 'agent',
        created_at: new Date().toISOString()
      }]);
    } catch (error) {
      console.error('Error sending message via API:', error);
      alert('Failed to send message. Is the backend server running?');
    }
  };

  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

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
              className="w-full pl-9 pr-4 py-2 border-2 border-[#E5E5E5] focus:border-[#1A1A1A] focus:outline-none transition-colors"
            />
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto">
          {loading ? (
             <div className="p-8 text-center text-[#666666] font-medium">Loading...</div>
          ) : conversations.length === 0 ? (
             <div className="p-8 text-center text-[#666666] font-medium">No conversations found.</div>
          ) : conversations.map(conv => (
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
          ))}
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
                  <button className="px-4 py-2 bg-white text-[#1A1A1A] font-bold tracking-wide hover:bg-gray-50 transition-colors border-2 border-[#1A1A1A]">Reopen</button>
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
              {messages.length === 0 ? (
                 <div className="text-center text-[#666666] font-medium mt-8">No messages loaded.</div>
              ) : messages.map(msg => (
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
              ))}
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
                    className="px-4 py-2 font-medium text-[#666666] hover:text-[#1A1A1A] disabled:opacity-50 transition-colors" 
                    disabled={selectedConv.status === 'resolved' || selectedConv.status === 'handover_pending' || selectedConv.status === 'bot'}
                  >
                    Use Template
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
    </div>
  );
};

export default Inbox;
