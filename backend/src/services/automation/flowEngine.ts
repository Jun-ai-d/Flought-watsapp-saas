/**
 * Bot Flow Evaluator Engine
 * Parses JSON AST from the drag-and-drop canvas and executes rules.
 */

export interface FlowNode {
  id: string;
  type: 'trigger' | 'condition' | 'action' | 'handoff';
  data: Record<string, any>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export class FlowEngine {
  graph: FlowGraph;
  
  constructor(graph: FlowGraph) {
    this.graph = graph;
  }

  /**
   * Finds the start node (trigger)
   */
  getStartNode(): FlowNode | undefined {
    return this.graph.nodes.find(n => n.type === 'trigger');
  }

  /**
   * Gets the next node based on edge connections
   */
  getNextNode(nodeId: string, handleValue?: string): FlowNode | undefined {
    let edge = this.graph.edges.find(e => e.source === nodeId && e.sourceHandle === handleValue);
    if (!edge) {
      // Fallback to default edge if handle doesn't match
      edge = this.graph.edges.find(e => e.source === nodeId && !e.sourceHandle);
    }
    if (!edge) return undefined;
    return this.graph.nodes.find(n => n.id === edge?.target);
  }

  /**
   * Evaluates a single node's logic against incoming context
   */
  async evaluateNode(node: FlowNode, context: Record<string, any>): Promise<{ nextHandle?: string, result?: any }> {
    try {
      switch (node.type) {
        case 'condition':
          const { field, operator, value } = node.data;
          const contextValue = context[field];
          
          let conditionMet = false;
          if (operator === 'equals') conditionMet = contextValue === value;
          if (operator === 'contains') conditionMet = (contextValue || '').includes(value);
          if (operator === 'exists') conditionMet = !!contextValue;
          
          return { nextHandle: conditionMet ? 'true' : 'false' };
          
        case 'action':
          // e.g. Send a message, Add a tag
          if (node.data.actionType === 'send_message') {
            return { result: { sendTemplate: node.data.templateId } };
          }
          if (node.data.actionType === 'add_tag') {
            return { result: { addTag: node.data.tag } };
          }
          return {};
          
        case 'handoff':
          return { result: { handoff: true } };
          
        default:
          return {};
      }
    } catch (error) {
      console.error(`[FlowEngine] Action failure in node ${node.id}:`, error);
      // Gracefully halt the flow for this node or fallback
      return { nextHandle: 'error', result: { error: true, nodeId: node.id } };
    }
  }

  /**
   * Traverses the graph given an initial context
   */
  async execute(context: Record<string, any>): Promise<any[]> {
    const results = [];
    let currentNode = this.getStartNode();
    
    // Safety limit to prevent infinite loops in cyclic graphs
    let iterations = 0;
    const MAX_ITERATIONS = 50;

    while (currentNode && iterations < MAX_ITERATIONS) {
      iterations++;
      
      const { nextHandle, result } = await this.evaluateNode(currentNode, context);
      
      if (result) {
        results.push(result);
      }

      currentNode = this.getNextNode(currentNode.id, nextHandle);
    }

    return results;
  }
}
