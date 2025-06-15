/**
 * MCP tools for working with Node-RED flows
 * 极简版：只保留最核心的CRUD操作
 */

import { z } from 'zod';
import { callNodeRed, formatFlowsOutput } from '../utils.mjs';

/**
 * Advanced coordinate management
 */
class CoordinateManager {
  constructor(gridSize = 20, nodeWidth = 120, nodeHeight = 30) {
    this.gridSize = gridSize;
    this.nodeWidth = nodeWidth;
    this.nodeHeight = nodeHeight;
  }

  /**
   * Get existing coordinates and calculate workspace bounds
   */
  async getExistingCoordinates(flowId, config) {
    try {
      const flow = await callNodeRed('get', '/flow/' + flowId, null, config);
      const coords = new Set();
      let bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
      
      if (flow.nodes) {
        flow.nodes.forEach(node => {
          if (typeof node.x === 'number' && typeof node.y === 'number') {
            coords.add(`${node.x},${node.y}`);
            
            // Calculate workspace bounds
            bounds.minX = Math.min(bounds.minX, node.x);
            bounds.maxX = Math.max(bounds.maxX, node.x);
            bounds.minY = Math.min(bounds.minY, node.y);
            bounds.maxY = Math.max(bounds.maxY, node.y);
          }
        });
      }
      
      // If no existing nodes, set default bounds
      if (coords.size === 0) {
        bounds = { minX: 100, maxX: 100, minY: 100, maxY: 100 };
      }
      
      return { coords, bounds };
    } catch (error) {
      return { 
        coords: new Set(), 
        bounds: { minX: 100, maxX: 100, minY: 100, maxY: 100 }
      };
    }
  }

  /**
   * Calculate safe zone for new nodes (below existing workflow)
   */
  calculateSafeZone(bounds, nodeCount) {
    const SAFE_MARGIN = 150; // 安全边距
    const NODES_PER_ROW = 4;  // 每行节点数
    const NODE_SPACING_X = 250; // 节点水平间距
    const NODE_SPACING_Y = 120; // 节点垂直间距
    
    // 新节点区域起始位置：在现有工作流下方
    const safeStartY = bounds.maxY + SAFE_MARGIN;
    const safeStartX = Math.max(100, bounds.minX); // 保持左对齐或最小边距
    
    return {
      startX: safeStartX,
      startY: safeStartY,
      nodesPerRow: NODES_PER_ROW,
      spacingX: NODE_SPACING_X,
      spacingY: NODE_SPACING_Y
    };
  }

  /**
   * Check coordinate collision with buffer zone
   */
  checkCoordinateCollision(x, y, existingCoords) {
    const buffer = 20;
    
    for (const coordStr of existingCoords) {
      const [exX, exY] = coordStr.split(',').map(Number);
      
      // Rectangle overlap detection
      if (Math.abs(x - exX) < this.nodeWidth + buffer && 
          Math.abs(y - exY) < this.nodeHeight + buffer) {
        return true;
      }
    }
    
    return false;
  }
}

/**
 * Helper function to resolve flow identifier (name or ID) to actual flow ID
 * @param {string} identifier - Either flow ID or flow name/label
 * @param {Object} config - Server configuration
 * @returns {Promise<{flowId: string, error?: string}>}
 */
async function resolveFlowId(identifier, config) {
  // Check if identifier looks like a Flow ID (contains hyphen and lowercase)
  const looksLikeId = /^[a-f0-9-]+$/i.test(identifier) && identifier.includes('-');
  
  if (looksLikeId) {
    return { flowId: identifier };
  }
  
  // Get all flows to find the matching name/label
  const flows = await callNodeRed('get', '/flows', null, config);
  const targetTab = flows.find(f => 
    f.type === 'tab' && 
    (f.label === identifier || f.name === identifier)
  );
  
  if (!targetTab) {
    const availableFlows = flows
      .filter(f => f.type === 'tab')
      .map(tab => `- ${tab.label} (ID: ${tab.id})`)
      .join('\n');
    
    return { 
      flowId: null, 
      error: `Flow not found: "${identifier}"\n\nAvailable flows:\n${availableFlows}` 
    };
  }
  
  return { flowId: targetTab.id };
}

