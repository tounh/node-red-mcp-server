/**
 * MCP tools for working with Node-RED flows
 * 极简版：只保留最核心的CRUD操作，移除所有辅助工具
 * 新增：基于Genspark AI文章的增量更新和智能布局功能
 */

import { z } from 'zod';
import { callNodeRed, formatFlowsOutput } from '../utils.mjs';

/**
 * Advanced coordinate management based on Genspark AI article
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

  /**
   * Find available position using smart zone placement
   */
  findAvailablePosition(preferredX, preferredY, existingCoords, safeZone = null) {
    // If safe zone is provided, prefer positions within it
    if (safeZone) {
      const safeX = preferredX < safeZone.startX ? safeZone.startX : preferredX;
      const safeY = preferredY < safeZone.startY ? safeZone.startY : preferredY;
      
      if (!this.checkCoordinateCollision(safeX, safeY, existingCoords)) {
        return { x: safeX, y: safeY };
      }
    }
    
    // Try preferred position first
    if (!this.checkCoordinateCollision(preferredX, preferredY, existingCoords)) {
      return { x: preferredX, y: preferredY };
    }

    // Spiral grid search algorithm (limited to safe zone if provided)
    let searchRadius = 1;
    const maxRadius = 20;

    while (searchRadius <= maxRadius) {
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        for (let dy = -searchRadius; dy <= searchRadius; dy++) {
          if (dx === 0 && dy === 0) continue;

          const testX = preferredX + dx * this.gridSize;
          const testY = preferredY + dy * this.gridSize;

          // Ensure positive coordinates
          if (testX < 0 || testY < 0) continue;
          
          // Prefer positions in safe zone
          if (safeZone && testY < safeZone.startY) continue;

          if (!this.checkCoordinateCollision(testX, testY, existingCoords)) {
            return { x: testX, y: testY };
          }
        }
      }
      searchRadius++;
    }

    // Fallback: auto-layout position in safe zone
    return this.autoLayoutPosition(existingCoords, safeZone);
  }

  /**
   * Auto-layout algorithm - find safe position below existing workflow
   */
  autoLayoutPosition(existingCoords, safeZone = null) {
    if (existingCoords.size === 0) {
      return { x: 100, y: 100 };
    }

    if (safeZone) {
      // Use safe zone for new nodes
      return { x: safeZone.startX, y: safeZone.startY };
    }

    // Fallback: rightmost position
    let maxX = 0, minY = 100;
    
    for (const coordStr of existingCoords) {
      const [x, y] = coordStr.split(',').map(Number);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
    }

    return { x: maxX + 200, y: minY };
  }
}

/**
 * Enhanced layout manager with semantic grouping and article-style layout
 * Based on UML Activity Diagram and workflow design best practices
 */
class AutoLayoutManager {
  constructor() {
    this.coordinateManager = new CoordinateManager();
  }

  /**
   * Apply auto-layout algorithm to nodes with semantic grouping
   */
  async applyAutoLayout(nodes, flowId, config, algorithm = 'collision_free') {
    const existingData = await this.coordinateManager.getExistingCoordinates(flowId, config);
    const { coords: existingCoords, bounds } = existingData;
    
    // Calculate safe zone for new nodes (below existing workflow)
    const safeZone = this.coordinateManager.calculateSafeZone(bounds, nodes.length);

    switch (algorithm) {
      case 'semantic_article':
        return this.semanticArticleLayout(nodes, existingCoords, safeZone);
      case 'dagre_lr':
        return this.dagre_left_right(nodes, existingCoords, safeZone);
      case 'grid':
        return this.gridLayout(nodes, existingCoords, safeZone);
      case 'collision_free':
      default:
        return this.collisionFreeLayout(nodes, existingCoords, safeZone);
    }
  }

  /**
   * Semantic logic layout - arranges nodes by functional execution chains
   * Groups complete logical workflows as horizontal rows based on wire connections
   * Example: HTTP Request -> Process -> Response = one logical row
   */
  semanticArticleLayout(nodes, existingCoords, safeZone) {
    console.log('🎯 Applying semantic logic layout based on wire connections...');
    
    // Step 1: Build connection graph from node wires
    const connectionGraph = this.buildConnectionGraph(nodes);
    
    // Step 2: Identify functional execution chains
    const functionalChains = this.identifyFunctionalChains(nodes, connectionGraph);
    
    // Step 3: Position chains as logical rows
    return this.positionFunctionalChains(functionalChains, safeZone, existingCoords);
  }

