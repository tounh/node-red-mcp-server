/**
 * MCP tools for managing prompts and templates
 * 提示词管理工具
 */

import { z } from 'zod';

/**
 * 提示词模板库
 */
const PROMPT_TEMPLATES = {
  'node-red-flow-generation': {
    name: 'Node-RED工作流生成规范',
    description: '用于自然语言生成Node-RED工作流的专业提示词',
    template: `你是一个专业的Node-RED工作流生成专家。请根据用户的自然语言描述，生成符合Node-RED标准的工作流JSON配置。

## 核心规则

1. **节点结构规范**：
   - 每个节点必须包含：id, type, name, x, y, z, wires
   - id使用16位随机字符串（如: "abc123def456gh78"）
   - z字段留空，由系统自动填充
   - 坐标系统：x水平位置，y垂直位置，建议间距150-200px

2. **常用节点类型**：
   - http in: HTTP请求接收器
   - http response: HTTP响应发送器  
   - function: JavaScript函数节点
   - debug: 调试输出节点
   - inject: 注入节点（测试用）
   - switch: 条件分支节点
   - change: 数据转换节点
   - template: 模板节点
   - http request: HTTP请求发送器

3. **连接规范（wires）**：
   - wires是二维数组，第一维表示输出端口，第二维表示连接的节点ID
   - 单输出: "wires": [["目标节点ID"]]
   - 多输出: "wires": [["节点1"], ["节点2"], []]
   - 无连接: "wires": [[]]

4. **布局规范**：
   - 起始x=100, y=100
   - 水平间距200px，垂直间距100px  
   - 同类型节点垂直对齐
   - 流程从左到右，从上到下

5. **特殊配置**：
   - http in节点需要url和method属性
   - function节点需要func属性（JavaScript代码）
   - debug节点设置complete为true获取完整消息

## 输出格式

请严格按照以下JSON格式输出，只返回nodes数组：

\`\`\`json
{
  "nodes": [
    {
      "id": "节点ID",
      "type": "节点类型", 
      "name": "节点名称",
      "x": 坐标x,
      "y": 坐标y,
      "z": "",
      "wires": [连接配置],
      // 其他特定属性...
    }
  ]
}
\`\`\`

## 示例参考

**HTTP API接口工作流**：
\`\`\`json
{
  "nodes": [
    {
      "id": "http_in_001",
      "type": "http in",
      "name": "API接口",
      "url": "/api/test",
      "method": "post",
      "x": 100,
      "y": 100,
      "z": "",
      "wires": [["function_001"]]
    },
    {
      "id": "function_001", 
      "type": "function",
      "name": "处理逻辑",
      "func": "msg.payload = {result: '处理完成', input: msg.payload};\nreturn msg;",
      "x": 300,
      "y": 100,
      "z": "",
      "wires": [["http_response_001"]]
    },
    {
      "id": "http_response_001",
      "type": "http response",
      "name": "返回响应", 
      "x": 500,
      "y": 100,
      "z": "",
      "wires": []
    }
  ]
}
\`\`\`

现在请根据用户需求生成相应的Node-RED工作流配置。

用户需求：{USER_REQUIREMENT}`
  },

  'node-red-error-fix': {
    name: 'Node-RED错误修复提示词',
    description: '用于修复Node-RED工作流错误的专业提示词',
    template: `你是Node-RED工作流错误修复专家。请分析以下错误信息，并修复工作流配置。

## 错误信息
{ERROR_MESSAGE}

## 原始工作流配置  
{ORIGINAL_FLOW}

## 修复规则

1. **常见错误类型**：
   - JSON格式错误：缺少逗号、括号不匹配
   - 节点ID重复：确保每个节点ID唯一
   - 连接错误：wires引用不存在的节点ID
   - 属性缺失：必需属性未定义
   - 坐标重叠：多个节点坐标相同

2. **修复策略**：
   - 保持现有节点不变（除非有错误）
   - 只修复有问题的部分
   - 确保JSON格式正确
   - 验证所有连接的有效性
   - 调整重叠的坐标

3. **输出要求**：
   - 返回修复后的完整工作流JSON
   - 在注释中说明修复的内容
   - 确保语法和逻辑正确

请修复上述错误并返回正确的工作流配置。`
  },

  'node-red-enhancement': {
    name: 'Node-RED功能增强提示词', 
    description: '用于为现有工作流添加新功能的提示词',
    template: `你是Node-RED工作流功能增强专家。请在现有工作流基础上，添加用户要求的新功能。

## 现有工作流
{EXISTING_FLOW}

## 新功能需求
{NEW_REQUIREMENT}

## 增强规则

1. **保持兼容性**：
   - 不修改现有节点的核心功能
   - 保持现有API接口不变
   - 确保现有流程正常运行

2. **智能集成**：
   - 新节点布局在合适位置
   - 复用现有的公共节点
   - 合理的连接和数据流

3. **坐标分配**：
   - 分析现有节点坐标分布
   - 新节点避免重叠
   - 保持良好的视觉布局

4. **输出格式**：
   - 返回包含新功能的完整工作流
   - 只添加必要的新节点
   - 保持JSON格式正确

请基于现有工作流添加新功能，返回增强后的完整配置。`
  }
};

/**
 * Registers prompt-related tools in the MCP server
 * @param {Object} server - MCP server instance  
 * @param {Object} config - Server configuration
 */
export default function registerPromptTools(server, config) {
  // ✅ RECOMMENDED: Get prompt template
  server.tool(
    'get-prompt-template',
    {
      templateName: z.string().describe('提示词模板名称'),
      variables: z.record(z.string()).optional().describe('模板变量替换（可选）')
    },
    async ({ templateName, variables = {} }) => {
      try {
        const template = PROMPT_TEMPLATES[templateName];
        
        if (!template) {
          const availableTemplates = Object.keys(PROMPT_TEMPLATES)
            .map(name => `- ${name}: ${PROMPT_TEMPLATES[name].description}`)
            .join('\n');
          
          return {
            content: [{
              type: 'text',
              text: `模板不存在: "${templateName}"\n\n可用模板：\n${availableTemplates}`
            }]
          };
        }
        
        // 替换模板变量
        let processedTemplate = template.template;
        Object.keys(variables).forEach(key => {
          const placeholder = `{${key.toUpperCase()}}`;
          processedTemplate = processedTemplate.replace(
            new RegExp(placeholder, 'g'), 
            variables[key]
          );
        });
        
        return {
          content: [{
            type: 'text',
            text: `模板名称: ${template.name}\n描述: ${template.description}\n\n${processedTemplate}`
          }]
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  );

  // ✅ RECOMMENDED: List available prompt templates
  server.tool(
    'list-prompt-templates',
    {},
    async () => {
      try {
        const templateList = Object.entries(PROMPT_TEMPLATES)
          .map(([key, template]) => `- **${key}**: ${template.description}`)
          .join('\n');
        
        return {
          content: [{
            type: 'text',
            text: `可用的提示词模板：\n\n${templateList}`
          }]
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
      }
    }
  );
} 