/**
 * Validate flow structure and detect common errors
 * @param {Object} flowData - Flow data to validate
 * @param {Object} existingFlow - Existing flow for reference (optional)
 * @returns {Object} Validation result with valid flag and errors array
 */
function validateFlowStructure(flowData, existingFlow = null) {
  const errors = [];
  
  // Check if flowData has nodes
  if (!flowData.nodes || !Array.isArray(flowData.nodes)) {
    errors.push('工作流必须包含nodes数组');
    return { valid: false, errors };
  }
  
  const nodeIds = new Set();
  const nodeMap = new Map();
  
  // Validate each node
  flowData.nodes.forEach((node, index) => {
    // Check required fields
    if (!node.id) {
      errors.push(`节点${index}: 缺少必需的id字段`);
    } else {
      // Check for duplicate IDs
      if (nodeIds.has(node.id)) {
        errors.push(`节点${index}: 重复的节点ID "${node.id}"`);
      } else {
        nodeIds.add(node.id);
        nodeMap.set(node.id, node);
      }
    }
    
    if (!node.type) {
      errors.push(`节点${index} (${node.id}): 缺少必需的type字段`);
    }
    
    // Check coordinates
    if (typeof node.x !== 'number' || typeof node.y !== 'number') {
      errors.push(`节点${index} (${node.id}): 坐标x,y必须是数字`);
    }
    
    // Check wires format
    if (node.wires && !Array.isArray(node.wires)) {
      errors.push(`节点${index} (${node.id}): wires必须是数组`);
    }
  });
  
  // Validate wire connections
  flowData.nodes.forEach((node, index) => {
    if (node.wires && Array.isArray(node.wires)) {
      node.wires.forEach((outputWires, outputIndex) => {
        if (Array.isArray(outputWires)) {
          outputWires.forEach(targetId => {
            if (targetId && !nodeIds.has(targetId)) {
              errors.push(`节点${index} (${node.id}): 连接到不存在的节点 "${targetId}"`);
            }
          });
        }
      });
    }
  });
  
  return { valid: errors.length === 0, errors };
}

/**
 * Merge flows intelligently based on mode
 * @param {Object} existingFlow - Current flow
 * @param {Object} newFlowData - New flow data to merge
 * @param {string} mode - Merge mode: 'replace', 'merge', 'add-only'
 * @param {boolean} preserveCoordinates - Whether to preserve existing coordinates
 * @returns {Object} Merged flow
 */
function mergeFlows(existingFlow, newFlowData, mode, preserveCoordinates) {
  const result = { ...existingFlow };
  
  if (mode === 'replace') {
    // Complete replacement
    result.nodes = newFlowData.nodes || [];
    if (newFlowData.label) result.label = newFlowData.label;
    if (newFlowData.disabled !== undefined) result.disabled = newFlowData.disabled;
    if (newFlowData.env) result.env = newFlowData.env;
    
    // Apply coordinate preservation if requested
    if (preserveCoordinates && existingFlow.nodes) {
      const coordMap = new Map();
      existingFlow.nodes.forEach(node => {
        if (node.id && typeof node.x === 'number' && typeof node.y === 'number') {
          coordMap.set(node.id, { x: node.x, y: node.y });
        }
      });
      
      result.nodes = result.nodes.map(node => {
        const coords = coordMap.get(node.id);
        return coords ? { ...node, ...coords } : node;
      });
    }
    
    return result;
  }
  
  // For merge and add-only modes
  const existingNodeMap = new Map();
  const existingNodes = existingFlow.nodes || [];
  
  existingNodes.forEach(node => {
    if (node.id) {
      existingNodeMap.set(node.id, node);
    }
  });
  
  // Calculate coordinate bounds for auto-positioning
  let maxX = 0, maxY = 0;
  existingNodes.forEach(node => {
    if (typeof node.x === 'number' && typeof node.y === 'number') {
      maxX = Math.max(maxX, node.x);
      maxY = Math.max(maxY, node.y);
    }
  });
  
  const newNodes = [...existingNodes];
  let currentX = maxX + 200;
  let currentY = 100;
  
  // Process new nodes
  (newFlowData.nodes || []).forEach(newNode => {
    // Ensure node has flow ID
    newNode.z = existingFlow.id;
    
    if (existingNodeMap.has(newNode.id)) {
      if (mode === 'merge') {
        // Update existing node
        const existingNode = existingNodeMap.get(newNode.id);
        const updatedNode = { ...existingNode, ...newNode };
        
        // Preserve coordinates if requested
        if (preserveCoordinates) {
          updatedNode.x = existingNode.x;
          updatedNode.y = existingNode.y;
        }
        
        // Replace in array
        const index = newNodes.findIndex(n => n.id === newNode.id);
        if (index !== -1) {
          newNodes[index] = updatedNode;
        }
      }
      // For add-only mode, skip existing nodes
    } else {
      // Add new node
      if (!newNode.x || !newNode.y) {
        newNode.x = currentX;
        newNode.y = currentY;
        currentY += 100;
        if (currentY > 800) {
          currentX += 300;
          currentY = 100;
        }
      }
      
      newNodes.push(newNode);
    }
  });
  
  result.nodes = newNodes;
  return result;
}