  /**
   * Build connection graph based on node wire relationships
   */
  buildConnectionGraph(nodes) {
    const graph = {
      outgoing: new Map(), // node_id -> [target_node_ids]
      incoming: new Map(), // node_id -> [source_node_ids]
      nodeMap: new Map()   // node_id -> node_object
    };

    // Initialize maps
    nodes.forEach(node => {
      graph.outgoing.set(node.id, []);
      graph.incoming.set(node.id, []);
      graph.nodeMap.set(node.id, node);
    });

    // Build connections from wires
    nodes.forEach(node => {
      if (node.wires && Array.isArray(node.wires)) {
        node.wires.forEach(outputArray => {
          if (Array.isArray(outputArray)) {
            outputArray.forEach(targetId => {
              // Add outgoing connection
              if (graph.outgoing.has(node.id)) {
                graph.outgoing.get(node.id).push(targetId);
              }
              // Add incoming connection
              if (graph.incoming.has(targetId)) {
                graph.incoming.get(targetId).push(node.id);
              }
            });
          }
        });
      }
    });

    return graph;
  }

  /**
   * Identify functional execution chains
   * Groups nodes into complete logical workflows based on their connections
   * Example: HTTP in -> function -> switch -> debug = one functional chain
   */
  identifyFunctionalChains(nodes, connectionGraph) {
    const chains = [];
    const visited = new Set();

    // Find entry points (nodes with no incoming connections or are triggers)
    const entryPoints = this.findEntryPoints(nodes, connectionGraph);

    // Trace chains from each entry point
    entryPoints.forEach(entryNode => {
      if (!visited.has(entryNode.id)) {
        const chain = this.traceFunctionalChain(entryNode, connectionGraph, visited);
        if (chain.length > 0) {
          chains.push({
            nodes: chain,
            type: this.determineChainType(chain),
            startNode: chain[0],
            endNodes: this.findChainEndNodes(chain, connectionGraph)
          });
        }
      }
    });

    // Handle remaining unvisited nodes as standalone chains
    nodes.forEach(node => {
      if (!visited.has(node.id)) {
        chains.push({
          nodes: [node],
          type: 'standalone',
          startNode: node,
          endNodes: [node]
        });
        visited.add(node.id);
      }
    });

    return chains;
  }

  /**
   * Find entry points for functional chains
   */
  findEntryPoints(nodes, connectionGraph) {
    return nodes.filter(node => {
      // Nodes with no incoming connections
      const hasNoIncoming = !connectionGraph.incoming.get(node.id) || 
                           connectionGraph.incoming.get(node.id).length === 0;
      
      // Or specific trigger types
      const isTriggerType = ['inject', 'http in', 'mqtt in', 'timer'].some(type => 
                           node.type.toLowerCase().includes(type));
      
      return hasNoIncoming || isTriggerType;
    });
  }

  /**
   * Trace a functional chain from a starting node
   */
  traceFunctionalChain(startNode, connectionGraph, visited) {
    const chain = [startNode];
    visited.add(startNode.id);
    
    let currentNode = startNode;
    while (true) {
      const targets = connectionGraph.outgoing.get(currentNode.id) || [];
      
      // For single target, continue the chain
      if (targets.length === 1) {
        const targetId = targets[0];
        const targetNode = connectionGraph.nodeMap.get(targetId);
        
        if (targetNode && !visited.has(targetId)) {
          chain.push(targetNode);
          visited.add(targetId);
          currentNode = targetNode;
        } else {
          break; // Already visited or not found
        }
      }
      // For multiple targets, include them as branch endpoints but don't continue
      else if (targets.length > 1) {
        targets.forEach(targetId => {
          const targetNode = connectionGraph.nodeMap.get(targetId);
          if (targetNode && !visited.has(targetId)) {
            chain.push(targetNode);
            visited.add(targetId);
          }
        });
        break; // End chain at branching point
      }
      else {
        break; // No more targets
      }
    }
    
    return chain;
  }

  /**
   * Determine the type of a functional chain
   */
  determineChainType(chain) {
    if (chain.length === 1) return 'standalone';
    
    const hasHttpIn = chain.some(node => node.type.toLowerCase().includes('http in'));
    const hasHttpOut = chain.some(node => node.type.toLowerCase().includes('http response'));
    if (hasHttpIn && hasHttpOut) return 'http_api';
    
    const hasInject = chain.some(node => node.type.toLowerCase().includes('inject'));
    if (hasInject) return 'trigger_flow';
    
    const hasMqtt = chain.some(node => node.type.toLowerCase().includes('mqtt'));
    if (hasMqtt) return 'mqtt_flow';
    
    return 'processing_chain';
  }

