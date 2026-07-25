import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Bot } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

interface WebChatWidgetProps {
  forcePreview?: boolean;
  widgetToken?: string;
}

export const WebChatWidget: React.FC<WebChatWidgetProps> = ({
  forcePreview = false,
  widgetToken: widgetTokenProp,
}) => {
  const { tenant } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ id: string; text: string; isBot: boolean }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [resolvedToken, setResolvedToken] = useState<string | null>(widgetTokenProp ?? null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [sessionId] = useState(() => {
    const existing = localStorage.getItem('widget_session_id');
    if (existing) return existing;
    const newSession = `widget_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('widget_session_id', newSession);
    return newSession;
  });

  useEffect(() => {
    if (widgetTokenProp) {
      setResolvedToken(widgetTokenProp);
      return;
    }
    if (!tenant?.id) return;

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('widget_tokens')
        .select('token')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .maybeSingle();
      if (!cancelled) {
        setResolvedToken((data as { token: string } | null)?.token ?? null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tenant?.id, widgetTokenProp]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: '1',
          text: `Hi! I'm the AI assistant for ${tenant?.business_name || 'this business'}. How can I help you today?`,
          isBot: true,
        },
      ]);
    }
  }, [isOpen, tenant, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !resolvedToken) return;

    const userText = input.trim();
    setInput('');

    const userMsgId = Date.now().toString();
    setMessages((prev) => [...prev, { id: userMsgId, text: userText, isBot: false }]);
    setLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/widget/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widget_token: resolvedToken,
          sessionId,
          text: userText,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            text: data.reply || data.error || 'Failed to send message.',
            isBot: true,
          },
        ]);
        setLoading(false);
      } else if (data.reply) {
        setMessages((prev) => [
          ...prev,
          { id: data.replyId || Date.now().toString(), text: data.reply, isBot: true },
        ]);
        setLoading(false);
      } else {
        pollForReply();
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), text: 'Network error.', isBot: true },
      ]);
      setLoading(false);
    }
  };

  const pollForReply = async () => {
    if (!resolvedToken) {
      setLoading(false);
      return;
    }

    let retries = 0;
    const pollStartedAt = new Date().toISOString();
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

    const interval = setInterval(async () => {
      retries++;
      if (retries > 10) {
        clearInterval(interval);
        setLoading(false);
        return;
      }

      try {
        const params = new URLSearchParams({
          widget_token: resolvedToken,
          sessionId,
          after: pollStartedAt,
        });
        const res = await fetch(`${apiUrl}/api/widget/poll?${params.toString()}`);
        const data = await res.json();

        if (data.reply && data.replyId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.replyId)) {
              return prev;
            }
            clearInterval(interval);
            setLoading(false);
            return [...prev, { id: data.replyId, text: data.reply, isBot: true }];
          });
        }
      } catch {
        // keep polling until retry limit
      }
    }, 2000);
  };

  if (tenant?.plan_type !== 'trial' && !forcePreview) {
    return null;
  }

  const positionClass = forcePreview ? 'absolute' : 'fixed';

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          `${positionClass} bottom-6 right-6 w-14 h-14 bg-brand-accent text-white rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 z-50`,
          isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
        )}
      >
        <MessageSquare size={24} />
      </button>

      <div
        className={cn(
          `${positionClass} bottom-6 right-6 w-[350px] max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-3rem)] bg-theme-surface rounded-2xl shadow-2xl border border-theme-border flex flex-col z-50 transition-all origin-bottom-right`,
          isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-theme-border bg-brand-accent text-white rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Bot size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm">AI Assistant</h3>
              <p className="text-[10px] text-white/80">
                {resolvedToken ? 'Test your chatbot' : 'Rotate/create a widget token first'}
              </p>
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
            <div key={i} className={cn('flex', msg.isBot ? 'justify-start' : 'justify-end')}>
              <div
                className={cn(
                  'max-w-[80%] p-3 rounded-2xl text-sm',
                  msg.isBot
                    ? 'bg-theme-surface border border-theme-border text-theme-text rounded-tl-sm'
                    : 'bg-brand-accent text-white rounded-tr-sm'
                )}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] p-3 rounded-2xl bg-theme-surface border border-theme-border text-theme-text-muted rounded-tl-sm flex items-center gap-1">
                <div
                  className="w-1.5 h-1.5 bg-theme-text-muted rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <div
                  className="w-1.5 h-1.5 bg-theme-text-muted rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <div
                  className="w-1.5 h-1.5 bg-theme-text-muted rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
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
              placeholder={resolvedToken ? 'Type your message...' : 'No widget token yet'}
              disabled={!resolvedToken}
              className="flex-1 bg-theme-bg border border-theme-border rounded-full px-4 py-2 text-sm focus:outline-none focus:border-brand-accent transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading || !resolvedToken}
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
