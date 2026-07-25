import React, { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Save, Plus, MessageSquare, Zap, SplitSquareHorizontal } from 'lucide-react';

// --- Custom Nodes ---

const TriggerNode = ({ data, isConnectable }: any) => {
  return (
    <div className="bg-theme-surface border-2 border-brand-accent rounded-lg shadow-lg w-[250px] overflow-hidden theme-button">
      <div className="bg-brand-accent text-white px-3 py-2 text-sm font-bold flex items-center gap-2">
        <Zap size={16} /> Keyword Trigger
      </div>
      <div className="p-4">
        <label className="block text-xs font-bold text-theme-text-muted mb-1">If customer says:</label>
        <input 
          className="w-full bg-theme-bg border border-theme-border text-theme-text p-2 text-sm focus:outline-none focus:border-brand-accent theme-button"
          value={data.keyword || ''}
          onChange={(e) => data.onChange(data.id, 'keyword', e.target.value)}
          placeholder="e.g. hello, help, pricing"
        />
        <div className="text-[10px] text-theme-text-muted mt-2">Fires when message exactly matches keyword.</div>
      </div>
      <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="w-3 h-3 bg-brand-accent" />
    </div>
  );
};

const MessageNode = ({ data, isConnectable }: any) => {
  return (
    <div className="bg-theme-surface border-2 border-blue-500 rounded-lg shadow-lg w-[250px] overflow-hidden theme-button">
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="w-3 h-3 bg-blue-500" />
      <div className="bg-blue-500 text-white px-3 py-2 text-sm font-bold flex items-center gap-2">
        <MessageSquare size={16} /> Send Message
      </div>
      <div className="p-4">
        <label className="block text-xs font-bold text-theme-text-muted mb-1">Reply with:</label>
        <textarea 
          className="w-full bg-theme-bg border border-theme-border text-theme-text p-2 text-sm focus:outline-none focus:border-blue-500 h-20 resize-none theme-button"
          value={data.text || ''}
          onChange={(e) => data.onChange(data.id, 'text', e.target.value)}
          placeholder="Type your message here..."
        />
      </div>
      <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="w-3 h-3 bg-blue-500" />
    </div>
  );
};

const ConditionNode = ({ data, isConnectable }: any) => {
  return (
    <div className="bg-theme-surface border-2 border-purple-500 rounded-lg shadow-lg w-[250px] overflow-hidden theme-button relative">
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="w-3 h-3 bg-purple-500" />
      <div className="bg-purple-500 text-white px-3 py-2 text-sm font-bold flex items-center gap-2">
        <SplitSquareHorizontal size={16} /> Condition (Branch)
      </div>
      <div className="p-4">
        <label className="block text-xs font-bold text-theme-text-muted mb-1">Variable to check:</label>
        <select 
          className="w-full bg-theme-bg border border-theme-border text-theme-text p-2 text-sm focus:outline-none focus:border-purple-500 theme-button mb-3"
          value={data.variable || 'message_body'}
          onChange={(e) => data.onChange(data.id, 'variable', e.target.value)}
        >
          <option value="message_body">Message Body</option>
          <option value="customer_tag">Customer Tag</option>
          <option value="business_hours">Is Business Hours</option>
        </select>
        
        <label className="block text-xs font-bold text-theme-text-muted mb-1">Condition value:</label>
        <input 
          className="w-full bg-theme-bg border border-theme-border text-theme-text p-2 text-sm focus:outline-none focus:border-purple-500 theme-button"
          value={data.value || ''}
          onChange={(e) => data.onChange(data.id, 'value', e.target.value)}
          placeholder="e.g. VIP, contains 'buy'"
        />
      </div>
      
      {/* True Output */}
      <div className="absolute right-0 top-[40%] flex items-center translate-x-1/2">
        <span className="text-[10px] font-bold bg-theme-surface px-1 mr-2 text-green-500">True</span>
        <Handle type="source" id="true" position={Position.Right} isConnectable={isConnectable} className="w-3 h-3 bg-green-500 !relative !transform-none !right-auto !top-auto" />
      </div>
      {/* False Output */}
      <div className="absolute right-0 top-[70%] flex items-center translate-x-1/2">
        <span className="text-[10px] font-bold bg-theme-surface px-1 mr-2 text-red-500">False</span>
        <Handle type="source" id="false" position={Position.Right} isConnectable={isConnectable} className="w-3 h-3 bg-red-500 !relative !transform-none !right-auto !top-auto" />
      </div>
    </div>
  );
};