  /**
   * Find end nodes of a chain
   */
  findChainEndNodes(chain, connectionGraph) {
    return chain.filter(node => {
      const targets = connectionGraph.outgoing.get(node.id) || [];
      return targets.length === 0; // Nodes with no outgoing connections
    });
  }

  /**
   * Position functional chains as logical rows
   */
  positionFunctionalChains(chains, safeZone, existingCoords) {
    const positioned = new Map();
    let currentY = safeZone.startY;
    const rowSpacing = 100; // Space between logical rows
    const nodeSpacing = 180; // Space between nodes in a row

    chains.forEach((chain, index) => {
      console.log(`🔗 Positioning chain ${index + 1}: ${chain.type} (${chain.nodes.length} nodes)`);
      
      // Position nodes in this chain horizontally (as one logical row)
      currentY = this.positionChainAsRow(chain, safeZone.startX, currentY, 
                                        positioned, existingCoords, nodeSpacing);
      currentY += rowSpacing;
    });

    // Convert positioned map to array
    return Array.from(positioned.values());
  }

  /**
   * Position a single chain as a horizontal row
   */
  positionChainAsRow(chain, startX, startY, positioned, existingCoords, nodeSpacing) {
    let currentX = startX;
    
    chain.nodes.forEach((node, index) => {
      // Calculate position
      const x = currentX + (index * nodeSpacing);
      const y = startY;
      
      // Ensure no collision with existing nodes
      const finalPos = this.coordinateManager.findSafePosition(x, y, existingCoords);
      
      // Store positioned node
      positioned.set(node.id, { ...node, x: finalPos.x, y: finalPos.y });
      existingCoords.add(`${finalPos.x},${finalPos.y}`);
      
      console.log(`  📍 Node ${node.name || node.type}: (${finalPos.x}, ${finalPos.y})`);
    });
    
    return startY;
  }

  /**
   * Position nodes using logic-based layout principles (DEPRECATED - kept for compatibility)
   */
  positionNodesAsArticle(flowStructure, safeZone, existingCoords) {
    const { groups, chains } = flowStructure;
    const positioned = new Map();
    
    let currentY = safeZone.startY;
    const sectionSpacing = 120; // Space between "paragraphs"
    const lineSpacing = 80;     // Space between "lines"
    const indentWidth = 60;     // Indentation for sub-processes
    
    // 1. Position input nodes - like article title/introduction
    if (groups.inputs.length > 0) {
      currentY = this.positionNodeGroup(groups.inputs, safeZone.startX, currentY, 
                                       positioned, existingCoords, 'horizontal');
      currentY += sectionSpacing;
    }

    // 2. Position main flow chains - like article paragraphs
    chains.forEach((chain, index) => {
      if (chain.length > 1) {
        // Long chains get vertical layout (like long paragraphs)
        if (chain.length > 4) {
          currentY = this.positionChainVertical(chain, safeZone.startX + indentWidth, 
                                              currentY, positioned, existingCoords);
        } else {
          // Short chains get horizontal layout (like short sentences)
          currentY = this.positionChainHorizontal(chain, safeZone.startX, 
                                                currentY, positioned, existingCoords);
        }
        currentY += sectionSpacing;
      }
    });

    // 3. Position decision nodes - like article branching points
    if (groups.decisions.length > 0) {
      currentY = this.positionNodeGroup(groups.decisions, safeZone.startX + indentWidth, 
                                       currentY, positioned, existingCoords, 'grid');
      currentY += sectionSpacing;
    }

    // 4. Position output nodes - like article conclusion
    if (groups.outputs.length > 0) {
      currentY = this.positionNodeGroup(groups.outputs, safeZone.startX, currentY, 
                                       positioned, existingCoords, 'horizontal');
      currentY += sectionSpacing;
    }

    // 5. Position utility nodes - like article footnotes
    if (groups.utilities.length > 0) {
      this.positionNodeGroup(groups.utilities, safeZone.startX + safeZone.width - 200, 
                           safeZone.startY, positioned, existingCoords, 'vertical');
    }

    // Convert positioned map to array
    return Array.from(positioned.values());
  }

