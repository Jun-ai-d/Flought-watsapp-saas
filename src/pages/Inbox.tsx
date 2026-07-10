import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, MessageSquare, AlertCircle, Bot, User, Send, X, Check, ArrowLeft, ShoppingBag, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

/**
 * Inbox (Human Handover Interface)
 */
const Inbox: React.FC = () => {
  const queryClient = useQueryClient();
  const { tenant, session } = useAuth();
  
  // Local UI state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'handover_pending' | 'resolved'>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [replyText, setReplyText] = useState('');
  
  // Template state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [templateParams, setTemplateParams] = useState<string[]>([]);
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [sendingCatalog, setSendingCatalog] = useState(false);
  
  // Presence state
  const [viewingAgents, setViewingAgents] = useState<{ [convId: string]: string[] }>({});

  // 1. Queries
  const { data: conversations = [], isLoading: loading } = useQuery<any[]>({
    queryKey: ['conversations', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('last_message_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ['templates', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .eq('status', 'approved');
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  const { data: messages = [] } = useQuery<any[]>({
    queryKey: ['messages', selectedId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', selectedId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedId,
  });

  const { data: quickReplies = [] } = useQuery<any[]>({
    queryKey: ['quick_replies', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quick_replies')
        .select('*')
        .eq('tenant_id', tenant!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  // Realtime Subscription
  useEffect(() => {
    if (!tenant?.id) return;

    const channel = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `tenant_id=eq.${tenant.id}` },
        (payload) => {
          const newMessage = payload.new;
          
          // 1. Update the active chat log if this message belongs to the selected conversation
          queryClient.setQueryData(['messages', newMessage.conversation_id], (old: any[] = []) => {
            // Deduplicate (in case of optimistic UI temp IDs or weird network races)
            if (old.some(m => m.id === newMessage.id)) return old;
            return [...old, newMessage];
          });

          // 2. Bump the conversation in the sidebar list to the top and update snippet/timestamp
          queryClient.setQueryData(['conversations', tenant.id], (old: any[] = []) => {
            const convIndex = old.findIndex(c => c.id === newMessage.conversation_id);
            if (convIndex === -1) {
              // If it's a completely new conversation, we probably should invalidate to fetch it
              queryClient.invalidateQueries({ queryKey: ['conversations', tenant.id] });
              return old;
            }
            
            const updatedConv = {
              ...old[convIndex],
              last_message_at: newMessage.created_at,
              snippet: newMessage.content || (newMessage.message_type === 'audio' ? 'Voice note' : 'New message')
            };
            
            // Remove it from current position and put it at the top
            const newConvs = [...old];
            newConvs.splice(convIndex, 1);
            return [updatedConv, ...newConvs];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id, queryClient]);

  // 2. Mutations
  const claimMutation = useMutation<any, Error, string>({
    mutationFn: async (convId: string) => {
      const { data, error } = await (supabase
        .from('conversations') as any)
        .update({ 
          status: 'handover_active',
          assigned_agent_id: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', convId)
        .eq('status', 'handover_pending')
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('This conversation was already claimed by another agent or is no longer pending.');
      }
      return data[0];
    },
    onSuccess: (updatedConv) => {
      queryClient.setQueryData(['conversations', tenant?.id], (old: any[] = []) => 
        old.map(c => c.id === updatedConv.id ? updatedConv : c)
      );
    },
    onError: (err) => {
      alert(err.message);
      queryClient.invalidateQueries({ queryKey: ['conversations', tenant?.id] });
    }
  });

  const returnToBotMutation = useMutation<any, Error, string>({
    mutationFn: async (convId: string) => {
      const { data, error } = await (supabase
        .from('conversations') as any)
        .update({ status: 'bot' })
        .eq('id', convId)
        .select();
      if (error) throw error;
      return data[0];
    },
    onSuccess: (updatedConv) => {
      queryClient.setQueryData(['conversations', tenant?.id], (old: any[] = []) => 
        old.map(c => c.id === updatedConv.id ? updatedConv : c)
      );
      setSelectedId(null);
    }
  });

  const resolveMutation = useMutation<any, Error, string>({
    mutationFn: async (convId: string) => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/tenant/conversations/${convId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session!.access_token}`,
          'x-tenant-id': tenant!.id
        }
      });
      
      if (!res.ok) {
        throw new Error('Failed to resolve conversation');
      }
      
      return res.json();
    },
    onSuccess: (updatedConv) => {
      queryClient.setQueryData(['conversations', tenant?.id], (old: any[] = []) => 
        old.map(c => c.id === updatedConv.id ? updatedConv : c)
      );
      setSelectedId(null);
    }
  });

  const sendReplyMutation = useMutation({
    mutationFn: async ({ text, isInternal, expectedVersion }: { text: string, isInternal: boolean, expectedVersion: number }) => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/outbound/send`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session!.access_token}`
        },
        body: JSON.stringify({
          tenantId: tenant!.id,
          conversationId: selectedId,
          text,
          isInternal,
          expectedVersion
        })
      });
      if (res.status === 409) {
         throw new Error('Conflict: Conversation was modified by another agent or AI. Please refresh.');
      }
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    },
    onMutate: async ({ text, isInternal, expectedVersion }) => {
      await queryClient.cancelQueries({ queryKey: ['messages', selectedId] });
      const previousMessages = queryClient.getQueryData(['messages', selectedId]);
      
      const optimisticMsg = {
        id: `temp-${Date.now()}`,
        conversation_id: selectedId,
        direction: 'outbound',
        sender: 'agent',
        content: text,
        created_at: new Date().toISOString(),
        is_internal: isInternal,
      };
      
      queryClient.setQueryData(['messages', selectedId], (old: any[] = []) => [...old, optimisticMsg]);
      setReplyText('');
      return { previousMessages };
    },
    onError: (err, text, context: any) => {
      queryClient.setQueryData(['messages', selectedId], context?.previousMessages);
      alert('Failed to send message. Is the backend server running?');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['conversations', tenant?.id] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('conversations').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: (data, ids) => {
      queryClient.invalidateQueries({ queryKey: ['conversations', tenant?.id] });
      setSelectedIds([]);
      if (selectedId && ids.includes(selectedId)) {
        setSelectedId(null);
      }
    },
    onError: (err: any) => {
      alert('Failed to delete conversations: ' + err.message);
    }
  });

  const handleDeleteSelected = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} conversation(s)? This will also delete all associated messages permanently.`)) {
      deleteMutation.mutate(selectedIds);
    }
  };

  const toggleRow = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter(selectedId => selectedId !== id);
      }
      return [...prev, id];
    });
  }, []);

  const sendTemplateMutation = useMutation({
    mutationFn: async () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      let finalText = selectedTemplate.body;
      templateParams.forEach((param, i) => {
        finalText = finalText.replace(`{{${i+1}}}`, param);
      });
      
      const res = await fetch(`${apiUrl}/api/outbound/send-template`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session!.access_token}`
        },
        body: JSON.stringify({
          tenantId: tenant!.id,
          conversationId: selectedId,
          templateId: selectedTemplate.id,
          templateParams: templateParams,
          providerName: 'meta'
        })
      });
      if (!res.ok) throw new Error('Failed to send template');
      return res.json();
    },
    onSuccess: () => {
      setShowTemplateModal(false);
      setSelectedTemplate(null);
      setTemplateParams([]);
      queryClient.invalidateQueries({ queryKey: ['messages', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['conversations', tenant?.id] });
    },
    onError: () => {
      alert('Failed to send template.');
    }
  });

  const handleSendCatalog = async () => {
    if (!selectedId) return;
    setSendingCatalog(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/outbound/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'x-tenant-id': tenant?.id || ''
        },
        body: JSON.stringify({
          tenantId: tenant?.id,
          conversationId: selectedId,
          text: 'catalog',
          messageType: 'catalog',
          isInternal: false
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to send catalog');
      }
      alert('Catalog sent successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to send catalog');
    } finally {
      setSendingCatalog(false);
    }
  };

  const handleSendTemplate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !selectedTemplate || !tenant || !session) return;
    setSendingTemplate(true);
    await sendTemplateMutation.mutateAsync();
    setSendingTemplate(false);
  }, [selectedId, selectedTemplate, tenant, session, sendTemplateMutation]);

  const handleClaim = useCallback(() => {
    if (selectedId) claimMutation.mutate(selectedId);
  }, [selectedId, claimMutation]);

  const handleReturnToBot = useCallback(() => {
    if (selectedId) returnToBotMutation.mutate(selectedId);
  }, [selectedId, returnToBotMutation]);

  const handleResolve = useCallback(() => {
    if (selectedId) resolveMutation.mutate(selectedId);
  }, [selectedId, resolveMutation]);

  const selectedConv = conversations.find((c: any) => c.id === selectedId);

  const [isInternal, setIsInternal] = useState(false);

  const lastCustomerMessage = messages.slice().reverse().find(m => m.direction === 'inbound');
  const hoursSinceLastCustomerMessage = lastCustomerMessage 
    ? (Date.now() - new Date(lastCustomerMessage.created_at).getTime()) / (1000 * 60 * 60)
    : 0;
  const isOutside24hWindow = hoursSinceLastCustomerMessage > 24;

  const handleSendReply = useCallback(() => {
    if (selectedId && replyText.trim() && selectedConv) {
      sendReplyMutation.mutate({ text: replyText, isInternal, expectedVersion: selectedConv.version || 0 });
    }
  }, [selectedId, replyText, isInternal, sendReplyMutation, selectedConv]);

  // 3. Supabase Realtime Subscriptions & Presence
  useEffect(() => {
    if (!tenant || !session?.user) return;
    
    // Subscribe to presence
    const presenceChannel = supabase.channel(`inbox_presence_${tenant.id}`);
    
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const viewers: { [convId: string]: string[] } = {};
        
        for (const [presenceId, presences] of Object.entries(state)) {
          presences.forEach((p: any) => {
            if (p.conversation_id && p.email !== session.user.email) {
              if (!viewers[p.conversation_id]) viewers[p.conversation_id] = [];
              if (!viewers[p.conversation_id].includes(p.email)) {
                viewers[p.conversation_id].push(p.email);
              }
            }
          });
        }
        setViewingAgents(viewers);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && selectedId) {
          await presenceChannel.track({
            user_id: session.user.id,
            email: session.user.email,
            conversation_id: selectedId,
          });
        }
      });
      
    // Update presence when selected conversation changes
    const updatePresence = async () => {
      if (presenceChannel.state === 'joined') {
        if (selectedId) {
          await presenceChannel.track({
            user_id: session.user.id,
            email: session.user.email,
            conversation_id: selectedId,
          });
        } else {
          await presenceChannel.untrack();
        }
      }
    };
    updatePresence();

    const convChannel = supabase.channel('inbox-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'conversations', 
        filter: `tenant_id=eq.${tenant.id}` 
      }, (payload) => {
        queryClient.setQueryData(['conversations', tenant.id], (old: any[] = []) => {
          const newRecord = payload.new as any;
          const exists = old.find(c => c.id === newRecord.id);
          if (exists) return old.map(c => c.id === newRecord.id ? newRecord : c);
          return [newRecord, ...old];
        });
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(presenceChannel); 
      supabase.removeChannel(convChannel); 
    };
  }, [tenant, selectedId, session?.user, queryClient]);

  useEffect(() => {
    if (!selectedId || !tenant) return;
    const msgChannel = supabase.channel(`messages-${selectedId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages', 
        filter: `conversation_id=eq.${selectedId}` 
      }, (payload) => {
        queryClient.setQueryData(['messages', selectedId], (old: any[] = []) => {
          const newMsg = payload.new as any;
          if (old.find(m => m.id === newMsg.id)) return old;
          return [...old, newMsg];
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(msgChannel); };
  }, [selectedId, tenant, queryClient]);

  const formatTime = useCallback((ts: string) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  const memoizedConversations = useMemo(() => {
    if (loading) {
      return <div className="p-8 text-center text-theme-text-muted font-medium">Loading...</div>;
    }
    if (conversations.length === 0) {
      return (
        <div className="p-12 text-center flex flex-col items-center">
          <div className="text-4xl mb-4">☕</div>
          <h3 className="font-bold text-theme-text mb-1">Inbox Zero!</h3>
          <p className="text-sm text-theme-text-muted">Your AI handled everything. Time to take a breather.</p>
        </div>
      );
    }
    
    let filtered = conversations;
    
    if (filter !== 'all') {
      filtered = filtered.filter(c => c.status === filter);
    }
    
    if (deptFilter !== 'all') {
      filtered = filtered.filter(c => c.department === deptFilter);
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        (c.customer_name && c.customer_name.toLowerCase().includes(lower)) ||
        (c.customer_phone && c.customer_phone.includes(lower))
      );
    }
    
    if (filtered.length === 0) {
      return <div className="p-8 text-center text-theme-text-muted font-medium">No matches found for "{searchTerm}".</div>;
    }

    return filtered.map(conv => (
      <li 
        key={conv.id} 
        className={cn(
          "p-4 border-b border-theme-border cursor-pointer hover:bg-theme-surface-hover transition-colors flex gap-3",
          selectedId === conv.id ? "bg-brand-accent/5 border-l-4 border-l-brand-accent" : "border-l-4 border-l-transparent",
          selectedIds.includes(conv.id) && "bg-brand-accent/10"
        )}
        onClick={() => setSelectedId(conv.id)}
      >
        <div className="mt-1 shrink-0">
          <input 
            type="checkbox" 
            className="w-4 h-4 rounded border-theme-border text-brand-accent focus:ring-brand-accent theme-button cursor-pointer"
            checked={selectedIds.includes(conv.id)}
            onChange={(e) => toggleRow(conv.id, e as any)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-2">
            <span className="font-mono text-sm text-theme-text-muted">{conv.customer_phone}</span>
            <span className="text-xs text-theme-text-muted font-medium shrink-0 ml-2">{formatTime(conv.last_message_at)}</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <div className="font-bold text-theme-text">{conv.customer_name || 'Customer'}</div>
            <div className="flex gap-1">
            {conv.department && conv.department !== 'general' && (
              <div className="px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider bg-theme-bg text-theme-text-muted border border-theme-border theme-button">
                {conv.department}
              </div>
            )}
            <div className={cn(
              "px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider theme-button",
              conv.status === 'bot' ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" :
              conv.status === 'handover_pending' ? "bg-brand-accent/10 text-brand-accent border border-brand-accent/20" :
              conv.status === 'handover_active' ? "bg-purple-500/10 text-purple-500 border border-purple-500/20" :
              "bg-green-500/10 text-green-500 border border-green-500/20"
            )}>
              {conv.status.replace('_', ' ')}
            </div>
            {viewingAgents[conv.id] && viewingAgents[conv.id].length > 0 && (
              <div className="w-5 h-5 rounded-full bg-brand-accent text-white flex items-center justify-center text-[10px] font-bold border border-theme-bg" title={`${viewingAgents[conv.id].join(', ')} is viewing`}>
                {viewingAgents[conv.id].length}
              </div>
            )}
          </div>
        </div>
        </div>
      </li>
    ));
  }, [loading, conversations, selectedId, filter, deptFilter, searchTerm, formatTime, viewingAgents, selectedIds, toggleRow]);

  const memoizedMessages = useMemo(() => {
    if (messages.length === 0) {
      return <div className="text-center text-theme-text-muted font-medium mt-8">No messages loaded.</div>;
    }
    return messages.map(msg => (
      <div key={msg.id} className={cn("flex flex-col max-w-[75%]", msg.direction === 'inbound' ? "self-start items-start" : "self-end items-end ml-auto")}>
        <div className={cn(
          "px-3 py-2 md:px-4 md:py-3 shadow-sm text-[15px] leading-snug md:text-[0.95rem] border",
          msg.direction === 'inbound' 
            ? "bg-theme-surface border-theme-border text-theme-text rounded-tr-xl rounded-br-xl rounded-bl-xl" 
            : msg.is_internal
              ? "bg-yellow-500/20 border-yellow-500/40 text-theme-text rounded-tl-xl rounded-tr-xl rounded-bl-xl"
              : "bg-brand-accent border-brand-accent text-white rounded-tl-xl rounded-tr-xl rounded-bl-xl"
        )}>
          {msg.is_internal && <div className="text-[10px] font-bold text-yellow-600 uppercase tracking-wider mb-1 flex items-center gap-1"><AlertCircle size={10} /> Internal Note</div>}
          {msg.content || '(Unsupported message type)'}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-theme-text-muted font-medium">{formatTime(msg.created_at)}</span>
          {msg.sender === 'agent' && <User size={12} className="text-brand-accent" />}
          {msg.sender === 'bot' && <Bot size={12} className="text-blue-500" />}
        </div>
      </div>
    ));
  }, [messages, formatTime]);

  return (
    <div className="flex h-full bg-theme-surface md:bg-transparent overflow-hidden md:theme-card">
      {/* List Pane */}
      <div className={cn(
        "border-r border-theme-border flex-col bg-theme-surface transition-all duration-300",
        selectedId ? "hidden md:flex md:w-1/3" : "flex w-full md:w-1/3"
      )}>
        <div className="p-4 border-b border-theme-border bg-theme-bg shrink-0">
          <h2 className="text-xl font-display font-bold text-theme-text mb-4">Inbox</h2>
          
          <div className="flex gap-2 mb-4">
            <button 
              className={cn("px-3 py-1.5 text-sm font-medium border transition-colors theme-button", filter === 'all' ? "bg-theme-text text-theme-bg border-theme-text" : "bg-theme-surface text-theme-text-muted border-theme-border hover:border-theme-text-muted")} 
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button 
              className={cn("px-3 py-1.5 text-sm font-medium border transition-colors theme-button", filter === 'handover_pending' ? "bg-brand-accent text-white border-brand-accent" : "bg-theme-surface text-theme-text-muted border-theme-border hover:border-brand-accent hover:text-brand-accent")} 
              onClick={() => setFilter('handover_pending')}
            >
              Handover
            </button>
            <button 
              className={cn("px-3 py-1.5 text-sm font-medium border transition-colors theme-button", filter === 'resolved' ? "bg-green-600 text-white border-green-600" : "bg-theme-surface text-theme-text-muted border-theme-border hover:border-green-600 hover:text-green-600")} 
              onClick={() => setFilter('resolved')}
            >
              Resolved
            </button>
          </div>
          
          <div className="relative mb-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted" />
            <input 
              type="text" 
              placeholder="Search conversations..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-theme-border bg-theme-surface text-theme-text focus:border-brand-accent focus:outline-none transition-colors theme-button"
            />
          </div>
          
          <select 
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="w-full p-2 border border-theme-border bg-theme-surface text-theme-text text-sm font-bold focus:outline-none focus:border-brand-accent theme-button"
          >
            <option value="all">All Departments</option>
            <option value="sales">Sales</option>
            <option value="support">Support</option>
            <option value="billing">Billing</option>
            <option value="general">General</option>
          </select>
        </div>

        {selectedIds.length > 0 && (
          <div className="bg-brand-accent/10 border-y border-brand-accent p-3 flex justify-between items-center shrink-0">
            <span className="text-sm font-bold text-brand-accent">
              {selectedIds.length} selected
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => setSelectedIds([])} 
                className="px-2 py-1 text-xs border border-brand-accent text-brand-accent hover:bg-brand-accent/10 theme-button font-bold"
              >
                Clear
              </button>
              <button 
                onClick={handleDeleteSelected} 
                disabled={deleteMutation.isPending}
                className="px-2 py-1 text-xs bg-red-500 text-white font-bold hover:bg-red-600 theme-button flex items-center gap-1"
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        )}
        <ul className="flex-1 overflow-y-auto bg-theme-surface">
          {memoizedConversations}
        </ul>
      </div>

      {/* Detail Pane */}
      <div className={cn(
        "flex-col bg-theme-bg transition-all duration-300",
        !selectedId ? "hidden md:flex md:w-2/3" : "flex w-full md:w-2/3"
      )}>
        {selectedConv ? (
          <>
            <div className="p-3 md:p-6 bg-theme-surface border-b border-theme-border flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4 shadow-sm z-10 shrink-0">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSelectedId(null)}
                  className="md:hidden p-2 -ml-2 rounded-lg text-theme-text hover:bg-theme-bg transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h2 className="text-base md:text-2xl font-display font-bold text-theme-text truncate max-w-[160px] md:max-w-none">{selectedConv.customer_phone}</h2>
                  <div className="font-mono text-[10px] md:text-sm text-theme-text-muted mt-1 truncate">ID: {selectedConv.id.substring(0, 8)}...</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                {selectedConv.status === 'handover_pending' ? (
                  <button className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base bg-brand-accent text-white font-bold tracking-wide hover:bg-brand-accent-light transition-colors border border-brand-accent flex items-center theme-button shadow-sm w-full md:w-auto justify-center" onClick={handleClaim}>
                    <User size={16} className="mr-1 md:mr-2" /> Claim & Reply
                  </button>
                ) : selectedConv.status === 'handover_active' ? (
                  <>
                    <button className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base bg-green-500 text-white font-bold tracking-wide hover:bg-green-600 transition-colors border border-green-600 flex items-center theme-button shadow-sm w-full md:w-auto justify-center" onClick={handleResolve}>
                      <Check size={16} className="mr-1 md:mr-2" /> Resolve
                    </button>
                    <button className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base bg-theme-surface text-theme-text font-bold tracking-wide hover:bg-theme-surface-hover transition-colors border border-theme-border flex items-center theme-button shadow-sm" onClick={handleReturnToBot}>
                      <Bot size={16} className="mr-1 md:mr-2 text-blue-500" /> Return to Bot
                    </button>
                  </>
                ) : selectedConv.status === 'resolved' ? (
                  <button 
                    className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base bg-theme-surface text-theme-text font-bold tracking-wide hover:bg-theme-surface-hover transition-colors border border-theme-border theme-button shadow-sm"
                    onClick={handleReturnToBot}
                  >
                    Reopen
                  </button>
                ) : (
                  <button className="px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-base bg-theme-surface text-theme-text font-bold tracking-wide hover:bg-theme-surface-hover transition-colors border border-theme-border flex items-center theme-button shadow-sm w-full md:w-auto justify-center" onClick={handleResolve}>
                    <Check size={16} className="mr-1 md:mr-2 text-green-500" /> Mark Resolved
                  </button>
                )}
              </div>
            </div>
            
            {viewingAgents[selectedConv.id] && viewingAgents[selectedConv.id].length > 0 && (
              <div className="bg-brand-accent/10 border-b border-brand-accent/20 px-6 py-2 flex items-center gap-2">
                <div className="flex -space-x-2">
                  {viewingAgents[selectedConv.id].map(email => (
                    <div key={email} className="w-6 h-6 rounded-full bg-brand-accent text-white flex items-center justify-center text-xs font-bold border-2 border-theme-bg" title={email}>
                      {email.charAt(0).toUpperCase()}
                    </div>
                  ))}
                </div>
                <span className="text-sm font-medium text-brand-accent">
                  {viewingAgents[selectedConv.id].length === 1 
                    ? `${viewingAgents[selectedConv.id][0]} is also viewing this chat`
                    : `${viewingAgents[selectedConv.id].length} other agents are viewing this chat`}
                </span>
              </div>
            )}
            
            <div className="px-6 py-4 bg-theme-surface-hover border-b border-theme-border flex flex-col gap-2">
              <div className="flex items-center">
                <span className="text-xs font-bold text-theme-text-muted tracking-wider uppercase">Audit Trail:</span>
                <span className="text-sm text-theme-text font-medium ml-2 flex items-center">
                  {selectedConv.handover_reason ? (
                    <><AlertCircle size={14} className="text-brand-accent mr-1" /> Trigger: {selectedConv.handover_reason.replace(/_/g, ' ')}</>
                  ) : 'Standard flow'}
                </span>
              </div>
              {selectedConv.handover_summary && (
                <div className="mt-1 p-4 bg-brand-accent/5 border-l-4 border-brand-accent theme-button rounded-r-md">
                  <span className="block text-xs font-bold text-brand-accent uppercase tracking-wider mb-1">AI Handover Summary</span>
                  <p className="text-sm text-theme-text font-medium leading-relaxed">{selectedConv.handover_summary}</p>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {memoizedMessages}
            </div>

            <div className="p-3 md:p-6 bg-theme-surface border-t border-theme-border">
              <div className="flex flex-col gap-2 md:gap-3">
                <textarea 
                  placeholder={isInternal ? "Type an internal note (customers won't see this)..." : "Type a reply..."} 
                  className={cn(
                    "w-full p-2 text-[13px] md:p-3 md:text-base border bg-theme-bg text-theme-text focus:outline-none resize-none h-12 md:h-24 transition-colors disabled:opacity-50 theme-button",
                    isInternal ? "bg-yellow-500/10 border-yellow-500/50 focus:border-yellow-500 placeholder:text-yellow-500/50" : "border-theme-border focus:border-brand-accent"
                  )}
                  disabled={selectedConv.status === 'resolved' || selectedConv.status === 'handover_pending' || selectedConv.status === 'bot' || (!isInternal && isOutside24hWindow)}
                  value={replyText}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (val.endsWith(' ')) {
                      const words = val.split(' ');
                      const lastWord = words[words.length - 2];
                      if (lastWord.startsWith('/')) {
                        const match = quickReplies.find(qr => qr.shortcut === lastWord);
                        if (match) {
                          words[words.length - 2] = match.content;
                          val = words.join(' ');
                        }
                      }
                    }
                    setReplyText(val);
                  }}
                ></textarea>
                {!isInternal && isOutside24hWindow && (
                  <div className="text-xs text-red-500 font-medium px-1 flex items-center gap-1 mt-1">
                    <AlertCircle size={12} /> The 24-hour customer service window has closed. You must use a Template to message this customer.
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <button 
                      className="px-2 py-1 md:px-4 md:py-2 text-xs md:text-sm font-medium text-theme-text-muted hover:text-theme-text transition-colors flex items-center theme-button" 
                      onClick={() => setShowTemplateModal(true)}
                    >
                      <Send size={14} className="mr-1 md:mr-2" /> <span className="hidden md:inline">Use</span> Template
                    </button>
                    <button 
                      className="px-2 py-1 md:px-4 md:py-2 text-xs md:text-sm font-medium text-brand-accent hover:bg-brand-accent/5 transition-colors flex items-center theme-button border border-transparent" 
                      onClick={handleSendCatalog}
                      disabled={sendingCatalog || selectedConv.status === 'resolved' || selectedConv.status === 'bot'}
                    >
                      <ShoppingBag size={14} className="mr-1 md:mr-2" /> <span className="hidden md:inline">{sendingCatalog ? 'Sending...' : 'Send Catalog'}</span>
                    </button>
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-theme-text-muted hover:text-theme-text transition-colors">
                      <input 
                        type="checkbox" 
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="w-4 h-4 accent-yellow-500 cursor-pointer"
                        disabled={selectedConv.status === 'resolved' || selectedConv.status === 'handover_pending' || selectedConv.status === 'bot'}
                      />
                      Internal Note
                    </label>
                  </div>
                  <button 
                    className={cn(
                      "px-3 py-1.5 md:px-6 md:py-2 text-xs md:text-base text-white font-bold disabled:opacity-50 transition-colors flex items-center theme-button shadow-sm",
                      isInternal ? "bg-yellow-500 hover:bg-yellow-600" : "bg-brand-accent hover:bg-brand-accent-light"
                    )}
                    disabled={selectedConv.status === 'resolved' || selectedConv.status === 'handover_pending' || selectedConv.status === 'bot'}
                    onClick={handleSendReply}
                  >
                    {isInternal ? 'Save Note' : 'Send Reply'}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-theme-text/5 relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-brand-accent/10 blur-[80px] pointer-events-none"></div>
            <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[80px] pointer-events-none"></div>
            
            <div className="w-24 h-24 bg-theme-surface border border-theme-border rounded-full flex items-center justify-center mb-6 shadow-xl relative z-10">
              <MessageSquare size={40} className="text-brand-accent" />
            </div>
            <h3 className="text-3xl font-display font-bold text-theme-text mb-3 relative z-10">Welcome to your Inbox</h3>
            <p className="text-theme-text-muted max-w-md text-lg relative z-10 font-medium leading-relaxed">
              Select a conversation from the left to view the customer's history or step in manually.
            </p>
          </div>
        )}
      </div>

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="theme-card p-6 w-[500px]">
            <div className="flex justify-between items-center mb-6 border-b border-theme-border pb-4">
              <h2 className="text-xl font-display font-bold text-theme-text">Send Template</h2>
              <button onClick={() => { setShowTemplateModal(false); setSelectedTemplate(null); setTemplateParams([]); }} className="text-theme-text-muted hover:text-theme-text">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSendTemplate} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-theme-text mb-1">Select Template</label>
                <select 
                  className="w-full p-2 border border-theme-border bg-theme-surface text-theme-text focus:border-brand-accent focus:outline-none transition-colors theme-button"
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
                  <div className="p-3 bg-theme-bg border border-theme-border text-theme-text text-sm font-mono whitespace-pre-wrap theme-button">
                    {selectedTemplate.body}
                  </div>
                  
                  {templateParams.map((param, index) => (
                    <div key={index}>
                      <label className="block text-sm font-bold text-theme-text mb-1">Variable {'{{'}{index + 1}{'}}'}</label>
                      <input 
                        type="text" 
                        required
                        value={param}
                        onChange={(e) => {
                          const newParams = [...templateParams];
                          newParams[index] = e.target.value;
                          setTemplateParams(newParams);
                        }}
                        className="w-full p-2 border border-theme-border bg-theme-surface text-theme-text focus:border-brand-accent focus:outline-none transition-colors theme-button"
                      />
                    </div>
                  ))}
                  
                  <button 
                    type="submit" 
                    disabled={sendingTemplate}
                    className="w-full bg-brand-accent text-white font-bold py-3 hover:bg-brand-accent-light transition-colors theme-button disabled:opacity-50 mt-4 shadow-sm"
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
