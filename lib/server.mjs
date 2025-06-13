/**
 * MCP server for Node-RED
 * Allows language models to interact with Node-RED through the MCP protocol
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import 'dotenv/config';
import axios from 'axios';

// Import tool registrars
import registerFlowTools from './tools/flows.mjs';
import registerNodeTools from './tools/nodes.mjs';
import registerSystemTools from './tools/system.mjs';
import registerMermaidTools from './tools/mermaid.mjs';
import registerPromptTools from './tools/prompts.mjs';
import { initializeAuth, getAuthManager } from './utils.mjs';

/**
 * Default server settings
 */
const defaultConfig = {
  serverName: 'node-red-mcp-server',
  serverVersion: '1.0.0',
  nodeRedUrl: 'http://localhost:1880',
  nodeRedToken: '',
  nodeRedUsername: '',
  nodeRedPassword: '',
  transportType: 'stdio',
  verbose: false
};

/**
 * Creates and configures an MCP server for Node-RED
 * @param {Object} userConfig - User configuration
 * @returns {Object} Object with start method and other utilities
 */
export function createServer(userConfig = {}) {
  // Merge configuration
  const config = {
    ...defaultConfig,
    ...userConfig,
    nodeRedUrl: userConfig.nodeRedUrl || process.env.NODE_RED_URL || defaultConfig.nodeRedUrl,
    nodeRedToken: userConfig.nodeRedToken || process.env.NODE_RED_TOKEN || defaultConfig.nodeRedToken,
    nodeRedUsername: userConfig.nodeRedUsername || process.env.NODE_RED_USERNAME || defaultConfig.nodeRedUsername,
    nodeRedPassword: userConfig.nodeRedPassword || process.env.NODE_RED_PASSWORD || defaultConfig.nodeRedPassword
  };

  // Create MCP server
  const server = new McpServer({
    name: config.serverName,
    version: config.serverVersion
  });

  // Register all tools (极简版 - 合并系统工具，专注核心功能)
  // ✅ 核心功能: 单流程CRUD操作、节点管理、系统诊断
  // ✅ 图表工具: 基础流程图生成（已精简）
  // ✅ 系统工具: 设置、诊断、API帮助、认证管理（已合并）
  // ✅ 提示词工具: Node-RED工作流生成和错误修复专业提示词
  // ❌ 已移除: 所有bulk operations、复杂算法、辅助工具
  registerFlowTools(server, config);
  registerNodeTools(server, config);
  registerSystemTools(server, config);
  registerMermaidTools(server, config);
  registerPromptTools(server, config);

  /**
   * Tests the connection to Node-RED
   * @returns {Promise<boolean>} True if connection is successful
   */
  async function testNodeRedConnection() {
    try {
      let headers = {};
      
      // Use authentication manager if username/password are provided
      if (config.nodeRedUsername && config.nodeRedPassword) {
        try {
          // Initialize auth manager if not already done
          let authManager;
          try {
            authManager = getAuthManager();
          } catch {
            initializeAuth(config);
            authManager = getAuthManager();
          }
          headers = await authManager.getAuthHeaders();
        } catch (authError) {
          if (config.verbose) {
            console.error('Connection test authentication failed:', authError.message);
          }
          return false;
        }
      } else if (config.nodeRedToken) {
        headers = { 'Authorization': 'Bearer ' + config.nodeRedToken };
      }
      
      await axios.get(config.nodeRedUrl, { headers, timeout: 5000 });
      return true;
    } catch (error) {
      if (config.verbose) {
        console.error('Connection test failed:', error.message);
      }
      return false;
    }
  }

  /**
   * Starts the MCP server
   * @returns {Promise<void>}
   */
  async function start() {
    // Initialize authentication manager if credentials are provided
    if (config.nodeRedUsername && config.nodeRedPassword) {
      initializeAuth(config);
      
      if (config.verbose) {
        console.log('🔐 Initialized dynamic token authentication');
        
        // Test token acquisition
        try {
          const authManager = getAuthManager();
          await authManager.getValidToken();
          const status = authManager.getTokenStatus();
          console.log(`✅ Token acquired successfully! Expires in ${status.remainingHours} hours`);
        } catch (error) {
          console.error('⚠️ Token acquisition failed:', error.message);
        }
      }
    }

    // Test Node-RED connection but don't stop if it fails
    try {
      const connected = await testNodeRedConnection();
      if (config.verbose) {
        console.log(connected ? '✅ Node-RED connection test passed' : '⚠️ Node-RED connection test failed');
      }
    } catch (_) {
      // Ignore errors
    }

    // Create transport based on settings
    let transport;

    if (config.transportType === 'stdio') {
      transport = new StdioServerTransport();
    } else {
      throw new Error(`Unsupported transport type: ${config.transportType}`);
    }

    // Connect server through transport
    await server.connect(transport);
    
    if (config.verbose) {
      console.log('🚀 Node-RED MCP Server started successfully');
    }
  }

  return {
    server,
    config,
    start,
    testNodeRedConnection
  };
}

// If this file is run directly (not imported as a module)
if (import.meta.url.startsWith('file:') && import.meta.url === `file://${process.argv[1]}`) {
  try {
    const server = createServer();
    server.start();
  } catch (err) {
    process.exit(1);
  }
}

export { defaultConfig };