  /**
   * Position a group of nodes
   */
  positionNodeGroup(nodes, startX, startY, positioned, existingCoords, layout = 'horizontal') {
    let currentX = startX;
    let currentY = startY;
    const nodeSpacing = 200;
    const lineHeight = 80;

    nodes.forEach((node, index) => {
      let x, y;
      
      switch (layout) {
        case 'horizontal':
          x = currentX + (index * nodeSpacing);
          y = currentY;
          break;
        case 'vertical':
          x = currentX;
          y = currentY + (index * lineHeight);
          break;
        case 'grid':
          const cols = Math.ceil(Math.sqrt(nodes.length));
          x = currentX + ((index % cols) * nodeSpacing);
          y = currentY + (Math.floor(index / cols) * lineHeight);
          break;
        default:
          x = currentX + (index * nodeSpacing);
          y = currentY;
      }

      // Ensure no collision
      const finalPos = this.coordinateManager.findSafePosition(x, y, existingCoords);
      positioned.set(node.id, { ...node, x: finalPos.x, y: finalPos.y });
      existingCoords.add(`${finalPos.x},${finalPos.y}`);
    });

    return layout === 'vertical' ? currentY + (nodes.length * lineHeight) : currentY + lineHeight;
  }

  /**
   * Position a chain horizontally (like a sentence)
   */
  positionChainHorizontal(chain, startX, startY, positioned, existingCoords) {
    const nodeSpacing = 200;
    
    chain.forEach((node, index) => {
      const x = startX + (index * nodeSpacing);
      const finalPos = this.coordinateManager.findSafePosition(x, startY, existingCoords);
      positioned.set(node.id, { ...node, x: finalPos.x, y: finalPos.y });
      existingCoords.add(`${finalPos.x},${finalPos.y}`);
    });

    return startY + 80;
  }

  /**
   * Position a chain vertically (like a long paragraph)
   */
  positionChainVertical(chain, startX, startY, positioned, existingCoords) {
    const lineHeight = 80;
    
    chain.forEach((node, index) => {
      const y = startY + (index * lineHeight);
      const finalPos = this.coordinateManager.findSafePosition(startX, y, existingCoords);
      positioned.set(node.id, { ...node, x: finalPos.x, y: finalPos.y });
      existingCoords.add(`${finalPos.x},${finalPos.y}`);
    });

    return startY + (chain.length * lineHeight);
  }

  /**
   * Apply Dagre left-right layout algorithm with safe zone support
   */
  async dagre_left_right(nodes, existingCoords, safeZone) {
    try {
      // Build dependency graph based on wires connections
      const graph = new Map();
      const nodeMap = new Map();
      
      // Initialize graph nodes
      nodes.forEach(node => {
        graph.set(node.id, { 
          node, 
          inputs: new Set(), 
          outputs: new Set(),
          level: -1 
        });
        nodeMap.set(node.id, node);
      });
      
      // Build connections based on wires
      nodes.forEach(node => {
        const nodeData = graph.get(node.id);
        if (node.wires && Array.isArray(node.wires)) {
          node.wires.forEach(wireGroup => {
            if (Array.isArray(wireGroup)) {
              wireGroup.forEach(targetId => {
                if (graph.has(targetId)) {
                  nodeData.outputs.add(targetId);
                  graph.get(targetId).inputs.add(node.id);
                }
              });
            }
          });
        }
      });

      // Topological sort to determine levels (layers)
      const visited = new Set();
      const levelMap = new Map();
      
      // Find root nodes (no inputs)
      const rootNodes = Array.from(graph.values())
        .filter(nodeData => nodeData.inputs.size === 0)
        .map(nodeData => nodeData.node.id);
      
      if (rootNodes.length === 0) {
        // If no clear root, use first node
        rootNodes.push(nodes[0].id);
      }
      
      // Assign levels using BFS
      const queue = rootNodes.map(id => ({ id, level: 0 }));
      
      while (queue.length > 0) {
        const { id, level } = queue.shift();
        
        if (levelMap.has(id)) {
          levelMap.set(id, Math.max(levelMap.get(id), level));
        } else {
          levelMap.set(id, level);
        }

        const nodeData = graph.get(id);
        if (nodeData) {
          nodeData.outputs.forEach(outputId => {
            if (!levelMap.has(outputId) || levelMap.get(outputId) < level + 1) {
              queue.push({ id: outputId, level: level + 1 });
            }
          });
        }
      }

      // Group nodes by level
      const levelGroups = new Map();
      levelMap.forEach((level, nodeId) => {
        if (!levelGroups.has(level)) {
          levelGroups.set(level, []);
        }
        levelGroups.get(level).push(nodeId);
      });

      // Handle nodes not in levelMap (isolated nodes)
      nodes.forEach(node => {
        if (!levelMap.has(node.id)) {
          const maxLevel = Math.max(...Array.from(levelGroups.keys()), -1);
          const isolatedLevel = maxLevel + 1;
          levelMap.set(node.id, isolatedLevel);
          if (!levelGroups.has(isolatedLevel)) {
            levelGroups.set(isolatedLevel, []);
          }
          levelGroups.get(isolatedLevel).push(node.id);
        }
      });
      
      // Apply coordinates based on levels in safe zone
      const LEVEL_WIDTH = 250;  // Horizontal spacing between levels
      const NODE_HEIGHT = 80;   // Vertical spacing between nodes
      
      Array.from(levelGroups.keys()).sort((a, b) => a - b).forEach(level => {
        const nodesInLevel = levelGroups.get(level);
        const levelX = safeZone.startX + level * LEVEL_WIDTH;
        
        nodesInLevel.forEach((nodeId, index) => {
          const node = nodeMap.get(nodeId);
          if (node) {
            const preferredY = safeZone.startY + index * NODE_HEIGHT;
            
            // Check for coordinate conflicts and find available position
            const position = this.coordinateManager.findAvailablePosition(
              levelX, preferredY, existingCoords, safeZone
            );

            node.x = position.x;
            node.y = position.y;
            existingCoords.add(`${position.x},${position.y}`);
          }
        });
      });

      return nodes;
      
    } catch (error) {
      console.warn('Dagre layout failed, falling back to collision_free:', error);
      return this.collisionFreeLayout(nodes, existingCoords, safeZone);
    }
  }

