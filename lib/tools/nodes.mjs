/**
 * MCP tools for working with Node-RED nodes
 */

import { z } from 'zod';
import { callNodeRed } from '../utils.mjs';

/**
 * Node-RED节点详细信息提取器类
 * 从HTML响应中提取结构化的节点信息
 */
class NodeDetailsExtractor {
  constructor(htmlContent) {
    this.decodedContent = '';
    this.nodes = [];
    this.processContent(htmlContent);
  }

  /**
   * 处理HTML内容（如果是JSON字符串则解码）
   */
  processContent(content) {
    if (typeof content === 'string') {
      // 如果是JSON字符串，先解码
      if (content.startsWith('"') && content.endsWith('"')) {
        content = content.slice(1, -1);
      }
      // 解码转义字符
      this.decodedContent = content
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    } else {
      this.decodedContent = content;
    }
  }

  /**
   * 提取所有节点的详细信息
   */
  extractAllNodeDetails() {
    const registerMatches = [...this.decodedContent.matchAll(/RED\.nodes\.registerType\s*\(\s*['"]([^'"]+)['"],\s*\{([\s\S]*?)\}\);/g)];
    
    registerMatches.forEach((match) => {
      const nodeType = match[1];
      const nodeConfig = match[2];
      
      try {
        const nodeDetails = this.parseNodeDetails(nodeType, nodeConfig);
        this.nodes.push(nodeDetails);
      } catch (error) {
        console.warn(`⚠️ 解析 ${nodeType} 节点时出错: ${error.message}`);
      }
    });

    return this.nodes;
  }

  /**
   * 解析单个节点的详细信息
   */
  parseNodeDetails(nodeType, configString) {
    const node = {
      nodeType: nodeType,
      name: nodeType,
      category: '',
      color: '',
      inputs: 0,
      outputs: 0,
      icon: '',
      defaults: {},
      configParameters: [],
      defaultProperties: [], // 与测试代码输出格式保持一致
      description: '',
      helpSummary: '',
      inputPorts: [],
      outputPorts: [],
      properties: {}
    };

    // 提取基本配置
    node.category = this.extractValue(configString, 'category') || 'unknown';
    node.color = this.extractValue(configString, 'color') || '#999999';
    node.inputs = parseInt(this.extractValue(configString, 'inputs')) || 0;
    node.outputs = parseInt(this.extractValue(configString, 'outputs')) || 0;
    node.icon = this.extractValue(configString, 'icon') || 'node.svg';

    // 提取默认配置参数
    const defaultsMatch = configString.match(/defaults:\s*\{([\s\S]*?)\}(?=,|\s*\})/);
    if (defaultsMatch) {
      node.defaults = this.parseDefaults(defaultsMatch[1]);
      node.configParameters = Object.keys(node.defaults);
      node.defaultProperties = Object.keys(node.defaults);
    }

    // 修复特定节点的属性解析问题
    this.fixKnownNodeProperties(nodeType, configString, node);

    // 提取帮助文档信息
    const helpContent = this.extractHelpContent(nodeType);
    if (helpContent) {
      node.description = this.extractDescription(helpContent);
      node.helpSummary = this.extractHelpSummary(helpContent);
      const ports = this.extractPortInfo(helpContent);
      node.inputPorts = ports.inputs;
      node.outputPorts = ports.outputs;
    }

    // 提取模板信息中的配置参数
    const templateInfo = this.extractTemplateInfo(nodeType);
    if (templateInfo) {
      node.properties = templateInfo;
    }

