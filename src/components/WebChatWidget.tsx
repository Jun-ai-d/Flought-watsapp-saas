import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Bot, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

export const WebChatWidget: React.FC = () => {
  const { tenant } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ id: string, text: string, isBot: boolean }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Generate a random session ID for this browser if none exists
  const [sessionId] = useState(() => {
    const existing = localStorage.getItem('widget_session_id');
    if (existing) return existing;
    const newSession = `widget_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('widget_session_id', newSession);
    return newSession;
  });

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        { id: '1', text: `Hi! I'm the AI assistant for ${tenant?.business_name || 'this business'}. How can I help you today?`, isBot: true }
      ]);
    }
  }, [isOpen, tenant, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !tenant) return;

    const userText = input.trim();
    setInput('');
    
    // Add user message to UI immediately
    const userMsgId = Date.now().toString();
    setMessages(prev => [...prev, { id: userMsgId, text: userText, isBot: false }]);
    setLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/widget/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          sessionId,
          text: userText
        })
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        setMessages(prev => [...prev, { 
          id: Date.now().toString(), 
          text: data.reply || data.error || 'Failed to send message.', 
          isBot: true 
        }]);
        setLoading(false);
      } else {
        pollForReply();
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now().toString(), text: 'Network error.', isBot: true }]);
      setLoading(false);
    }
  };

  const pollForReply = async () => {
    let retries = 0;
    const interval = setInterval(async () => {
      retries++;
      if (retries > 10) {
        clearInterval(interval);
        setLoading(false);
        return;
      }
      
      const { supabase } = await import('../lib/supabase');
      const { data } = await supabase
        .from('messages')
        .select('content, id')
        .eq('tenant_id', tenant!.id)
        .eq('direction', 'outbound')
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const latestMsg = data[0] as any;
        setMessages(prev => {
          if (prev.some(m => m.id === latestMsg.id)) {
            return prev;
          } else {
            clearInterval(interval);
            setLoading(false);
            return [...prev, { id: latestMsg.id, text: latestMsg.content, isBot: true }];
          }
        });
      }
    }, 2000);
  };

  if (tenant?.plan_type !== 'trial') {
    return null; // Only show for trial users
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 w-14 h-14 bg-brand-accent text-white rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 z-50",
          isOpen ? "scale-0 opacity-0" : "scale-100 opacity-100"
        )}
      >
        <MessageSquare size={24} />
      </button>

      <div 
        className={cn(
          "fixed bottom-6 right-6 w-[350px] max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-3rem)] bg-theme-surface rounded-2xl shadow-2xl border border-theme-border flex flex-col z-50 transition-all origin-bottom-right",
          isOpen ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-theme-border bg-brand-accent text-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Bot size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm">AI Assistant</h3>
              <p className="text-[10px] text-white/80">Test your chatbot</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="text-white/80 hover:text-white p-1"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-theme-bg">
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex", msg.isBot ? "justify-start" : "justify-end")}>
              <div 
                className={cn(
                  "max-w-[80%] p-3 rounded-2xl text-sm",
                  msg.isBot 
                    ? "bg-theme-surface border border-theme-border text-theme-text rounded-tl-sm"
                    : "bg-brand-accent text-white rounded-tr-sm"
                )}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] p-3 rounded-2xl bg-theme-surface border border-theme-border text-theme-text-muted rounded-tl-sm flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-theme-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-theme-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-theme-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 bg-theme-surface border-t border-theme-border rounded-b-2xl">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-theme-bg border border-theme-border rounded-full px-4 py-2 text-sm focus:outline-none focus:border-brand-accent transition-colors"
            />
            <button 
              type="submit"
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-full bg-brand-accent text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-accent/90 transition-colors"
            >
              <Send size={16} className="ml-1" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
};
