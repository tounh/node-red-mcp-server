/**
 * MCP tools for Node-RED system information and utilities
 * 合并了设置、诊断、API帮助和认证管理功能
 */

import { z } from 'zod';
import { callNodeRed, getAuthManager } from '../utils.mjs';

/**
 * Registers system-related tools in the MCP server
 * @param {Object} server - MCP server instance
 * @param {Object} config - Server configuration
 */
export default function registerSystemTools(server, config) {
  // ✅ RECOMMENDED: Retrieve system information (unified settings/diagnostics/runtime/version)
  server.tool(
    'get-system-info',
    {
      type: z.enum(['settings', 'diagnostics', 'runtime', 'version', 'all']).default('all').describe('Type of system info: settings (runtime settings), diagnostics (system diagnostics), runtime (runtime info), version (version info), all (combined)')
    },
    async ({ type }) => {
      try {
        if (type === 'settings') {
          const settings = await callNodeRed('get', '/settings', null, config);
          return {
            content: [{ type: 'text', text: JSON.stringify(settings, null, 2) }]
          };
        } else if (type === 'diagnostics') {
          const diagnostics = await callNodeRed('get', '/diagnostics', null, config);
          return {
            content: [{ type: 'text', text: JSON.stringify(diagnostics, null, 2) }]
          };
        } else if (type === 'runtime') {
          const runtime = await callNodeRed('get', '', null, config);
          return {
            content: [{ type: 'text', text: JSON.stringify(runtime, null, 2) }]
          };
        } else if (type === 'version') {
          const version = await callNodeRed('get', '/version', null, config);
          return {
            content: [{ type: 'text', text: JSON.stringify(version, null, 2) }]
          };
        } else { // type === 'all'
          const [settings, diagnostics, runtime, version] = await Promise.all([
            callNodeRed('get', '/settings', null, config),
            callNodeRed('get', '/diagnostics', null, config),
            callNodeRed('get', '', null, config),
            callNodeRed('get', '/version', null, config)
          ]);
          
          const combined = {
            runtime: runtime,
            version: version,
            settings: settings,
            diagnostics: diagnostics,
            timestamp: new Date().toISOString()
          };
          
          return {
            content: [{ type: 'text', text: JSON.stringify(combined, null, 2) }]
          };
        }
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  );



  // ✅ RECOMMENDED: Unified Authentication Management Tool
  server.tool(
    'auth',
    {
      action: z.enum(['status', 'refresh']).default('status').describe('Action: status (check auth status), refresh (refresh token if using dynamic auth)')
    },
    async ({ action }) => {
      try {
        const result = {
          authMethod: 'none',
          tokenStatus: 'not configured',
          details: {}
        };

        // Determine authentication method
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

        // Handle different actions
        if (action === 'refresh') {
          // Only allow refresh for dynamic authentication
          if (config.nodeRedUsername && config.nodeRedPassword) {
            try {
              const authManager = getAuthManager();
              const newToken = await authManager.refreshToken();
              const newStatus = authManager.getTokenStatus();

              const output = [
                '# Token Refresh Successful',
                '',
                '✅ New token obtained successfully!',
                '',
                `**Authentication Method:** ${result.authMethod}`,
                `**Expires At:** ${newStatus.expiresAt}`,
                `**Remaining Hours:** ${newStatus.remainingHours}`,
                `**Token Preview:** ${newToken.substring(0, 20)}...`,
                '',
                '## Updated Token Details',
                '```json',
                JSON.stringify({
                  hasToken: newStatus.hasToken,
                  isValid: newStatus.isValid,
                  source: newStatus.source,
                  expiresAt: newStatus.expiresAt,
                  remainingHours: newStatus.remainingHours,
                  obtainedAt: newStatus.obtainedAt
                }, null, 2),
                '```'
              ];

              return { content: [{ type: 'text', text: output.join('\n') }] };
            } catch (error) {
              return { 
                content: [{ 
                  type: 'text', 
                  text: `❌ Token refresh failed: ${error.message}\n\n**Current Status:**\n- Auth Method: ${result.authMethod}\n- Token Status: ${result.tokenStatus}` 
                }] 
              };
            }
          } else {
            return {
              content: [{
                type: 'text',
                text: `❌ Token refresh not available\n\n**Reason:** Token refresh is only available for dynamic authentication (username/password).\n**Current Method:** ${result.authMethod}\n\nTo use token refresh, configure NODE_RED_USERNAME and NODE_RED_PASSWORD instead of NODE_RED_TOKEN.`
              }]
            };
          }
        } else {
          // Default action: show status
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

          // Add refresh hint for dynamic auth
          if (config.nodeRedUsername && config.nodeRedPassword) {
            output.push('');
            output.push('💡 **Tip:** Use `auth(action: "refresh")` to refresh the token if needed.');
          }

          return { content: [{ type: 'text', text: output.join('\n') }] };
        }
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  );
} 