/**
 * Generate update statistics
 * @param {Object} existingFlow - Original flow
 * @param {Object} finalFlow - Updated flow
 * @returns {Object} Statistics about the update
 */
function getUpdateStats(existingFlow, finalFlow) {
  const existingNodes = new Set((existingFlow.nodes || []).map(n => n.id));
  const finalNodes = new Set((finalFlow.nodes || []).map(n => n.id));
  
  const added = finalFlow.nodes.filter(n => !existingNodes.has(n.id)).length;
  const updated = finalFlow.nodes.filter(n => existingNodes.has(n.id)).length;
  const preserved = updated;
  
  return { added, updated, preserved };
}

/**
 * Registers flow-related tools in the MCP server
 * @param {Object} server - MCP server instance
 * @param {Object} config - Server configuration
 */
export default function registerFlowTools(server, config) {
  // ✅ RECOMMENDED: Get specific flow by ID or name
  server.tool(
    'get-flow',
    { identifier: z.string().describe('Flow ID or flow name/label') },
    async ({ identifier }) => {
      try {
        const { flowId, error } = await resolveFlowId(identifier, config);
        
        if (error) {
          return { content: [{ type: 'text', text: error }] };
        }
        
        const flow = await callNodeRed('get', '/flow/' + flowId, null, config);
        return { content: [{ type: 'text', text: JSON.stringify(flow, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  );

  // ✅ ENHANCED: Smart flow update with validation and conflict resolution
  server.tool(
    'update-flow',
    {
      identifier: z.string().describe('Flow ID or flow name/label'),
      flowJson: z.string().describe('New flow configuration in JSON (can be partial)'),
      mergeMode: z.enum(['replace', 'merge', 'add-only']).default('merge').describe('Update mode: replace (完全替换), merge (智能合并), add-only (仅添加新节点)'),
      preserveCoordinates: z.boolean().default(true).describe('Preserve existing node coordinates (default: true)')
    },
    async ({ identifier, flowJson, mergeMode, preserveCoordinates }) => {
      try {
        const { flowId, error } = await resolveFlowId(identifier, config);
        
        if (error) {
          return { content: [{ type: 'text', text: error }] };
        }

        // Parse new flow data
        let newFlowData;
        try {
          newFlowData = JSON.parse(flowJson);
        } catch (parseError) {
          return { content: [{ type: 'text', text: `JSON解析错误: ${parseError.message}` }] };
        }

        // Get existing flow
        const existingFlow = await callNodeRed('get', '/flow/' + flowId, null, config);
        
        // 验证工作流结构
        const validationResult = validateFlowStructure(newFlowData, existingFlow);
        if (!validationResult.valid) {
          return {
            content: [{
              type: 'text',
              text: `工作流验证失败:\n${validationResult.errors.join('\n')}\n\n请检查工作流配置并修复错误。`
            }]
          };
        }
        
        // 根据合并模式处理工作流
        let finalFlow;
        switch (mergeMode) {
          case 'replace':
            finalFlow = mergeFlows(existingFlow, newFlowData, 'replace', preserveCoordinates);
            break;
          case 'merge':
            finalFlow = mergeFlows(existingFlow, newFlowData, 'merge', preserveCoordinates);
            break;
          case 'add-only':
            finalFlow = mergeFlows(existingFlow, newFlowData, 'add-only', preserveCoordinates);
            break;
          default:
            finalFlow = mergeFlows(existingFlow, newFlowData, 'merge', preserveCoordinates);
        }
        
        // 最终验证合并后的工作流
        const finalValidation = validateFlowStructure(finalFlow, null);
        if (!finalValidation.valid) {
          return {
            content: [{
              type: 'text',
              text: `合并后工作流验证失败:\n${finalValidation.errors.join('\n')}\n\n请检查节点连接和配置。`
            }]
          };
        }
        
        // 更新工作流
        await callNodeRed('put', '/flow/' + flowId, finalFlow, config);
        
        const stats = getUpdateStats(existingFlow, finalFlow);
        return { 
          content: [{ 
            type: 'text', 
            text: `Flow "${identifier}" (${flowId}) updated successfully!\n\n统计信息:\n- 新增节点: ${stats.added}\n- 更新节点: ${stats.updated}\n- 保留节点: ${stats.preserved}\n- 合并模式: ${mergeMode}` 
          }] 
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  );

  // ✅ RECOMMENDED: Create new flow
  server.tool(
    'create-flow',
    { flowJson: z.string().describe('New flow configuration in JSON') },
    async ({ flowJson }) => {
      try {
        const flowObj = JSON.parse(flowJson);
        const result = await callNodeRed('post', '/flow', flowObj, config);
        return { content: [{ type: 'text', text: `Flow created with ID: ${result.id}` }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  );

  // ✅ RECOMMENDED: Delete flow by ID or name
  server.tool(
    'delete-flow',
    { identifier: z.string().describe('Flow ID or flow name/label to delete') },
    async ({ identifier }) => {
      try {
        const { flowId, error } = await resolveFlowId(identifier, config);
        
        if (error) {
          return { content: [{ type: 'text', text: error }] };
        }
        
        await callNodeRed('delete', '/flow/' + flowId, null, config);
        return { content: [{ type: 'text', text: `Flow "${identifier}" (${flowId}) deleted successfully` }] };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  );

  // ✅ RECOMMENDED: Get all flows configuration
  server.tool(
    'get-flows',
    {},
    async () => {
      const flows = await callNodeRed('get', '/flows', null, config);
      return {
        content: [{ type: 'text', text: JSON.stringify(flows, null, 2) }]
      };
    }
  );

  // ✅ RECOMMENDED: List flow tabs only (lightweight)
  server.tool(
    'list-tabs',
    {},
    async () => {
      const flows = await callNodeRed('get', '/flows', null, config);
      const tabs = flows.filter(f => f.type === 'tab').map(tab => `- ${tab.label} (ID: ${tab.id})`);
      return {
        content: [{ type: 'text', text: tabs.join('\n') }]
      };
    }
  );

  // ✅ RECOMMENDED: Flow state management (unified get/set)
  server.tool(
    'manage-flows-state',
    {
      stateJson: z.string().optional().describe('Optional: JSON state to set. If not provided, returns current state'),
      action: z.enum(['get', 'set']).optional().describe('Explicit action: get or set. Auto-detected if not specified')
    },
    async ({ stateJson, action }) => {
      try {
        // Auto-detect operation type
        const operation = action || (stateJson ? 'set' : 'get');
        
        if (operation === 'set') {
          if (!stateJson) {
            return { content: [{ type: 'text', text: 'Error: stateJson is required for set operation' }] };
          }
          const stateObj = JSON.parse(stateJson);
          await callNodeRed('post', '/flows/state', stateObj, config);
          return { content: [{ type: 'text', text: 'Flows state updated successfully' }] };
        } else {
          const state = await callNodeRed('get', '/flows/state', null, config);
          return { content: [{ type: 'text', text: JSON.stringify(state, null, 2) }] };
        }
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  );
}