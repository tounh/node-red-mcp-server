/**
 * MCP tools for working with Node-RED nodes
 */

import { z } from 'zod';
import { callNodeRed } from '../utils.mjs';

/**
 * Registers node-related tools in the MCP server
 * @param {Object} server - MCP server instance
 * @param {Object} config - Server configuration
 */
export default function registerNodeTools(server, config) {
  // ✅ RECOMMENDED: Trigger inject node (efficient, targeted operation)
  server.tool(
    'inject',
    { id: z.string().describe('Inject node ID') },
    async ({ id }) => {
      await callNodeRed('post', '/inject/' + id, null, config);
      return { content: [{ type: 'text', text: `Inject node ${id} triggered` }] };
    }
  );

  // ✅ RECOMMENDED: Get list of installed node modules (efficient)
  server.tool(
    'get-nodes',
    {},
    async () => {
      const nodes = await callNodeRed('get', '/nodes', null, config);
      return {
        content: [{ type: 'text', text: JSON.stringify(nodes, null, 2) }]
      };
    }
  );

  // ✅ RECOMMENDED: Get information about a specific module
  server.tool(
    'get-node-info',
    { module: z.string().describe('Node module name') },
    async ({ module }) => {
      const info = await callNodeRed('get', '/nodes/' + module, null, config);
      return {
        content: [{ type: 'text', text: JSON.stringify(info, null, 2) }]
      };
    }
  );

  // ✅ RECOMMENDED: Node module management (install/uninstall/enable/disable)
  server.tool(
    'manage-node-module',
    {
      module: z.string().describe('Node module name'),
      action: z.enum(['install', 'uninstall', 'enable', 'disable']).describe('Action to perform on the module'),
      version: z.string().optional().describe('Specific version to install (optional, only for install action)')
    },
    async ({ module, action, version }) => {
      try {
        let result;
        
        switch (action) {
          case 'install':
            const installData = { module };
            if (version) {
              installData.version = version;
            }
            result = await callNodeRed('post', '/nodes', installData, config);
            return {
              content: [{
                type: 'text',
                text: `Module ${module}${version ? `@${version}` : ''} installed successfully`
              }]
            };
            
          case 'uninstall':
            await callNodeRed('delete', '/nodes/' + module, null, config);
            return {
              content: [{
                type: 'text',
                text: `Module ${module} uninstalled successfully`
              }]
            };
            
          case 'enable':
          case 'disable':
            const enabled = action === 'enable';
            await callNodeRed('put', '/nodes/' + module, { enabled }, config);
            return {
              content: [{
                type: 'text',
                text: `Module ${module} ${enabled ? 'enabled' : 'disabled'} successfully`
              }]
            };
            
          default:
            return { content: [{ type: 'text', text: `Error: Invalid action "${action}"` }] };
        }
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  );

  // ⚠️ BULK OPERATION: Search nodes (requires loading all flows - use efficiently)
  server.tool(
    'search-nodes',
    {
      query: z.string().describe('Search term: node type, name, or property value'),
      searchType: z.enum(['type', 'name', 'property', 'any']).default('any').describe('Search mode: type (exact node type match), name (node name contains), property (search in all properties), any (search everywhere)'),
      property: z.string().optional().describe('Specific property to search in (when searchType is "property")'),
      flowId: z.string().optional().describe('Limit search to specific flow ID (more efficient than searching all flows)')
    },
    async ({ query, searchType, property, flowId }) => {
      try {
        let flows;
        let searchScope = 'all flows';
        
        if (flowId) {
          // More efficient: search only in specific flow
          const flow = await callNodeRed('get', '/flow/' + flowId, null, config);
          flows = flow.nodes || [];
          searchScope = `flow ${flowId}`;
        } else {
          // Less efficient: search in all flows
          flows = await callNodeRed('get', '/flows', null, config);
        }

        let nodes = [];

        switch (searchType) {
          case 'type':
            nodes = flows.filter(node => node.type === query);
            break;
          case 'name':
            nodes = flows.filter(node => 
              node.name && node.name.toLowerCase().includes(query.toLowerCase())
            );
            break;
          case 'property':
            if (!property) {
              return { content: [{ type: 'text', text: 'Error: property parameter required when searchType is "property"' }] };
            }
            nodes = flows.filter(node => 
              node[property] && String(node[property]).toLowerCase().includes(query.toLowerCase())
            );
            break;
          case 'any':
          default:
            nodes = flows.filter(node => {
              const nodeStr = JSON.stringify(node).toLowerCase();
              return nodeStr.includes(query.toLowerCase());
            });
            break;
        }

        const resultText = nodes.length > 0
          ? `Found ${nodes.length} nodes in ${searchScope} (search: "${query}", type: ${searchType}):\n\n${JSON.stringify(nodes, null, 2)}`
          : `No nodes found in ${searchScope} matching "${query}" (search type: ${searchType})`;

        return {
          content: [{ type: 'text', text: resultText }]
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  );
}
