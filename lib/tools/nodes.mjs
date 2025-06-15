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
    console.log('🔍 DEBUG: Starting extractAllNodeDetails, content length:', this.decodedContent.length);
    
    // 改进的正则表达式，支持更多格式的 RED.nodes.registerType 调用
    const registerPatterns = [
      // 标准格式：RED.nodes.registerType('name', { config });
      /RED\.nodes\.registerType\s*\(\s*['"]([^'"]+)['"],\s*\{([\s\S]*?)\}\s*\);/g,
      // 多行格式：RED.nodes.registerType('name', { 
      //   config...
      // });
      /RED\.nodes\.registerType\s*\(\s*['"]([^'"]+)['"],\s*\{([\s\S]*?)\}\s*\)\s*;/g,
      // 无分号格式
      /RED\.nodes\.registerType\s*\(\s*['"]([^'"]+)['"],\s*\{([\s\S]*?)\}\s*\)/g
    ];
    
    let allMatches = [];
    
    // 尝试所有模式
    for (const pattern of registerPatterns) {
      const matches = [...this.decodedContent.matchAll(pattern)];
      console.log(`🔍 DEBUG: Pattern found ${matches.length} matches`);
      allMatches.push(...matches);
    }
    
    // 去重（基于节点类型）
    const uniqueMatches = [];
    const seenTypes = new Set();
    
    for (const match of allMatches) {
      const nodeType = match[1];
      if (!seenTypes.has(nodeType)) {
        seenTypes.add(nodeType);
        uniqueMatches.push(match);
      }
    }
    
    console.log(`🔍 DEBUG: Found ${uniqueMatches.length} unique registerType calls`);
    
    // 如果没有找到匹配，尝试更宽松的搜索
    if (uniqueMatches.length === 0) {
      console.warn('⚠️ DEBUG: No registerType matches found, trying fallback search...');
      
      // 查找是否包含 RED.nodes.registerType 字符串
      const hasRegisterType = this.decodedContent.includes('RED.nodes.registerType');
      console.log('🔍 DEBUG: Contains registerType string:', hasRegisterType);
      
      if (hasRegisterType) {
        // 显示一些内容示例用于调试
        const firstIndex = this.decodedContent.indexOf('RED.nodes.registerType');
        const sample = this.decodedContent.substring(firstIndex, firstIndex + 500);
        console.log('🔍 DEBUG: Sample content around registerType:', sample);
        
        // 尝试更简单的匹配
        const simplePattern = /RED\.nodes\.registerType\s*\(\s*['"]([^'"]+)['"]/g;
        const simpleMatches = [...this.decodedContent.matchAll(simplePattern)];
        console.log(`🔍 DEBUG: Simple pattern found ${simpleMatches.length} node types`);
        
        for (const match of simpleMatches) {
          if (!seenTypes.has(match[1])) {
            // 创建简化的匹配对象
            uniqueMatches.push([match[0], match[1], '/* configuration not parsed */', match.index]);
            seenTypes.add(match[1]);
          }
        }
      }
    }
    
    // 处理匹配的节点
    uniqueMatches.forEach((match, index) => {
      const nodeType = match[1];
      const nodeConfig = match[2] || '';
      
      console.log(`🔬 DEBUG: Processing node ${index + 1}/${uniqueMatches.length}: ${nodeType}`);
      
      try {
        const nodeDetails = this.parseNodeDetails(nodeType, nodeConfig);
        this.nodes.push(nodeDetails);
        console.log(`✅ DEBUG: Successfully parsed node: ${nodeType}`);
      } catch (error) {
        console.warn(`⚠️ DEBUG: 解析 ${nodeType} 节点时出错: ${error.message}`);
        // 创建基本节点信息，即使解析失败
        const basicNode = {
          nodeType: nodeType,
          name: nodeType,
          category: 'unknown',
          color: '#999999',
          inputs: 0,
          outputs: 0,
          icon: 'node.svg',
          defaults: {},
          configParameters: [],
          defaultProperties: [],
          description: '',
          helpSummary: '',
          inputPorts: [],
          outputPorts: [],
          properties: {}
        };
        this.nodes.push(basicNode);
        console.log(`⚠️ DEBUG: Added basic node info for: ${nodeType}`);
      }
    });

    console.log(`✅ DEBUG: Total nodes extracted: ${this.nodes.length}`);
    return this.nodes;
  }

  /**
   * 解析单个节点的详细信息
   */
  parseNodeDetails(nodeType, configString) {
    console.log(`🔧 DEBUG: Parsing node details for: ${nodeType}, config length: ${configString.length}`);
    
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

    try {
      // 提取基本配置
      node.category = this.extractValue(configString, 'category') || 'unknown';
      node.color = this.extractValue(configString, 'color') || '#999999';
      node.inputs = parseInt(this.extractValue(configString, 'inputs')) || 0;
      node.outputs = parseInt(this.extractValue(configString, 'outputs')) || 0;
      node.icon = this.extractValue(configString, 'icon') || 'node.svg';
      
      console.log(`  📋 DEBUG: Basic config - category: ${node.category}, inputs: ${node.inputs}, outputs: ${node.outputs}`);

      // 提取默认配置参数
      const defaultsMatch = configString.match(/defaults:\s*\{([\s\S]*?)\}(?=,|\s*\})/);
      if (defaultsMatch) {
        console.log(`  🔍 DEBUG: Found defaults section, parsing...`);
        node.defaults = this.parseDefaults(defaultsMatch[1]);
        node.configParameters = Object.keys(node.defaults);
        node.defaultProperties = Object.keys(node.defaults);
        console.log(`  ✅ DEBUG: Parsed ${node.configParameters.length} config parameters`);
      } else {
        console.log(`  ⚠️ DEBUG: No defaults section found for ${nodeType}`);
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
        console.log(`  📚 DEBUG: Added help content for ${nodeType}`);
      }

      // 提取模板信息中的配置参数
      const templateInfo = this.extractTemplateInfo(nodeType);
      if (templateInfo) {
        node.properties = templateInfo;
        console.log(`  📝 DEBUG: Added template info for ${nodeType}`);
      }

      console.log(`✅ DEBUG: Successfully parsed ${nodeType} with ${node.configParameters.length} parameters`);
      return node;
      
    } catch (error) {
      console.error(`❌ DEBUG: Error parsing ${nodeType}:`, error);
      throw error;
    }
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

  // ✅ ENHANCED: Get nodes information with module filtering and wildcard support
  server.tool(
    'get-nodes',
    {
      module: z.string().optional().describe('Optional: Filter nodes by specific module name (e.g., "node-red-contrib-csv")'),
      specificNodes: z.array(z.string()).optional().describe('Optional: Array of node names with wildcard support (e.g., ["csv*", "*mqtt*", "debug"]). If not provided, processes all nodes'),
      returnRaw: z.boolean().default(false).describe('Whether to return raw API response (true) or processed node details (false, default)'),
      minimalFormat: z.boolean().default(true).describe('Whether to return AI-friendly minimal format when returnRaw=false (default: true)')
    },
    async ({ module = null, specificNodes = null, returnRaw = false, minimalFormat = true }) => {
      try {
        // Step 1: Get JSON data with enabled status first
        console.log('🔍 DEBUG: Calling /nodes API for JSON data (enabled status)...');
        const jsonData = await callNodeRed('get', '/nodes', null, config, 'json', { 'Accept': 'application/json' });
        console.log('📡 DEBUG: Got JSON data, type:', typeof jsonData, 'isArray:', Array.isArray(jsonData));
        
        // Extract enabled status by module and create node-to-module mapping
        const moduleEnabledStatus = {};
        const nodeToModuleMap = {};
        if (Array.isArray(jsonData)) {
          jsonData.forEach(nodeInfo => {
            if (nodeInfo.module && typeof nodeInfo.enabled === 'boolean') {
              moduleEnabledStatus[nodeInfo.module] = nodeInfo.enabled;
            }
            // Create mapping from node type to module (if available)
            if (nodeInfo.type && nodeInfo.module) {
              nodeToModuleMap[nodeInfo.type] = nodeInfo.module;
            }
          });
          console.log('📊 DEBUG: Extracted enabled status for modules:', Object.keys(moduleEnabledStatus));
          console.log('📊 DEBUG: Created node-to-module mapping for', Object.keys(nodeToModuleMap).length, 'node types');
        } else {
          console.warn('⚠️ DEBUG: JSON data is not an array, enabled status extraction skipped');
        }

        // Step 2: Get node list - /nodes API returns HTML for detailed parsing
        console.log('🔍 DEBUG: Calling /nodes API for HTML content...');
        const htmlContent = await callNodeRed('get', '/nodes', null, config, 'text');
        console.log('📡 DEBUG: Got HTML content, length:', htmlContent ? htmlContent.length : 'null');
        
        // If user wants raw data, return it directly
        if (returnRaw) {
          console.log('📤 DEBUG: Returning raw HTML content as requested');
          return {
            content: [{ 
              type: 'text', 
              text: htmlContent || 'No content received from /nodes API'
            }]
          };
        }

        // Process nodes without caching
        let nodeList = [];
        
        // Validate HTML content
        if (!htmlContent || typeof htmlContent !== 'string') {
          console.error('❌ DEBUG: Invalid HTML content received:', typeof htmlContent);
          return {
            content: [{ 
              type: 'text', 
              text: 'Error: Invalid HTML content received from /nodes API'
            }]
          };
        }
        
        // Extract node information from HTML using the NodeDetailsExtractor
        console.log('🔄 DEBUG: Creating NodeDetailsExtractor...');
        const extractor = new NodeDetailsExtractor(htmlContent);
        console.log('📊 DEBUG: Extractor created, calling extractAllNodeDetails...');
        
        const nodes = extractor.extractAllNodeDetails();
        console.log('📋 DEBUG: Extracted nodes result:', {
          isArray: Array.isArray(nodes),
          type: typeof nodes,
          length: nodes ? nodes.length : 'null',
          content: nodes ? nodes.slice(0, 3).map(n => n.nodeType) : 'no nodes'
        });

        // Ensure nodes is always an array
        let safeNodes = [];
        if (Array.isArray(nodes)) {
          safeNodes = nodes;
        } else if (nodes && typeof nodes === 'object') {
          // Try to convert object to array
          safeNodes = Object.values(nodes);
        } else {
          console.warn('⚠️ DEBUG: No valid nodes found, returning empty array');
          safeNodes = [];
        }
        
        nodeList = safeNodes;
        console.log('✅ DEBUG: Safe nodes array created, length:', safeNodes.length);

        // Helper function for wildcard matching
        const matchesWildcard = (text, pattern) => {
          if (!pattern.includes('*')) {
            return text === pattern;
          }
          const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
          return regex.test(text);
        };

        // Filter nodes to process
        let nodesToProcess = safeNodes;

        // Apply module filter first
        if (module && typeof module === 'string') {
          console.log('🔍 DEBUG: Filtering by module:', module);
          nodesToProcess = nodesToProcess.filter(node => {
            // Check if node belongs to the specified module
            const nodeModule = node.module || 'node-red';
            return matchesWildcard(nodeModule, module);
          });
          console.log('✅ DEBUG: After module filter count:', nodesToProcess.length);
        }

        // Apply specific nodes filter with wildcard support
        if (specificNodes && Array.isArray(specificNodes) && specificNodes.length > 0) {
          console.log('🔍 DEBUG: Filtering specific nodes with wildcards:', specificNodes);
          nodesToProcess = nodesToProcess.filter(node => {
            if (!node || !node.nodeType) return false;
            
            return specificNodes.some(pattern => 
              matchesWildcard(node.nodeType, pattern) ||
              matchesWildcard(node.name || '', pattern) ||
              matchesWildcard(`node-red-${node.nodeType}`, pattern)
            );
          });
          console.log('✅ DEBUG: After specific nodes filter count:', nodesToProcess.length);
        }

        console.log('✅ DEBUG: Final nodes to process count:', nodesToProcess.length);

        // Process the filtered nodes directly

        // Process the filtered nodes into results
        const results = nodesToProcess
          .filter(node => node && node.nodeType) // Ensure valid nodes
          .map(node => {
            // Determine the module for this node
            const nodeModule = nodeToModuleMap[node.nodeType] || 'node-red';
            
            return {
              module: nodeModule,
              nodeName: node.nodeType,
              nodeType: node.nodeType,
              category: node.category || 'unknown',
              color: node.color || '#999999',
              defaults: node.defaults || {},
              credentials: {},
              inputs: node.inputs || 0,
              outputs: node.outputs || 0,
              icon: node.icon || 'node.svg',
              label: '',
              helpContent: node.description || '',
              template: '',
              errors: [],
              formInputs: Array.isArray(node.configParameters) ? node.configParameters.map(param => ({
                id: `node-input-${param}`,
                type: 'text',
                element: `<input id="node-input-${param}" type="text">`
              })) : [],
              inputProperties: Array.isArray(node.inputPorts) ? node.inputPorts : [],
              outputProperties: Array.isArray(node.outputPorts) ? node.outputPorts : [],
              helpSummary: node.helpSummary || '',
              enabled: moduleEnabledStatus[nodeModule] !== undefined ? moduleEnabledStatus[nodeModule] : true
            };
          });

        console.log('📊 DEBUG: Final results count:', results.length);

        // Generate output format
        if (minimalFormat) {
          const minimalData = {
            timestamp: new Date().toISOString(),
            modules: [...new Set(results.map(n => n.module))],
            categories: [...new Set(results.map(n => n.category).filter(Boolean))],
            totalNodes: results.length,
            nodes: results.map(node => ({
              type: node.nodeType,
              name: node.nodeName,
              category: node.category,
              module: node.module,
              color: node.color,
              inputs: node.inputs,
              outputs: node.outputs,
              icon: node.icon,
              summary: node.helpSummary,
              inputProps: Array.isArray(node.inputProperties) ? node.inputProperties.map(p => ({
                name: p.name || '',
                type: p.type || '',
                required: !p.optional
              })) : [],
              outputProps: Array.isArray(node.outputProperties) ? node.outputProperties.map(p => ({
                name: p.name || '',
                type: p.type || ''
              })) : [],
              configs: Array.isArray(node.formInputs) ? node.formInputs
                .filter(input => input.type !== 'hidden')
                .map(input => ({
                  id: input.id.replace('node-input-', ''),
                  type: input.type
                })) : [],
              enabled: node.enabled
            }))
          };

          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify(minimalData, null, 2)
            }]
          };
        } else {
          // Return full detailed format
          const stats = {
            totalNodes: results.length,
            successfulParsed: results.filter(r => !r.error).length,
            errors: results.filter(r => r.error).length,
            categories: [...new Set(results.map(r => r.category).filter(Boolean))],
            modules: [...new Set(results.map(r => r.module).filter(Boolean))],
            timestamp: new Date().toISOString()
          };

          const fullData = {
            statistics: stats,
            nodes: results
          };

          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify(fullData, null, 2)
            }]
          };
        }

      } catch (error) {
        console.error('❌ DEBUG: Error in get-nodes:', error);
        return {
          content: [{ 
            type: 'text', 
            text: `Error getting nodes details: ${error.message}\n\nStack trace:\n${error.stack}`
          }]
        };
      }
    }
  );

  // Helper function to parse node HTML content
  function parseNodeFromHtml(cacheKey, cachedData) {
    const { module, set, htmlContent, nodeInfo } = cachedData;
    
    const nodeData = {
      cacheKey: cacheKey,
      module: module,
      nodeName: set,
      nodeType: '',
      category: '',
      color: '',
      defaults: {},
      credentials: {},
      inputs: 0,
      outputs: 0,
      icon: '',
      label: '',
      helpContent: '',
      template: '',
      errors: [],
      formInputs: [],
      inputProperties: [],
      outputProperties: [],
      helpSummary: ''
    };

    try {
      // Simple HTML parsing without JSDOM dependency
      const scriptMatches = htmlContent.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
      
      for (const scriptMatch of scriptMatches) {
        const content = scriptMatch.replace(/<\/?script[^>]*>/gi, '');
        
        // Find RED.nodes.registerType calls
        const registerMatch = content.match(/RED\.nodes\.registerType\s*\(\s*["']([^"']+)["']\s*,\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s);
        if (registerMatch) {
          const nodeType = registerMatch[1];
          const configStr = registerMatch[2];
          
          nodeData.nodeType = nodeType;
          
          // Extract configuration
          const categoryMatch = configStr.match(/category\s*:\s*["']([^"']+)["']/);
          const colorMatch = configStr.match(/color\s*:\s*["']([^"']*)["']/);
          const inputsMatch = configStr.match(/inputs\s*:\s*(\d+)/);
          const outputsMatch = configStr.match(/outputs\s*:\s*(\d+)/);
          const iconMatch = configStr.match(/icon\s*:\s*["']([^"']+)["']/);
          
          if (categoryMatch) nodeData.category = categoryMatch[1];
          if (colorMatch) nodeData.color = colorMatch[1];
          if (inputsMatch) nodeData.inputs = parseInt(inputsMatch[1]);
          if (outputsMatch) nodeData.outputs = parseInt(outputsMatch[1]);
          if (iconMatch) nodeData.icon = iconMatch[1];
          
          break;
        }
      }

      // Extract help content
      const helpMatch = htmlContent.match(/<script[^>]*data-help-name[^>]*>([\s\S]*?)<\/script>/i) ||
                       htmlContent.match(/<script[^>]*type=["']text\/[^"']*["'][^>]*data-help-name[^>]*>([\s\S]*?)<\/script>/i);
      
      if (helpMatch) {
        nodeData.helpContent = helpMatch[1];
        nodeData.helpSummary = extractHelpSummary(nodeData.helpContent);
        const ioInfo = extractInputOutputInfo(nodeData.helpContent);
        nodeData.inputProperties = ioInfo.inputs;
        nodeData.outputProperties = ioInfo.outputs;
      }

      // Extract template
      const templateMatch = htmlContent.match(/<script[^>]*data-template-name[^>]*>([\s\S]*?)<\/script>/i) ||
                           htmlContent.match(/<script[^>]*type=["']text\/[^"']*["'][^>]*data-template-name[^>]*>([\s\S]*?)<\/script>/i);
      
      if (templateMatch) {
        nodeData.template = templateMatch[1];
        nodeData.formInputs = extractFormInputs(templateMatch[1]);
      }

    } catch (error) {
      nodeData.errors.push(error.message);
    }
    
    return nodeData;
  }

  // Helper function to extract help summary
  function extractHelpSummary(helpContent) {
    const firstParagraph = helpContent.match(/<p>([^<]+)<\/p>/);
    return firstParagraph ? firstParagraph[1].trim() : '';
  }

  // Helper function to extract input/output information
  function extractInputOutputInfo(helpContent) {
    const inputs = [];
    const outputs = [];
    
    const inputSection = helpContent.match(/<h3>Inputs?<\/h3>([\s\S]*?)(?=<h3>|$)/i);
    if (inputSection) {
      const inputProps = extractProperties(inputSection[1]);
      inputs.push(...inputProps);
    }
    
    const outputSection = helpContent.match(/<h3>Outputs?<\/h3>([\s\S]*?)(?=<h3>|$)/i);
    if (outputSection) {
      const outputProps = extractProperties(outputSection[1]);
      outputs.push(...outputProps);
    }
    
    return { inputs, outputs };
  }

  // Helper function to extract properties
  function extractProperties(sectionContent) {
    const properties = [];
    const propRegex = /<dt[^>]*>([^<]+)(?:<span[^>]*>([^<]+)<\/span>)?<\/dt>\s*<dd[^>]*>([^<]+)/g;
    let match;
    
    while ((match = propRegex.exec(sectionContent)) !== null) {
      const name = match[1].trim();
      const type = match[2] ? match[2].trim() : '';
      const description = match[3].trim();
      
      properties.push({
        name: name,
        type: type,
        description: description,
        optional: name.includes('optional')
      });
    }
    
    return properties;
  }

  // Helper function to extract form inputs
  function extractFormInputs(templateContent) {
    const inputs = [];
    const inputMatches = templateContent.match(/<(input|select|textarea)[^>]*>/gi) || [];
    
    inputMatches.forEach(match => {
      const idMatch = match.match(/id=["']([^"']+)["']/);
      if (idMatch && idMatch[1].startsWith('node-input-')) {
        let type = 'text';
        if (match.includes('type="password"')) type = 'password';
        else if (match.includes('type="checkbox"')) type = 'checkbox';
        else if (match.includes('type="number"')) type = 'number';
        else if (match.includes('<select')) type = 'select';
        else if (match.includes('<textarea')) type = 'textarea';
        
        inputs.push({
          id: idMatch[1],
          type: type,
          element: match
        });
      }
    });
    
    return inputs;
  }


}
