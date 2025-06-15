/**
 * Utility tools for the Node-RED MCP server
 */

import axios from 'axios';
import NodeRedAuth from './auth.mjs';

// Global authentication manager instance
let authManager = null;

/**
 * Initialize the authentication manager
 * @param {Object} config - Server configuration
 */
export function initializeAuth(config) {
  authManager = new NodeRedAuth(config);
}

/**
 * Get the authentication manager instance
 * @returns {NodeRedAuth} auth manager
 */
export function getAuthManager() {
  if (!authManager) {
    throw new Error('Authentication manager not initialized. Call initializeAuth first.');
  }
  return authManager;
}

/**
 * Call the Node-RED API with automatic token management
 * @param {string} method - HTTP method (get, post, put, delete)
 * @param {string} path - API path
 * @param {Object|null} data - Data to send (optional)
 * @param {Object} config - Connection configuration
 * @param {string} responseType - Response type ('json' or 'text'), default is 'json'
 * @returns {Promise<any>} Result of the API call
 */
export async function callNodeRed(method, path, data = null, config, responseType = 'json') {
  const url = config.nodeRedUrl + path;
  
  let headers = {};
  
  // Use authentication manager if username/password are provided
  if (config.nodeRedUsername && config.nodeRedPassword) {
    if (!authManager) {
      initializeAuth(config);
    }
    
    try {
      headers = await authManager.getAuthHeaders();
    } catch (authError) {
      if (config.verbose) {
        console.error('🚫 Authentication failed:', authError.message);
      }
      throw new Error(`Authentication failed: ${authError.message}`);
    }
  } else if (config.nodeRedToken) {
    // Use static token if provided
    headers = { 'Authorization': 'Bearer ' + config.nodeRedToken };
  }

  try {
    const axiosConfig = { method, url, headers, data, timeout: 30000 };
    if (responseType === 'text') {
      axiosConfig.responseType = 'text';
    }
    const response = await axios(axiosConfig);
    return response.data;
  } catch (error) {
    // Handle authentication errors specifically
    if (error.response?.status === 401) {
      if (authManager && config.nodeRedUsername) {
        // Clear invalid token and retry once
        authManager.clearToken();
        if (config.verbose) {
          console.log('🔄 Token expired, retrying with fresh token...');
        }
        
        try {
          headers = await authManager.getAuthHeaders();
          const retryAxiosConfig = { method, url, headers, data, timeout: 30000 };
          if (responseType === 'text') {
            retryAxiosConfig.responseType = 'text';
          }
          const retryResponse = await axios(retryAxiosConfig);
          return retryResponse.data;
        } catch (retryError) {
          const message = retryError.response?.data || retryError.message;
          throw new Error(`Node-RED API authentication error: ${message}`);
        }
      } else {
        throw new Error('Node-RED API authentication failed. Check your credentials.');
      }
    }
    
    const message = error.response?.data || error.message;
    throw new Error(`Node-RED API error: ${message}`);
  }
}

/**
 * Format output of Node-RED flows
 * @param {Array} flows - Array of Node-RED flows
 * @returns {Object} Formatted data with statistics
 */
export function formatFlowsOutput(flows) {
  // Grouping by type
  const result = {
    tabs: flows.filter(n => n.type === 'tab'),
    nodes: flows.filter(n => n.type !== 'tab' && n.type !== 'subflow'),
    subflows: flows.filter(n => n.type === 'subflow')
  };

  // Statistics
  const stats = {
    tabCount: result.tabs.length,
    nodeCount: result.nodes.length,
    subflowCount: result.subflows.length,
    nodeTypes: {}
  };

  result.nodes.forEach(node => {
    if (!stats.nodeTypes[node.type]) stats.nodeTypes[node.type] = 0;
    stats.nodeTypes[node.type]++;
  });

  return {
    summary: `Node-RED project: ${stats.tabCount} tabs, ${stats.nodeCount} nodes, ${stats.subflowCount} subflows`,
    statistics: stats,
    data: result
  };
}