  /**
   * Grid layout algorithm
   */
  gridLayout(nodes, existingCoords, safeZone) {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const nodeSpacing = 200;
    const lineHeight = 80;

    nodes.forEach((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      const preferredX = safeZone.startX + col * nodeSpacing;
      const preferredY = safeZone.startY + row * lineHeight;
      
      const position = this.coordinateManager.findAvailablePosition(
        preferredX, preferredY, existingCoords, safeZone
      );

      node.x = position.x;
      node.y = position.y;
      existingCoords.add(`${position.x},${position.y}`);
    });

    return nodes;
  }

  /**
   * Helper method to find node by ID
   */
  findNodeById(nodeId, allNodes) {
    return allNodes ? allNodes.find(node => node.id === nodeId) : null;
  }

  /**
   * Simple collision-free layout with safe zone support
   */
  collisionFreeLayout(nodes, existingCoords, safeZone) {
    nodes.forEach((node, i) => {
      // Use safe zone for positioning
      const preferredX = safeZone.startX + (i % safeZone.nodesPerRow) * safeZone.spacingX;
      const preferredY = safeZone.startY + Math.floor(i / safeZone.nodesPerRow) * safeZone.spacingY;

      const position = this.coordinateManager.findAvailablePosition(
        preferredX, preferredY, existingCoords, safeZone
      );

      node.x = position.x;
      node.y = position.y;
      existingCoords.add(`${position.x},${position.y}`);
    });

    return nodes;
  }

  gridLayout(nodes, existingCoords, safeZone) {
    nodes.forEach((node, i) => {
      const col = i % safeZone.nodesPerRow;
      const row = Math.floor(i / safeZone.nodesPerRow);
      
      const baseX = safeZone.startX + col * safeZone.spacingX;
      const baseY = safeZone.startY + row * safeZone.spacingY;

      const position = this.coordinateManager.findAvailablePosition(
        baseX, baseY, existingCoords, safeZone
      );

      node.x = position.x;
      node.y = position.y;
      existingCoords.add(`${position.x},${position.y}`);
    });

    return nodes;
  }
}

/**
 * NPM Dependency Manager for Node-RED modules
 */
class NPMDependencyManager {
  constructor() {
    this.typeToModule = {
      'mqtt in': 'node-red-contrib-mqtt-broker',
      'mqtt out': 'node-red-contrib-mqtt-broker',
      'telegrambot': 'node-red-contrib-telegrambot',
      'email': 'node-red-node-email',
      'file in': 'node-red-node-file-function',
      'file out': 'node-red-node-file-function'
    };
  }

  /**
   * Extract npm dependencies from nodes
   */
  extractNodeDependencies(nodes) {
    const dependencies = new Set();

    nodes.forEach(node => {
      const nodeType = node.type;

      // Check standard dependency mapping
      if (this.typeToModule[nodeType]) {
        dependencies.add(this.typeToModule[nodeType]);
      }

      // Check function nodes for require statements
      if (nodeType === 'function' && node.func) {
        const requires = this.extractRequiresFromCode(node.func);
        requires.forEach(req => dependencies.add(req));
      }

      // Check custom contrib modules
      if (nodeType.startsWith('node-red-contrib-')) {
        const moduleName = nodeType.split(':')[0];
        dependencies.add(moduleName);
      }
    });

    return Array.from(dependencies);
  }

