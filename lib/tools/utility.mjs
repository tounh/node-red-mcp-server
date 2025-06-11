/**
 * MCP Utility Tools for Node-RED
 */

import { getAuthManager } from '../utils.mjs';

/**
 * Registers utility tools on the MCP server
 * @param {Object} server - Instance of the MCP server
 * @param {Object} config - Server configuration
 */
export default function registerUtilityTools(server, config) {
  // Node-RED API Help
  server.tool(
    'api-help',
    {},
    async () => {
      const endpoints = [
        { method: 'GET', path: '/flows', description: 'Get all flows' },
        { method: 'POST', path: '/flows', description: 'Update all flows' },
        { method: 'GET', path: '/flow/:id', description: 'Get a specific flow' },
        { method: 'PUT', path: '/flow/:id', description: 'Update a specific flow' },
        { method: 'DELETE', path: '/flow/:id', description: 'Delete a specific flow' },
        { method: 'POST', path: '/flow', description: 'Create a new flow' },
        { method: 'GET', path: '/flows/state', description: 'Get the state of flows' },
        { method: 'POST', path: '/flows/state', description: 'Set the state of flows' },
        { method: 'GET', path: '/nodes', description: 'Get list of installed nodes' },
        { method: 'POST', path: '/nodes', description: 'Install a new node module' },
        { method: 'GET', path: '/settings', description: 'Get runtime settings' },
        { method: 'GET', path: '/diagnostics', description: 'Get diagnostics information' },
        { method: 'POST', path: '/inject/:id', description: 'Trigger an inject node' }
      ];

      // Check implemented methods
      const implementedMethods = {
        'GET /flows': true,
        'POST /flows': true,
        'GET /flow/:id': true,
        'PUT /flow/:id': true,
        'POST /inject/:id': true,
        'POST /flow': true,
        'DELETE /flow/:id': true,
        'GET /flows/state': true,
        'POST /flows/state': true,
        'GET /nodes': true,
        'GET /settings': true,
        'GET /diagnostics': true
      };

      const output = [
        '# Node-RED API Help',
        '',
        '| Method | Path | Description | Implemented in MCP |',
        '|--------|------|-------------|---------------------|'
      ];

      endpoints.forEach(endpoint => {
        const key = `${endpoint.method} ${endpoint.path}`;
        output.push(`| ${endpoint.method} | ${endpoint.path} | ${endpoint.description} | ${implementedMethods[key] ? '✅' : '❌'} |`);
      });

      return { content: [{ type: 'text', text: output.join('\n') }] };
    }
  );

  // Authentication Status Tool
  server.tool(
    'auth-status',
    {},
    async () => {
      const result = {
        authMethod: 'none',
        tokenStatus: 'not configured',
        details: {}
      };

      if (config.nodeRedUsername && config.nodeRedPassword) {
        result.authMethod = 'dynamic (username/password)';
        
        try {
          const authManager = getAuthManager();
          const status = authManager.getTokenStatus();
          
          result.tokenStatus = status.isValid ? 'valid' : 'invalid/expired';
          result.details = {
            hasToken: status.hasToken,
            isValid: status.isValid,
            source: status.source,
            expiresAt: status.expiresAt,
            remainingHours: status.remainingHours,
            obtainedAt: status.obtainedAt
          };
        } catch (error) {
          result.tokenStatus = 'error';
          result.details = { error: error.message };
        }
      } else if (config.nodeRedToken) {
        result.authMethod = 'static token';
        result.tokenStatus = 'configured';
        result.details = { note: 'Static token validity cannot be checked without API call' };
      }

      const output = [
        '# Node-RED Authentication Status',
        '',
        `**Authentication Method:** ${result.authMethod}`,
        `**Token Status:** ${result.tokenStatus}`,
        '',
        '## Details',
        '```json',
        JSON.stringify(result.details, null, 2),
        '```'
      ];

      return { content: [{ type: 'text', text: output.join('\n') }] };
    }
  );

  // Token Refresh Tool
  if (config.nodeRedUsername && config.nodeRedPassword) {
    server.tool(
      'refresh-token',
      {},
      async () => {
        try {
          const authManager = getAuthManager();
          const newToken = await authManager.refreshToken();
          const status = authManager.getTokenStatus();

          const output = [
            '# Token Refresh Successful',
            '',
            '✅ New token obtained successfully!',
            '',
            `**Expires At:** ${status.expiresAt}`,
            `**Remaining Hours:** ${status.remainingHours}`,
            `**Token Preview:** ${newToken.substring(0, 20)}...`
          ];

          return { content: [{ type: 'text', text: output.join('\n') }] };
        } catch (error) {
          return { 
            content: [{ 
              type: 'text', 
              text: `❌ Token refresh failed: ${error.message}` 
            }] 
          };
        }
      }
    );
  }
}
