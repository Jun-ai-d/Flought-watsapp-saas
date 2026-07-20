import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { RefreshCw, Code, Check, Globe } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { WebChatWidget } from '../components/WebChatWidget';

export default function WidgetConfigurator() {
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['widget_config', tenant?.id],
    queryFn: async () => {
      if (!tenant) return null;
      // Use tenant table for widget token (simplified)
      const { data, error } = await supabase
        .from('tenants')
        .select('widget_token, business_name')
        .eq('id', tenant.id)
        .single();
        
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  const rotateTokenMutation = useMutation({
    mutationFn: async () => {
      const newToken = `wt_${Math.random().toString(36).substring(2, 15)}_${Date.now().toString(36)}`;
      const { error } = await supabase
        .from('tenants')
        .update({ widget_token: newToken })
        .eq('id', tenant!.id);
      
      if (error) throw error;
      return newToken;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widget_config', tenant?.id] });
      alert("Token rotated successfully! Please update the embed code on your website.");
    }
  });

  const handleCopy = () => {
    const embedCode = `<script src="https://cdn.flought.com/widget.js" data-token="${config?.widget_token || 'YOUR_TOKEN'}"></script>`;
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return <div className="flex-1 flex items-center justify-center h-full">Loading...</div>;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-theme-bg text-theme-text">
      <div className="p-6 border-b border-theme-border bg-theme-surface shrink-0">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Globe className="text-brand-accent" /> Chat Widget Configurator
        </h1>
        <p className="text-theme-text-muted mt-2">Customize and embed the web chat widget on your own website.</p>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Panel: Configuration */}
        <div className="w-full md:w-1/2 p-6 overflow-y-auto border-r border-theme-border bg-theme-surface">
          
          <div className="theme-card p-6 mb-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Code size={20} className="text-blue-500" /> Embed Code
            </h2>
            <p className="text-sm text-theme-text-muted mb-4">
              Copy and paste this snippet into the <code>&lt;head&gt;</code> or just before the closing <code>&lt;/body&gt;</code> tag of your website.
            </p>
            
            <div className="relative">
              <pre className="bg-theme-bg border border-theme-border p-4 rounded-lg text-sm font-mono overflow-x-auto text-theme-text theme-button">
{`<script 
  src="https://cdn.flought.com/widget.js" 
  data-token="${config?.widget_token || 'YOUR_TOKEN'}"
></script>`}
              </pre>
              <button 
                onClick={handleCopy}
                className="absolute top-2 right-2 p-2 bg-theme-surface border border-theme-border rounded hover:bg-theme-surface-hover transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <Check size={16} className="text-green-500" /> : <Code size={16} />}
              </button>
            </div>
          </div>

          <div className="theme-card p-6">
            <h2 className="text-lg font-bold mb-4 text-red-500">Security</h2>
            <p className="text-sm text-theme-text-muted mb-4">
              If your widget token is compromised, you can rotate it here. <strong>Warning:</strong> This will instantly break the widget on your website until you update the embed code.
            </p>
            
            <button 
              onClick={() => {
                if(window.confirm("Are you sure? This will break any existing website integrations until you update the code.")) {
                  rotateTokenMutation.mutate();
                }
              }}
              disabled={rotateTokenMutation.isPending}
              className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 font-bold rounded-lg hover:bg-red-500/20 transition-colors flex items-center gap-2"
            >
              <RefreshCw size={16} className={rotateTokenMutation.isPending ? "animate-spin" : ""} />
              Rotate Token
            </button>
          </div>

        </div>

        {/* Right Panel: Live Preview */}
        <div className="w-full md:w-1/2 bg-theme-bg relative flex flex-col">
          <div className="p-4 border-b border-theme-border bg-theme-surface shrink-0 flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2">Live Preview</h2>
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
          </div>
          <div className="flex-1 relative overflow-hidden flex items-center justify-center p-8">
            <div className="w-full max-w-sm aspect-[9/16] bg-theme-surface border-[8px] border-theme-border rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col">
              <div className="absolute top-0 inset-x-0 h-6 flex justify-center">
                <div className="w-1/3 h-full bg-theme-border rounded-b-xl"></div>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <h3 className="font-display font-bold text-xl mb-2">{config?.business_name || 'Your Website'}</h3>
                <p className="text-theme-text-muted text-sm">This is how your website looks to visitors.</p>
                <p className="text-theme-text-muted text-sm mt-4">Try clicking the widget in the bottom right!</p>
              </div>
              {/* Render the WebChatWidget directly in the preview container */}
              <div className="absolute inset-0 pointer-events-auto">
                <WebChatWidget forcePreview={true} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