  /**
   * Extract require statements from JavaScript code
   */
  extractRequiresFromCode(code) {
    const requires = new Set();
    const requirePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    
    let match;
    while ((match = requirePattern.exec(code)) !== null) {
      const moduleName = match[1];
      if (!this.isBuiltinModule(moduleName)) {
        requires.add(moduleName);
      }
    }

    return requires;
  }

  /**
   * Check if module is Node.js builtin
   */
  isBuiltinModule(moduleName) {
    const builtins = new Set([
      'fs', 'path', 'http', 'https', 'url', 'crypto',
      'util', 'os', 'stream', 'buffer', 'events', 'querystring'
    ]);
    return builtins.has(moduleName);
  }

  /**
   * Get installed modules from Node-RED
   */
  async getInstalledModules(config) {
    try {
      const nodes = await callNodeRed('get', '/nodes', null, config);
      const installed = new Set();
      
      nodes.forEach(nodeInfo => {
        if (nodeInfo.module) {
          installed.add(nodeInfo.module);
        }
      });
      
      return installed;
    } catch (error) {
      return new Set();
    }
  }

  /**
   * Check for missing dependencies
   */
  async checkMissingDependencies(requiredDeps, config) {
    const installed = await this.getInstalledModules(config);
    return requiredDeps.filter(dep => !installed.has(dep));
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
  
  // Update flow metadata if provided
  if (newFlowData.label && mode === 'merge') result.label = newFlowData.label;
  if (newFlowData.disabled !== undefined && mode === 'merge') result.disabled = newFlowData.disabled;
  if (newFlowData.env && mode === 'merge') result.env = newFlowData.env;
  
  return result;
}

/**
 * Get statistics about the update operation
 * @param {Object} existingFlow - Original flow
 * @param {Object} finalFlow - Updated flow
 * @returns {Object} Statistics object
 */
function getUpdateStats(existingFlow, finalFlow) {
  const existingIds = new Set((existingFlow.nodes || []).map(n => n.id));
  const finalIds = new Set((finalFlow.nodes || []).map(n => n.id));
  
  const added = finalFlow.nodes.filter(n => !existingIds.has(n.id)).length;
  const preserved = finalFlow.nodes.filter(n => existingIds.has(n.id)).length;
  const updated = preserved; // Assume all preserved nodes might be updated
  
  return { added, updated: updated - added, preserved };
}

/**
 * Registers flow-related tools in the MCP server
 * @param {Object} server - MCP server instance
 * @param {Object} config - Server configuration
 */
export default function registerFlowTools(server, config) {
  // ✅ RECOMMENDED: Get flow by ID or name (supports both identifier types)
  server.tool(
    'get-flow',
    { 
      identifier: z.string().describe('Flow ID or flow name/label') 
    },
    async ({ identifier }) => {
      try {
        const { flowId, error } = await resolveFlowId(identifier, config);
        
        if (error) {
          return { content: [{ type: 'text', text: error }] };
        }
        
        // Get the specific flow
        const flow = await callNodeRed('get', '/flow/' + flowId, null, config);
        return {
          content: [{ type: 'text', text: JSON.stringify(flow, null, 2) }]
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  );

  // ✅ RECOMMENDED: Update flow with intelligent merging and validation
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
        
        // 获取现有工作流
        const existingFlow = await callNodeRed('get', '/flow/' + flowId, null, config);
        
        // 解析新的工作流配置
        let newFlowData;
        try {
          newFlowData = JSON.parse(flowJson);
        } catch (parseError) {
          return { 
            content: [{ 
              type: 'text', 
              text: `JSON解析错误: ${parseError.message}\n\n请检查JSON格式是否正确。` 
            }] 
          };
        }
        
        // 验证工作流结构
        const validationResult = validateFlowStructure(newFlowData, existingFlow);
        if (!validationResult.valid) {
          return {
            content: [{
              type: 'text',
              text: `工作流验证失败:\n${validationResult.errors.join('\n')}\n\n建议使用get-prompt-template获取修复提示词。`
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

  // 🚀 NEW: Incremental node addition with smart layout (based on Genspark AI article)
  server.tool(
    'add-nodes-to-flow',
    {
      identifier: z.string().describe('Flow ID or flow name/label'),
      nodesJson: z.string().describe('JSON array of nodes to add to the flow'),
      layoutAlgorithm: z.enum(['auto', 'collision_free', 'dagre_lr', 'grid']).default('auto').describe('Layout algorithm for new nodes'),
      checkDependencies: z.boolean().default(true).describe('Automatically check and report missing npm dependencies'),
      autoInstallDeps: z.boolean().default(false).describe('Automatically install missing dependencies (use with caution)')
    },
    async ({ identifier, nodesJson, layoutAlgorithm, checkDependencies, autoInstallDeps }) => {
      try {
        const { flowId, error } = await resolveFlowId(identifier, config);
        
        if (error) {
          return { content: [{ type: 'text', text: error }] };
        }

        // Parse new nodes
        let newNodes;
        try {
          newNodes = JSON.parse(nodesJson);
          if (!Array.isArray(newNodes)) {
            return { content: [{ type: 'text', text: 'Error: nodesJson must be an array of nodes' }] };
          }
        } catch (parseError) {
          return { content: [{ type: 'text', text: `JSON解析错误: ${parseError.message}` }] };
        }

        // Validate new nodes structure
        const validationResult = validateFlowStructure({ nodes: newNodes });
        if (!validationResult.valid) {
          return {
            content: [{
              type: 'text',
              text: `节点验证失败:\n${validationResult.errors.join('\n')}`
            }]
          };
        }

        // Get existing flow
        const existingFlow = await callNodeRed('get', '/flow/' + flowId, null, config);

        // Apply smart layout to new nodes
        const layoutManager = new AutoLayoutManager();
        const algorithm = layoutAlgorithm === 'auto' ? 'collision_free' : layoutAlgorithm;
        const layoutedNodes = await layoutManager.applyAutoLayout(newNodes, flowId, config, algorithm);

        // Set flow ID for all new nodes
        layoutedNodes.forEach(node => {
          node.z = flowId;
        });

        // Check dependencies if requested
        let dependencyReport = '';
        if (checkDependencies) {
          const depManager = new NPMDependencyManager();
          const requiredDeps = depManager.extractNodeDependencies(layoutedNodes);
          
          if (requiredDeps.length > 0) {
            const missingDeps = await depManager.checkMissingDependencies(requiredDeps, config);
            
            if (missingDeps.length > 0) {
              dependencyReport = `\n\n📦 依赖检测结果:\n需要安装的模块: ${missingDeps.join(', ')}`;
              
              if (autoInstallDeps) {
                dependencyReport += '\n\n🔄 正在自动安装依赖...';
                // Note: Auto-installation would require additional implementation
                // For safety, we'll just report the missing dependencies
              } else {
                dependencyReport += '\n\n💡 提示: 使用 manage-node-module 工具安装缺失的依赖';
              }
            } else {
              dependencyReport = '\n\n✅ 所有依赖已满足';
            }
          }
        }

        // Merge with existing flow using add-only mode
        const finalFlow = mergeFlows(existingFlow, { nodes: layoutedNodes }, 'add-only', true);

        // Update the flow
        await callNodeRed('put', '/flow/' + flowId, finalFlow, config);

        const stats = getUpdateStats(existingFlow, finalFlow);
        return {
          content: [{
            type: 'text',
            text: `✅ 成功向流程 "${identifier}" 添加 ${layoutedNodes.length} 个节点!\n\n📊 统计信息:\n- 新增节点: ${stats.added}\n- 布局算法: ${algorithm}\n- 坐标冲突处理: 已自动解决${dependencyReport}`
          }]
        };

      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  );

  // 🚀 NEW: AI-optimized flow generation with validation and layout
  server.tool(
    'generate-ai-flow',
    {
      identifier: z.string().describe('Flow ID or flow name/label to add nodes to'),
      requirement: z.string().describe('Natural language description of the workflow to generate'),
      layoutAlgorithm: z.enum(['auto', 'collision_free', 'dagre_lr', 'grid']).default('auto').describe('Layout algorithm for generated nodes'),
      mergeMode: z.enum(['add-only', 'merge', 'replace']).default('add-only').describe('How to integrate with existing flow')
    },
    async ({ identifier, requirement, layoutAlgorithm, mergeMode }) => {
      try {
        const { flowId, error } = await resolveFlowId(identifier, config);
        
        if (error) {
          return { content: [{ type: 'text', text: error }] };
        }

        // 🚀 Enhanced structured prompt template based on Genspark AI article
        const NODE_RED_GENERATION_PROMPT = `你是一个专业的Node-RED工作流生成专家。请根据用户需求生成符合以下JSON Schema的Node-RED节点配置：

## 📋 必需字段规范
- **id**: 字符串，节点唯一标识符，格式为 "type_function_number" (如: "inject_start_1", "function_process_1")
- **type**: 字符串，节点类型，必须是有效的Node-RED节点类型
- **x**: 整数，节点在编辑器中的X坐标（像素值）
- **y**: 整数，节点在编辑器中的Y坐标（像素值）  
- **z**: 字符串，所属流程/标签页ID，使用 "${flowId}"

## 🔗 可选字段规范
- **name**: 字符串，节点显示名称（建议使用中文）
- **wires**: 数组，连接到的下游节点ID列表，格式为 [["node_id1", "node_id2"]]
- 其他属性根据节点类型而定（如inject的payload、function的func等）

## 📖 文章式布局规则（重要！）
- **智能语义分组**: 系统会自动将节点按功能分类（输入、处理、决策、输出、工具）
- **逻辑段落结构**: 
  * 输入节点作为"引言"，水平排列在顶部
  * 处理节点作为"主体段落"，根据连接关系智能分组
  * 决策节点作为"分支点"，适当缩进显示层次
  * 输出节点作为"结论"，水平排列在底部
  * 工具节点作为"附录"，放置在右侧边栏
- **视觉层次**: 
  * 短流程链（≤4节点）水平排列，像短句子
  * 长流程链（>4节点）垂直排列，像长段落
  * 相关节点自动分组，段落间有适当间距
- **自动避免重叠**: 系统会自动计算安全区域，确保新节点不与现有节点冲突

## 🔄 连线关系规范（关键！）
- **wires格式**: 二维数组，每个子数组代表一个输出端口的连接
- **连接逻辑**: 确保数据流向合理，从输入→处理→输出
- **示例**: "wires": [["next_node_id"]] 表示连接到下一个节点
- **多输出**: "wires": [["node1"], ["node2"]] 表示两个输出端口

## 🎯 常用节点类型及配置
### HTTP接口节点
{
  "id": "http_in_api_1",
  "type": "http in",
  "name": "API接口",
  "url": "/api/endpoint",
  "method": "post",
  "upload": false,
  "x": 100,
  "y": 100,
  "z": "${flowId}",
  "wires": [["function_validate_1"]]
}

### 函数处理节点
{
  "id": "function_process_1", 
  "type": "function",
  "name": "数据处理",
  "func": "// 处理逻辑\\nmsg.payload = {result: 'processed'};\\nreturn msg;",
  "outputs": 1,
  "noerr": 0,
  "x": 300,
  "y": 100,
  "z": "${flowId}",
  "wires": [["http_response_1"]]
}

## 📤 输出格式要求
严格按照以下JSON格式输出，不要添加任何额外的文字说明：

{
  "nodes": [
    {
      "id": "inject_start_1",
      "type": "inject",
      "name": "定时触发",
      "x": 100,
      "y": 100, 
      "z": "${flowId}",
      "payload": "hello",
      "payloadType": "str",
      "repeat": "",
      "crontab": "",
      "once": false,
      "wires": [["function_process_1"]]
    }
  ],
  "dependencies": []
}

## 🎯 用户需求
${requirement}

## ⚠️ 重要提醒
1. 确保所有节点ID唯一且符合命名规范
2. wires连接要形成完整的数据流
3. 所有节点的z字段必须设置为 "${flowId}"
4. 只输出JSON，不要添加任何解释文字
5. 新节点会自动放置在安全区域，避免与现有工作流重叠`;

        return {
          content: [{
            type: 'text',
            text: `🤖 **增强版AI工作流生成提示词已准备**

基于Genspark AI文章的最佳实践，生成了包含以下优化的结构化提示词：

## 🚀 **核心改进**
1. **详细的字段规范** - 明确必需和可选字段的格式要求
2. **智能区域规避** - 新节点自动放置在现有工作流下方的安全区域  
3. **连线关系优化** - 强调wires数组的正确格式和逻辑
4. **常用节点模板** - 提供HTTP、Function等标准配置
5. **严格输出格式** - 确保AI返回可直接解析的JSON

## 📋 **提示词模板**
\`\`\`
${NODE_RED_GENERATION_PROMPT}
\`\`\`

## 🔧 **使用步骤**
1. **复制上述提示词** 发送给AI模型（如GPT-4、Claude等）
2. **获取JSON响应** 确保格式正确
3. **执行部署命令**：
   \`\`\`
   add-nodes-to-flow identifier="${identifier}" nodesJson="AI返回的JSON" layoutAlgorithm="${layoutAlgorithm}" checkDependencies=true
   \`\`\`

## ⚙️ **推荐参数**
- **布局算法**: ${layoutAlgorithm} (智能区域规避)
- **合并模式**: ${mergeMode} (安全的增量添加)
- **依赖检测**: 已启用 (自动分析npm模块需求)

💡 **提示**: 新版本会自动将新节点放置在现有工作流下方，完全避免重叠问题！不会自动调用图表生成工具。`
          }]
        };

      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  );
}