const nodeTypes = {
  trigger: TriggerNode,
  message: MessageNode,
  condition: ConditionNode,
};

const initialNodes = [
  { id: 'node-1', type: 'trigger', position: { x: 100, y: 150 }, data: { id: 'node-1', keyword: 'hello' } },
  { id: 'node-2', type: 'message', position: { x: 450, y: 150 }, data: { id: 'node-2', text: 'Hi there! How can we help you today?' } },
];

const initialEdges = [
  { id: 'e1-2', source: 'node-1', target: 'node-2', animated: true, style: { stroke: '#00B2FF', strokeWidth: 2 } },
];

export default function FlowBuilder() {
  const { tenant } = useAuth();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  const [flowId, setFlowId] = useState<string | null>(null);
  const [flowName, setFlowName] = useState('Welcome Flow');
  const [isActive, setIsActive] = useState(false);
  const [saving, setSaving] = useState(false);

  // Bind change handlers to nodes data
  const handleNodeDataChange = useCallback((nodeId: string, field: string, value: string) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          return { ...n, data: { ...n.data, [field]: value } };
        }
        return n;
      })
    );
  }, [setNodes]);

  // (useEffect removed as it caused infinite re-renders by continuously modifying the state array)

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#00B2FF', strokeWidth: 2 } }, eds)),
    [setEdges],
  );

  const { data: flowData, isLoading: loading } = useQuery({
    queryKey: ['chat_flows', tenant?.id],
    queryFn: async () => {
      if (!tenant) return null;
      const { data, error } = await supabase
        .from('bot_flows')
        .select('*')
        .eq('tenant_id', tenant.id)
        .maybeSingle();
        
      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    },
    enabled: !!tenant?.id
  });

  useEffect(() => {
    if (flowData) {
      setFlowId((flowData as any).id);
      setFlowName((flowData as any).name || 'Default Flow');
      setIsActive((flowData as any).is_active);
      
      if ((flowData as any).nodes && (flowData as any).nodes.length > 0) {
        const mappedNodes = (flowData as any).nodes.map((n: any) => ({
          ...n,
          data: { ...n.data, onChange: handleNodeDataChange }
        }));
        setNodes(mappedNodes);
      } else {
        setNodes(initialNodes.map(n => ({...n, data: {...n.data, onChange: handleNodeDataChange}})));
      }
      
      if ((flowData as any).edges && (flowData as any).edges.length > 0) {
        setEdges((flowData as any).edges);
      } else {
        setEdges(initialEdges);
      }
    } else if (!loading && !flowData) {
      setNodes(initialNodes.map(n => ({...n, data: {...n.data, onChange: handleNodeDataChange}})));
      setEdges(initialEdges);
    }
  }, [flowData, loading, handleNodeDataChange, setNodes, setEdges]);

  const handleSave = async () => {
    if (!tenant) return;
    setSaving(true);
    try {
      const cleanNodes = nodes.map(n => {
        const { onChange, ...cleanData } = n.data;
        return { ...n, data: cleanData };
      });

      const payload: any = {
        tenant_id: tenant.id,
        name: flowName,
        is_active: isActive,
        nodes: cleanNodes,
        edges: edges,
        updated_at: new Date().toISOString()
      };

      if (flowId) {
        const { error } = await supabase.from('bot_flows').update(payload as never).eq('id', flowId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('bot_flows').insert(payload as never).select().single();
        if (error) throw error;
        if (data) setFlowId((data as any).id);
      }
      alert('Flow saved successfully!');
    } catch (err: unknown) {
      console.error(err);
      const code = (err as { code?: string })?.code;
      if (code === 'PGRST205') {
        alert('Flow Builder table is missing. Apply Supabase migrations (bot_flows) and reload the schema cache, then try again.');
      } else {
        const message = err instanceof Error ? err.message : 'Failed to save flow';
        alert(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const addTriggerNode = () => {
    const newNode = {
      id: `node-${Date.now()}`,
      type: 'trigger',
      position: { x: Math.random() * 200, y: Math.random() * 200 + 100 },
      data: { id: `node-${Date.now()}`, keyword: '', onChange: handleNodeDataChange }
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const addMessageNode = () => {
    const newNode = {
      id: `node-${Date.now()}`,
      type: 'message',
      position: { x: Math.random() * 200 + 300, y: Math.random() * 200 + 100 },
      data: { id: `node-${Date.now()}`, text: '', onChange: handleNodeDataChange }
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const addConditionNode = () => {
    const newNode = {
      id: `node-${Date.now()}`,
      type: 'condition',
      position: { x: Math.random() * 200 + 400, y: Math.random() * 200 + 200 },
      data: { id: `node-${Date.now()}`, variable: 'message_body', value: '', onChange: handleNodeDataChange }
    };
    setNodes((nds) => [...nds, newNode]);
  };

  if (loading) return <div className="flex-1 flex items-center justify-center h-full text-theme-text-muted">Loading Flow Builder...</div>;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <div className="bg-theme-surface border-b border-theme-border p-4 flex justify-between items-center z-10 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-display font-bold text-theme-text flex items-center gap-2">
            <Zap size={24} className="text-brand-accent" /> Flow Builder
          </h1>
          <input 
            type="text" 
            value={flowName} 
            onChange={(e) => setFlowName(e.target.value)}
            className="bg-theme-bg border border-theme-border text-theme-text px-3 py-1.5 text-sm font-bold focus:outline-none focus:border-brand-accent theme-button hidden md:block"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-theme-bg border border-theme-border p-1 rounded-md">
            <button 
              onClick={() => setIsActive(false)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${!isActive ? 'bg-theme-text-muted text-theme-bg' : 'text-theme-text hover:bg-theme-surface-hover'}`}
            >
              Draft
            </button>
            <button 
              onClick={() => setIsActive(true)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${isActive ? 'bg-green-500 text-white shadow-sm' : 'text-theme-text hover:bg-theme-surface-hover'}`}
            >
              Published
            </button>
          </div>
          
          
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-brand-accent text-white font-bold hover:bg-brand-accent-light transition-colors theme-button disabled:opacity-50"
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Save Flow'}
          </button>
        </div>
      </div>
      
      <div className="bg-theme-bg border-b border-theme-border p-2 flex gap-2 z-10 shrink-0">
        <button onClick={addTriggerNode} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-theme-surface border border-theme-border text-theme-text hover:border-brand-accent transition-colors theme-button">
          <Plus size={14} /> Add Trigger
        </button>
        <button onClick={addMessageNode} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-theme-surface border border-theme-border text-theme-text hover:border-blue-500 transition-colors theme-button">
          <Plus size={14} /> Add Message
        </button>
        <button onClick={addConditionNode} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-theme-surface border border-theme-border text-theme-text hover:border-purple-500 transition-colors theme-button">
          <Plus size={14} /> Add Condition
        </button>
      </div>

      <div className="flex-1 w-full h-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="bg-theme-bg"
        >
          <Controls className="bg-theme-surface border-theme-border fill-theme-text" />
          <MiniMap 
            nodeColor={(n) => {
              if (n.type === 'trigger') return '#00B2FF';
              return '#3b82f6';
            }}
            maskColor="rgba(0,0,0,0.1)"
            className="bg-theme-surface border-theme-border"
          />
          <Background gap={16} size={1} color="rgba(150,150,150,0.2)" />
        </ReactFlow>
      </div>
    </div>
  );
}
