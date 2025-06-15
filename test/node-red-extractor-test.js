#!/usr/bin/env node

/**
 * Node-RED节点详细信息提取器测试
 * 基于 https://www.genspark.ai/spark?id=30ba9a7d-2746-46a4-82d1-ac43a5a386fd
 * 
 * 使用方法:
 * node test/node-red-extractor-test.js
 * 
 * 或者指定Node-RED实例地址:
 * node test/node-red-extractor-test.js http://localhost:1880
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 动态导入cheerio，因为它是项目依赖
let cheerio;
try {
  cheerio = await import('cheerio');
} catch (error) {
  console.error('❌ 需要安装 cheerio 依赖: npm install cheerio');
  process.exit(1);
}

class NodeRedDetailExtractor {
  constructor(baseUrl, credentials = null) {
    this.baseUrl = baseUrl || 'http://localhost:1880';
    this.credentials = credentials;
    this.accessToken = null;
  }

  // 认证（如果需要）
  async authenticate() {
    if (!this.credentials) return;
    
    try {
      // 尝试基本认证方式
      const basicAuth = Buffer.from(`${this.credentials.username}:${this.credentials.password}`).toString('base64');
      
      const response = await fetch(`${this.baseUrl}/auth/token`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Basic ${basicAuth}`
        },
        body: JSON.stringify({
          client_id: 'node-red-admin',
          grant_type: 'password',
          scope: '*',
          ...this.credentials
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        this.accessToken = data.access_token;
        console.log('✅ 认证成功');
        return true;
      } else {
        console.warn('⚠️ Token认证失败，尝试基本认证');
        // 设置基本认证
        this.basicAuth = basicAuth;
        return true;
      }
    } catch (error) {
      console.warn('⚠️ 认证失败，将尝试无认证访问:', error.message);
      return false;
    }
  }

  // 获取HTML内容
  async getNodesHTML() {
    if (this.credentials && !this.accessToken && !this.basicAuth) {
      await this.authenticate();
    }

    const headers = { 'Accept': 'text/html' };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    } else if (this.basicAuth) {
      headers['Authorization'] = `Basic ${this.basicAuth}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}/nodes`, { headers });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      console.error('❌ 获取HTML内容失败:', error.message);
      throw error;
    }
  }

  // 获取JSON基本信息
  async getNodesJSON() {
    const headers = { 'Accept': 'application/json' };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    } else if (this.basicAuth) {
      headers['Authorization'] = `Basic ${this.basicAuth}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}/nodes`, { headers });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('❌ 获取JSON数据失败:', error.message);
      throw error;
    }
  }

  // 生成完整的JSON格式节点信息
  async generateCompleteNodeInfo() {
    try {
      console.log('🔄 正在获取节点数据...');
      const [htmlContent, basicNodes] = await Promise.all([
        this.getNodesHTML(),
        this.getNodesJSON()
      ]);

      console.log('🔄 正在解析节点定义...');
      const $ = cheerio.load(htmlContent);
      const nodeDefinitions = this.parseAllNodeDefinitions($, htmlContent);
      const helpDocs = this.parseHelpDocuments($);

      const result = {};

      // 按模块组织数据
      basicNodes.forEach(nodeSet => {
        const moduleKey = nodeSet.module;
        
        if (!result[moduleKey]) {
          result[moduleKey] = {
            module: moduleKey,
            version: nodeSet.version,
            enabled: nodeSet.enabled,
            isCore: moduleKey === 'node-red',
            nodeSets: []
          };
        }

        // 处理每个Node Set
        const nodeSetInfo = {
          nodeSetId: nodeSet.id,
          nodeSetName: nodeSet.name,
          enabled: nodeSet.enabled,
          nodeTypes: []
        };

        // 处理每个节点类型
        nodeSet.types.forEach(nodeType => {
          const definition = nodeDefinitions[nodeType];
          const help = helpDocs[nodeType];

          const nodeInfo = {
            nodeType: nodeType,
            category: definition?.category || 'unknown',
            inputs: definition?.inputs || 0,
            outputs: definition?.outputs || 1,
            icon: definition?.icon || 'node.svg',
            color: definition?.color || '#ddd',
            align: definition?.align || 'left',
            defaults: definition?.defaults || {},
            defaultProperties: definition?.defaults ? Object.keys(definition.defaults) : [],
            functionalSummary: this.extractSummary(help),
            paletteLabel: definition?.paletteLabel || nodeType,
            hasButton: definition?.button !== undefined,
            hasStatus: definition?.hasStatus === true,
            module: moduleKey,
            version: nodeSet.version
          };

          nodeSetInfo.nodeTypes.push(nodeInfo);
        });

        result[moduleKey].nodeSets.push(nodeSetInfo);
      });

      return result;
    } catch (error) {
      console.error('❌ 生成节点信息失败:', error);
      throw error;
    }
  }

  // 解析所有节点定义
  parseAllNodeDefinitions($, htmlContent) {
    const definitions = {};
    
    // 使用正则表达式匹配所有 RED.nodes.registerType 调用
    const registerRegex = /RED\.nodes\.registerType\s*\(\s*['"]([^'"]+)['"]\s*,\s*\{([\s\S]*?)\}\s*\);/g;
    let match;
    let foundCount = 0;

    while ((match = registerRegex.exec(htmlContent)) !== null) {
      const nodeType = match[1];
      const definitionBody = match[2];
      foundCount++;
      
            definitions[nodeType] = this.parseNodeDefinition(definitionBody);
      
            // 修复特定节点的属性解析问题
      this.fixKnownNodeProperties(nodeType, definitionBody, definitions[nodeType]);
      
      }

    console.log(`📊 总共找到 ${foundCount} 个节点定义`);
    return definitions;
  }

  // 解析单个节点定义
  parseNodeDefinition(definitionBody) {
    const definition = {};

    // 解析基本属性
    const patterns = {
      category: /category\s*:\s*['"]([^'"]+)['"]/,
      color: /color\s*:\s*['"]([^'"]+)['"]/,
      icon: /icon\s*:\s*['"]([^'"]+)['"]/,
      inputs: /inputs\s*:\s*(\d+)/,
      outputs: /outputs\s*:\s*(\d+)/,
      align: /align\s*:\s*['"]([^'"]+)['"]/,
      paletteLabel: /paletteLabel\s*:\s*['"]([^'"]+)['"]/
    };

    Object.entries(patterns).forEach(([key, pattern]) => {
      const match = definitionBody.match(pattern);
      if (match) {
        definition[key] = ['inputs', 'outputs'].includes(key) ? 
          parseInt(match[1]) : match[1];
      }
    });

    // 解析 defaults 对象 - 改进版本，支持嵌套大括号
    const defaultsRegex = /defaults\s*:\s*\{/;
    const defaultsMatch = definitionBody.match(defaultsRegex);
    if (defaultsMatch) {
      const startIndex = defaultsMatch.index + defaultsMatch[0].length - 1; // -1 包含开始的 {
      const defaultsContent = this.extractBalancedBraces(definitionBody, startIndex);
      if (defaultsContent) {
        definition.defaults = this.parseDefaults(defaultsContent);

      }
    }

    // 检查是否有按钮
    if (definitionBody.includes('button:')) {
      definition.button = true;
    }

    return definition;
  }

  // 提取平衡的大括号内容
  extractBalancedBraces(text, startIndex) {
    let depth = 0;
    let result = '';
    
    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];
      result += char;
      
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          // 去掉首尾的大括号
          return result.slice(1, -1);
        }
      }
    }
    
         return null; // 不平衡的大括号
   }
   
   // 修复已知节点的属性解析问题
   fixKnownNodeProperties(nodeType, definitionBody, nodeDefinition) {
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
       'trigger': ['name', 'op1', 'op2', 'op1type', 'op2type', 'duration', 'extend', 'overrideDelay', 'units', 'reset', 'bytopic', 'topic', 'outputs']
     };
     
     if (knownNodeProperties[nodeType]) {
       const knownProps = knownNodeProperties[nodeType];
       const foundProps = knownProps.filter(prop => {
         const propRegex = new RegExp(`${prop}\\s*:\\s*\\{`, 'g');
         return propRegex.test(definitionBody);
       });
       
       // 如果直接搜索找到了更多属性，使用搜索结果
       if (foundProps.length > Object.keys(nodeDefinition.defaults || {}).length) {
         nodeDefinition.defaults = {};
         foundProps.forEach(prop => {
           nodeDefinition.defaults[prop] = { value: "", type: "string" };
         });
       }
     }
   }
  
   // 解析 defaults 对象
  parseDefaults(defaultsContent) {
    const defaults = {};
    
    // 简单但有效的方法：直接查找所有属性名，不解析复杂的值
    // 匹配模式：属性名: { ... }，但只提取属性名
    const propMatches = defaultsContent.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/g);
    
    if (propMatches) {
      for (const match of propMatches) {
        const propNameMatch = match.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (propNameMatch) {
          const propName = propNameMatch[1];
          
          // 为每个属性创建基本定义
          defaults[propName] = {
            value: this.extractSimpleValue(match),
            type: this.guessPropertyType(match)
          };
        }
      }
    }
    
    // 如果上面的方法没有工作，回退到简单的属性名提取
    if (Object.keys(defaults).length === 0) {
      const simpleMatches = [...defaultsContent.matchAll(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*\{/g)];
      for (const match of simpleMatches) {
        const propName = match[1];
        defaults[propName] = {
          value: "",
          type: "unknown"
        };
      }
    }
    
    return defaults;
  }
  
  // 提取简单的值
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
  
  // 猜测属性类型
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
   
   // 修复版本的defaults解析
   parseDefaultsFixed(defaultsContent) {
     const defaults = {};
     
     // 使用更简单的分行解析方法
     const lines = defaultsContent.split('\n');
     let currentProp = null;
     let bracketCount = 0;
     let propContent = '';
     
     for (const line of lines) {
       const trimmed = line.trim();
       
       // 检查是否开始新属性
       const propMatch = trimmed.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*\{/);
       if (propMatch && bracketCount === 0) {
         // 保存前一个属性
         if (currentProp) {
           defaults[currentProp] = { value: "", type: "string" };
         }
         
         currentProp = propMatch[1];
         bracketCount = 1;
         propContent = '';
         continue;
       }
       
       if (currentProp) {
         // 计算大括号
         for (const char of trimmed) {
           if (char === '{') bracketCount++;
           if (char === '}') bracketCount--;
         }
         
         propContent += line + '\n';
         
         // 如果大括号平衡，属性结束
         if (bracketCount === 0) {
           defaults[currentProp] = { value: "", type: "string" };
           currentProp = null;
           propContent = '';
         }
       }
     }
     
     // 处理最后一个属性
     if (currentProp) {
       defaults[currentProp] = { value: "", type: "string" };
     }
     
     return defaults;
   }
  
   // 解析单个属性定义
  parsePropertyDefinition(propDef) {
    const property = {};
    
    // 解析 value - 改进版本，支持更复杂的值
    const valueMatch = propDef.match(/value\s*:\s*([^,}]+(?:\{[^}]*\}[^,}]*)*)/);
    if (valueMatch) {
      let valueStr = valueMatch[1].trim();
      // 去掉末尾的逗号
      valueStr = valueStr.replace(/,$/, '');
      property.value = this.parseValue(valueStr);
    }

    // 解析 type
    const typeMatch = propDef.match(/type\s*:\s*['"]([^'"]+)['"]/);
    if (typeMatch) {
      property.type = typeMatch[1];
    }

    // 解析 required
    const requiredMatch = propDef.match(/required\s*:\s*(true|false)/);
    if (requiredMatch) {
      property.required = requiredMatch[1] === 'true';
    }

    // 解析 validate
    if (propDef.includes('validate:')) {
      property.hasValidation = true;
    }

    return property;
  }

  // 解析值
  parseValue(valueStr) {
    valueStr = valueStr.trim();
    
    // 字符串
    if ((valueStr.startsWith('"') && valueStr.endsWith('"')) || 
        (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
      return valueStr.slice(1, -1);
    }
    
    // 数字
    if (/^-?\d+(\.\d+)?$/.test(valueStr)) {
      return parseFloat(valueStr);
    }
    
    // 布尔值
    if (valueStr === 'true') return true;
    if (valueStr === 'false') return false;
    
    // 数组或对象
    if (valueStr.startsWith('[') || valueStr.startsWith('{')) {
      try {
        return JSON.parse(valueStr);
      } catch {
        return valueStr;
      }
    }
    
    return valueStr;
  }

  // 解析帮助文档
  parseHelpDocuments($) {
    const helpDocs = {};
    
    $('script[data-help-name]').each((index, element) => {
      const nodeName = $(element).attr('data-help-name');
      const helpContent = $(element).html();
      helpDocs[nodeName] = helpContent;
    });
    
    return helpDocs;
  }

  // 提取功能摘要
  extractSummary(helpHtml) {
    if (!helpHtml) return '';
    
    try {
      const $ = cheerio.load(helpHtml);
      
      // 尝试获取第一个 p 标签的内容
      const firstP = $('p').first().text();
      if (firstP) {
        return firstP.trim().replace(/\s+/g, ' ').substring(0, 200);
      }
      
      // 如果没有 p 标签，获取所有文本内容的前200个字符
      const allText = $.text().trim().replace(/\s+/g, ' ');
      return allText.substring(0, 200);
    } catch (error) {
      return '';
    }
  }

  // 生成扁平化的节点信息
  async generateFlatNodeInfo() {
    const completeInfo = await this.generateCompleteNodeInfo();
    const flatNodes = [];

    Object.values(completeInfo).forEach(module => {
      module.nodeSets.forEach(nodeSet => {
        nodeSet.nodeTypes.forEach(nodeType => {
          flatNodes.push({
            module: `${nodeType.module}/${nodeSet.nodeSetName}`,
            nodeType: nodeType.nodeType,
            category: nodeType.category,
            inputs: nodeType.inputs,
            outputs: nodeType.outputs,
            icon: nodeType.icon,
            color: nodeType.color,
            defaultProperties: nodeType.defaultProperties,
            functionalSummary: nodeType.functionalSummary,
            version: nodeType.version,
            enabled: nodeSet.enabled,
            isCore: module.isCore,
            hasButton: nodeType.hasButton,
            hasStatus: nodeType.hasStatus,
            align: nodeType.align,
            defaults: nodeType.defaults
          });
        });
      });
    });

    return flatNodes;
  }

  // 健康检查
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/settings`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const settings = await response.json();
        console.log('✅ Node-RED连接成功');
        console.log(`📊 版本: ${settings.version || 'unknown'}`);
        console.log(`🏠 httpRoot: ${settings.httpRoot || '/'}`);
        return true;
      } else {
        console.warn('⚠️ Node-RED响应异常:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Node-RED连接失败:', error.message);
      return false;
    }
  }
}

// 测试函数
async function runTest() {
  const nodeRedUrl = process.argv[2] || 'http://localhost:1880';
  
  console.log('🚀 Node-RED节点信息提取器测试开始');
  console.log(`🎯 目标: ${nodeRedUrl}`);
  console.log('=' * 50);

  // 使用提供的token进行认证
  const token = '7NWNOPSCV//kWmHWPV4IhvJPd0lIgdmllcFVhrbW1eHx/LvCutibB/8jST4oRMCoSVKMCDR/Anw4VoiftUHww1Eude3RY/5PxC8Us7mJSMdYDVc8jtomIZLyATHkIBc5v+ZRSK/eNwsKIuFBh0ilETNkov5AE6xntCVcfveVCXI=';
  
  const extractor = new NodeRedDetailExtractor(nodeRedUrl);
  extractor.accessToken = token; // 直接设置token
  
  try {
    // 健康检查
    console.log('🔍 正在进行健康检查...');
    const isHealthy = await extractor.healthCheck();
    
    if (!isHealthy) {
      console.log('⚠️ 健康检查失败，但继续尝试提取节点信息...');
    }

    // 提取节点信息
    console.log('🔄 开始提取节点信息...');
    const startTime = Date.now();
    
    const flatInfo = await extractor.generateFlatNodeInfo();
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    // 统计信息
    const coreNodes = flatInfo.filter(n => n.isCore);
    const thirdPartyNodes = flatInfo.filter(n => !n.isCore);
    const categories = [...new Set(flatInfo.map(n => n.category))];

    console.log('\n✅ 提取完成！');
    console.log(`⏱️ 耗时: ${duration.toFixed(2)}秒`);
    console.log(`📦 总节点数: ${flatInfo.length}`);
    console.log(`🔧 核心节点: ${coreNodes.length}`);
    console.log(`📚 第三方节点: ${thirdPartyNodes.length}`);
    console.log(`🏷️ 分类数: ${categories.length}`);

    // 显示示例节点
    console.log('\n📋 节点示例:');
    const sampleNodes = flatInfo.slice(0, 3);
    sampleNodes.forEach((node, index) => {
      console.log(`\n${index + 1}. ${node.nodeType} (${node.category})`);
      console.log(`   模块: ${node.module}`);
      console.log(`   输入/输出: ${node.inputs}/${node.outputs}`);
      console.log(`   图标: ${node.icon}`);
      console.log(`   摘要: ${node.functionalSummary.substring(0, 80)}...`);
    });

    // 保存结果
    const outputPath = join(__dirname, 'node-red-nodes-output.json');
    writeFileSync(outputPath, JSON.stringify(flatInfo, null, 2));
    console.log(`\n💾 结果已保存到: ${outputPath}`);

    // 生成统计报告
    const reportPath = join(__dirname, 'node-red-report.json');
    const report = {
      extractedAt: new Date().toISOString(),
      nodeRedUrl,
      totalNodes: flatInfo.length,
      coreNodes: coreNodes.length,
      thirdPartyNodes: thirdPartyNodes.length,
      categories: categories.sort(),
      extractionTime: `${duration.toFixed(2)}s`,
      sampleNodes: sampleNodes.map(n => ({
        nodeType: n.nodeType,
        category: n.category,
        module: n.module
      }))
    };
    
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 统计报告已保存到: ${reportPath}`);

    return { success: true, flatInfo, report };

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('📋 错误详情:', error.stack);
    return { success: false, error: error.message };
  }
}

// 主函数
async function main() {
  try {
    const result = await runTest();
    
    if (result.success) {
      console.log('\n🎉 测试成功完成！');
      process.exit(0);
    } else {
      console.log('\n💥 测试失败');
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 程序执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，则执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

// 导出类和函数供其他模块使用
export { NodeRedDetailExtractor, runTest }; 