    return node;
  }

  /**
   * 提取字符串值
   */
  extractValue(text, key) {
    const patterns = [
      new RegExp(`${key}:\\s*["']([^"']+)["']`),
      new RegExp(`${key}:\\s*([^,}\\s]+)`),
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].replace(/["']/g, '');
    }
    return null;
  }

  /**
   * 解析defaults配置（增强版，修复复杂嵌套结构解析问题）
   */
  parseDefaults(defaultsText) {
    const defaults = {};
    
    // 简单但有效的方法：直接查找所有属性名，不解析复杂的值
    // 匹配模式：属性名: { ... }，但只提取属性名
    const propMatches = defaultsText.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/g);
    
    if (propMatches) {
      for (const match of propMatches) {
        const propNameMatch = match.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (propNameMatch) {
          const propName = propNameMatch[1];
          
          // 为每个属性创建基本定义
          defaults[propName] = {
            value: this.extractSimpleValue(match),
            type: this.guessPropertyType(match),
            required: match.includes('required:true') || match.includes('required: true'),
            validate: match.includes('validate:')
          };
        }
      }
    }
    
    // 如果上面的方法没有工作，回退到简单的属性名提取
    if (Object.keys(defaults).length === 0) {
      const simpleMatches = [...defaultsText.matchAll(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*\{/g)];
      for (const match of simpleMatches) {
        const propName = match[1];
        defaults[propName] = {
          value: "",
          type: "unknown",
          required: false,
          validate: false
        };
      }
    }

    return defaults;
  }
  
  /**
   * 提取简单的值
   */
  extractSimpleValue(propMatch) {
    const valueMatch = propMatch.match(/value\s*:\s*([^,}]+)/);
    if (valueMatch) {
      let value = valueMatch[1].trim();
      // 去掉引号
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return value;
    }
    return "";
  }
  
     /**
    * 猜测属性类型
    */
   guessPropertyType(propMatch) {
     if (propMatch.includes('value:""') || propMatch.includes('value:\'\'')) {
       return "string";
     } else if (propMatch.includes('value:false') || propMatch.includes('value:true')) {
       return "boolean";
     } else if (/value:\s*[\d.]+/.test(propMatch)) {
       return "number";
     } else if (propMatch.includes('value:[')) {
       return "array";
     }
     return "string";
   }

   /**
    * 修复已知节点的属性解析问题
    * 这个方法使用直接搜索来补充解析不完整的节点属性
    */
   fixKnownNodeProperties(nodeType, configString, node) {
     // 已知常见节点的完整属性列表
     const knownNodeProperties = {
       'inject': ['name', 'props', 'repeat', 'crontab', 'once', 'onceDelay', 'topic', 'payload', 'payloadType'],
       'debug': ['name', 'active', 'tosidebar', 'console', 'tostatus', 'complete', 'targetType', 'statusVal', 'statusType'],
       'function': ['name', 'func', 'outputs', 'timeout', 'noerr', 'initialize', 'finalize', 'libs'],
       'switch': ['name', 'property', 'propertyType', 'rules', 'checkall', 'repair', 'outputs'],
       'change': ['name', 'rules', 'action', 'property', 'from', 'to', 'reg'],
       'template': ['name', 'field', 'fieldType', 'format', 'syntax', 'template', 'output', 'outputType'],
       'http-request': ['name', 'method', 'ret', 'paytoqs', 'url', 'tls', 'persist', 'proxy', 'insecureHTTPParser', 'authType', 'senderr', 'headers'],
       'http-in': ['name', 'url', 'method', 'upload', 'swaggerDoc'],
       'http-response': ['name', 'statusCode', 'headers'],
       'mqtt-in': ['name', 'topic', 'qos', 'datatype', 'broker', 'nl', 'rap', 'rh', 'inputs'],
       'mqtt-out': ['name', 'topic', 'qos', 'retain', 'respTopic', 'contentType', 'userProps', 'correl', 'expiry', 'broker'],
       'delay': ['name', 'pauseType', 'timeout', 'timeoutUnits', 'rate', 'nbRateUnits', 'rateUnits', 'randomFirst', 'randomLast', 'randomUnits', 'drop'],
       'trigger': ['name', 'op1', 'op2', 'op1type', 'op2type', 'duration', 'extend', 'overrideDelay', 'units', 'reset', 'bytopic', 'topic', 'outputs'],
       'split': ['name', 'splt', 'spltType', 'arraySplt', 'arraySpltType', 'stream', 'addname'],
       'join': ['name', 'mode', 'build', 'property', 'propertyType', 'key', 'joiner', 'joinerType', 'accumulate', 'timeout', 'count'],
       'sort': ['name', 'target', 'targetType', 'msgKey', 'msgKeyType', 'seqKey', 'seqKeyType'],
       'batch': ['name', 'mode', 'count', 'overlap', 'interval']
     };
     
     if (knownNodeProperties[nodeType]) {
       const knownProps = knownNodeProperties[nodeType];
       const foundProps = knownProps.filter(prop => {
         const propRegex = new RegExp(`${prop}\\s*:\\s*\\{`, 'g');
         return propRegex.test(configString);
       });
       
       // 如果直接搜索找到了更多属性，使用搜索结果补充或替换
       if (foundProps.length > Object.keys(node.defaults || {}).length) {
         node.defaults = node.defaults || {};
         foundProps.forEach(prop => {
           if (!node.defaults[prop]) {
             node.defaults[prop] = { 
               value: "", 
               type: "string",
               required: false,
               validate: false
             };
           }
         });
         // 更新配置参数列表
         node.configParameters = Object.keys(node.defaults);
         node.defaultProperties = Object.keys(node.defaults);
       }
     }
   }

  /**
   * 提取帮助文档内容
   */
  extractHelpContent(nodeType) {
    const helpRegex = new RegExp(`<script type="text/html" data-help-name="${nodeType}"[^>]*>([\\s\\S]*?)</script>`);
    const match = this.decodedContent.match(helpRegex);
    return match ? match[1] : null;
  }

  /**
   * 提取节点描述
   */
  extractDescription(helpContent) {
    // 提取第一个<p>标签内容
    const pMatch = helpContent.match(/<p[^>]*>(.*?)<\/p>/);
    return pMatch ? pMatch[1].replace(/<[^>]*>/g, '').trim() : '';
  }

  /**
   * 提取帮助摘要
   */
  extractHelpSummary(helpContent) {
    // 提取Details部分的内容
    const detailsMatch = helpContent.match(/<h3>Details<\/h3>\s*<p[^>]*>(.*?)<\/p>/);
    if (detailsMatch) {
      return detailsMatch[1].replace(/<[^>]*>/g, '').trim();
    }
    
    // 如果没有Details，尝试提取第二个p标签
    const allPs = [...helpContent.matchAll(/<p[^>]*>(.*?)<\/p>/g)];
    if (allPs.length > 1) {
      return allPs[1][1].replace(/<[^>]*>/g, '').trim();
    }
    
    return '';
  }

  /**
   * 提取端口信息
   */
  extractPortInfo(helpContent) {
    const result = { inputs: [], outputs: [] };

    // 提取输入端口信息
    const inputsMatch = helpContent.match(/<h3>Inputs<\/h3>([\s\S]*?)(?=<h3>|$)/);
    if (inputsMatch) {
      const inputPorts = [...inputsMatch[1].matchAll(/<dt[^>]*>([^<]+)<span[^>]*>([^<]+)<\/span><\/dt>\s*<dd[^>]*>([^<]+)<\/dd>/g)];
      result.inputs = inputPorts.map(match => ({
        name: match[1].trim(),
        type: match[2].trim(),
        description: match[3].trim()
      }));
    }

    // 提取输出端口信息
    const outputsMatch = helpContent.match(/<h3>Outputs<\/h3>([\s\S]*?)(?=<h3>|$)/);
    if (outputsMatch) {
      const outputPorts = [...outputsMatch[1].matchAll(/<dt[^>]*>([^<]+)<span[^>]*>([^<]+)<\/span><\/dt>\s*<dd[^>]*>([^<]+)<\/dd>/g)];
      result.outputs = outputPorts.map(match => ({
        name: match[1].trim(),
        type: match[2].trim(),
        description: match[3].trim()
      }));
    }

    return result;
  }

  /**
   * 提取模板信息
   */
  extractTemplateInfo(nodeType) {
    const templateRegex = new RegExp(`<script type="text/html" data-template-name="${nodeType}"[^>]*>([\\s\\S]*?)</script>`);
    const match = this.decodedContent.match(templateRegex);
    
    if (!match) return {};

    const templateContent = match[1];
    const inputs = [...templateContent.matchAll(/id="node-input-([^"]+)"/g)];
    
    return {
      formFields: inputs.map(input => input[1]),
      hasCustomValidation: templateContent.includes('validate:'),
      hasComplexUI: templateContent.includes('editableList') || templateContent.includes('typedInput')
    };
  }

  /**
   * 生成分析摘要
   */
  generateSummary() {
    const byCategory = {};
    this.nodes.forEach(node => {
      if (!byCategory[node.category]) {
        byCategory[node.category] = [];
      }
      byCategory[node.category].push(node);
    });

    return {
      totalNodes: this.nodes.length,
      categories: Object.keys(byCategory),
      nodesByCategory: byCategory,
      averageConfigParams: this.nodes.length > 0 
        ? (this.nodes.reduce((sum, n) => sum + n.configParameters.length, 0) / this.nodes.length).toFixed(1)
        : 0
    };
  }
}

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

  // ✅ ENHANCED: Get list of installed node modules with detailed analysis
  server.tool(
    'get-nodes',
    { 
      analyze: z.boolean().default(false).describe('Whether to analyze and extract detailed node information (default: false for raw data)')
    },
    async ({ analyze = false }) => {
      const nodes = await callNodeRed('get', '/nodes', null, config);
      
      if (!analyze) {
        // 返回原始数据
        return {
          content: [{ type: 'text', text: JSON.stringify(nodes, null, 2) }]
        };
      }

      // 分析和提取详细信息
      try {
        // 获取Node-RED主页面的HTML内容以解析JavaScript节点定义
        const htmlContent = await callNodeRed('get', '/', null, config, 'text');
        const extractor = new NodeDetailsExtractor(htmlContent);
        
        // 结合API返回的节点数据和HTML解析的详细定义
        const extractedDetails = extractor.extractAllNodeDetails();
        
        // 为每个API返回的节点添加从HTML解析的详细信息
        const enhancedNodes = nodes.map(node => {
          const htmlNodeInfo = extractedDetails.find(detail => detail.nodeType === node.module);
          return {
            ...node,
            ...(htmlNodeInfo || {}),
            // 确保保留API数据的重要信息
            module: node.module,
            version: node.version,
            local: node.local,
            user: node.user
          };
        });
        
        const summary = extractor.generateSummary();

        const report = {
          summary: {
            ...summary,
            generatedAt: new Date().toISOString(),
            analysisType: 'detailed_extraction',
            totalApiNodes: nodes.length,
            htmlDetailedNodes: extractedDetails.length
          },
          nodesByCategory: summary.nodesByCategory,
          allNodes: enhancedNodes
        };

        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify(report, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: 'text', 
            text: `Error analyzing nodes: ${error.message}\n\nRaw data:\n${JSON.stringify(nodes, null, 2)}`
          }]
        };
      }
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
