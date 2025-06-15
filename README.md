# 🚀 @tounh/node-red-mcp-server

[![NPM 版本](https://img.shields.io/npm/v/@tounh/node-red-mcp-server.svg)](https://www.npmjs.com/package/@tounh/node-red-mcp-server)
[![NPM 下载量](https://img.shields.io/npm/dm/@tounh/node-red-mcp-server.svg)](https://www.npmjs.com/package/@tounh/node-red-mcp-server)
[![GitHub 许可证](https://img.shields.io/github/license/tounh/node-red-mcp-server.svg)](https://github.com/tounh/node-red-mcp-server/blob/main/LICENSE)

**`@tounh/node-red-mcp-server`** 是一个为 [Node-RED](https://nodered.org/) 设计的智能模型上下文协议（MCP）服务器。它允许AI语言模型（如 Claude、GPT 等）通过标准化 API 与 Node-RED 进行深度交互，实现自动化工作流的智能编程控制。

🎯 **让AI与Node-RED无缝协作，实现智能化工作流管理！**

## ✨ 核心特性

### 🧠 智能工作流管理
- **语义逻辑布局**: 基于连线关系的智能节点布局算法，按功能逻辑自动分组
- **智能区域避让**: 新节点自动避开现有内容，支持安全区域计算
- **多种布局算法**: auto、collision_free、dagre_lr、grid 四种布局模式

### 🔧 高级工程能力
- **坐标保护机制**: 防止节点位置丢失，支持智能坐标管理
- **智能上下文管理**: 针对大型语言模型优化，有效控制上下文大小
- **动态认证系统**: 自动管理令牌，无感刷新，提升安全性
- **Mermaid可视化**: 流程图表自动生成

### 🎯 AI集成优化
- **完整MCP工具集**: 涵盖流程、节点、系统、可视化、提示词管理等功能
- **智能依赖分析**: 轻量级流程关系分析，避免高内存消耗
- **精准操作模式**: 优先单流程操作，支持按需搜索和上下文控制
- **节点状态感知**: 实时获取节点模块的启用/禁用状态，支持智能化管理

## 📦 安装

你可以根据需要选择全局安装或本地安装：

**全局安装 (推荐)**:
```bash
npm install -g @tounh/node-red-mcp-server
```

**本地安装**:
```bash
npm install @tounh/node-red-mcp-server
```

## 🚀 快速上手

### 命令行启动

**使用动态认证 (推荐)**:
```bash
node-red-mcp-server --url http://localhost:1880 --username admin --password your_password
```

**使用静态令牌**:
```bash
node-red-mcp-server --url http://localhost:1880 --token YOUR_TOKEN
```

### 通过 `.env` 文件配置

创建 `.env` 文件：

**动态认证方式 (推荐)**:
```env
NODE_RED_URL=http://localhost:1880
NODE_RED_USERNAME=your_username
NODE_RED_PASSWORD=your_password
```

**静态令牌方式**:
```env
NODE_RED_URL=http://localhost:1880
NODE_RED_TOKEN=YOUR_STATIC_TOKEN
```

然后运行:
```bash
node-red-mcp-server
```

## 🤖 Cursor IDE 集成配置

### 方式一：NPX 在线运行 (推荐)

在 Cursor 的 MCP 配置文件中添加：

```json
{
  "mcpServers": {
    "node-red": {
      "command": "npx",
      "args": [
        "--yes",
        "@tounh/node-red-mcp-server",
        "--verbose"
      ],
      "env": {
        "NODE_RED_URL": "http://localhost:1880",
        "NODE_RED_USERNAME": "your-username", 
        "NODE_RED_PASSWORD": "your-password"
      }
    }
  }
}
```

### 方式二：本地安装运行

**步骤1**: 下载并安装到本地：
```bash
npm install -g @tounh/node-red-mcp-server
```

**步骤2**: 在 Cursor 的 MCP 配置文件中添加：
```json
{
  "mcpServers": {
    "node-red": {
      "command": "node",
      "args": [
        "/path/to/node_modules/@tounh/node-red-mcp-server/bin/node-red-mcp-server.mjs",
        "--verbose"
      ],
      "env": {
        "NODE_RED_URL": "http://localhost:1880",
        "NODE_RED_USERNAME": "your-username",
        "NODE_RED_PASSWORD": "your-password"
      }
    }
  }
}
```

## 🛠️ 核心 MCP 工具集

### 🎯 智能流程工具

#### ✅ 推荐操作（高效、精准）
- **`get-flow`**: 按 ID 或名称获取特定工作流
- **`update-flow`**: 智能更新工作流（支持合并模式和坐标保护）
- **`create-flow`**: 创建新的工作流标签页
- **`delete-flow`**: 删除指定工作流
- **`list-tabs`**: 列出所有标签页概览
- **`manage-flows-state`**: 工作流状态管理（启动/停止）



#### ⚠️ 全量操作（谨慎使用）
- **`get-flows`**: 获取所有工作流（高内存消耗）

### 📊 可视化分析工具

#### ⚡ Mermaid 图表生成
- **`generate-flow-chart`**: 流程架构图 - 展示节点连接关系和工作流结构

### 🔧 系统控制工具

#### ✅ 节点操作
- **`inject`**: 触发注入节点
- **`get-nodes`**: 获取节点信息（支持模块过滤和通配符匹配，包含启用状态）
  - `module: "node-red-contrib-csv"` - 可选：过滤特定模块的节点
  - `specificNodes: ["csv*", "*mqtt*", "debug"]` - 可选：支持通配符的节点过滤
  - `returnRaw: false` (默认) - 返回格式：原始 HTML 或处理后数据
  - `minimalFormat: true` (默认) - 输出格式：简化或详细
  - **✨ 新增**: 每个节点包含 `enabled` 字段，显示模块在 Node-RED 中的启用状态
- **`manage-node-module`**: 节点模块管理（安装/卸载/启用/禁用）

#### ✅ 系统状态
- **`get-system-info`**: 获取系统运行信息（设置/诊断/版本等）
- **`auth`**: 统一认证管理（检查状态/刷新令牌）



### 使用示例

#### 工作流操作
```javascript
// 更新现有工作流
update-flow(
  identifier: "my-flow",
  flowJson: "{...工作流配置...}",
  mergeMode: "merge"  // 或 add-only, replace
)
```

#### 节点信息查询
```javascript
// 获取特定节点信息（包含启用状态）
get-nodes(
  specificNodes: ["inject", "debug"],
  minimalFormat: true
)

// 返回示例：
{
  "nodes": [
    {
      "type": "inject",
      "name": "inject",
      "category": "common",
      "module": "node-red",
      "enabled": true,  // ✨ 新增：模块启用状态
      "color": "#a6bbcf",
      "inputs": 0,
      "outputs": 1,
      "icon": "inject.svg"
    }
  ]
}
```

## 🛡️ 坐标保护与智能合并

### 坐标保护机制
- **✅ 自动保护**: 默认保留现有节点的 x、y 坐标
- **🧠 智能合并**: 支持三种合并模式（replace、merge、add-only）
- **📐 自动布局**: 新节点自动放置在不冲突的位置
- **🔍 冲突检测**: 自动检测坐标冲突并调整位置

## 💡 最佳实践建议

### 🎯 高效操作模式
1. **精准操作优先**: 使用 `get-flow`、`update-flow` 等单流程操作
2. **智能布局**: 优先使用 `auto` 或 `collision_free` 布局算法
3. **上下文控制**: 指定具体流程标签或ID避免全量加载
4. **坐标保护**: 保持默认坐标保护，确保布局稳定性

### 🚫 避免的操作
1. **❌ 全量拉取**: 避免 `get-flows` 等全量操作
2. **❌ 无限制搜索**: 搜索时指定具体流程ID和条件  
3. **❌ 过度更新**: 避免频繁的全量流程更新

### ⚡ 性能优化
- **流程ID优先**: 了解目标流程，直接操作
- **分步处理**: 大批量修改分解为多个小操作
- **依赖预分析**: 使用依赖分析工具减少试错

## 🔐 认证配置

### 动态认证 (推荐) 🔄
- **自动令牌管理**: 自动获取和续订访问令牌
- **过期处理**: 监控令牌过期并提前刷新
- **重试逻辑**: 认证失败时自动重试
- **安全性更高**: 使用短生命周期令牌

### 静态令牌认证
使用 Node-RED 生成的预共享访问令牌，需要手动更新。

## 🔧 配置参数

### CLI 参数
| 参数 | 缩写 | 描述 |
|------|------|------|
| `--url` | `-u` | Node-RED 基础 URL |
| `--username` | | 动态认证用户名 |
| `--password` | | 动态认证密码 |
| `--token` | `-t` | 静态 API 访问令牌 |
| `--verbose` | `-v` | 启用详细日志 |
| `--help` | `-h` | 显示帮助信息 |

### 环境变量
| 变量 | 描述 |
|------|------|
| `NODE_RED_URL` | Node-RED 实例的 URL |
| `NODE_RED_USERNAME` | 动态认证的用户名 |
| `NODE_RED_PASSWORD` | 动态认证的密码 |
| `NODE_RED_TOKEN` | 静态 API 访问令牌 |

## ✅ 系统要求

- **Node.js**: v16 或更高版本
- **Node-RED**: 正在运行并可访问 HTTP API 的实例
- **认证配置**: 动态认证需要配置 `adminAuth`
- **AI工具**: 支持 MCP 协议的客户端（如 Cursor、Claude Desktop）

## 🔗 相关链接

- [Node-RED 官方网站](https://nodered.org/)
- [MCP 协议文档](https://modelcontextprotocol.io/introduction)  
- [Mermaid 图表语法](https://mermaid.js.org/)
- [项目问题反馈](https://github.com/tounh/node-red-mcp-server/issues)
- [Cursor IDE 官方网站](https://cursor.sh/)

## 📄 许可证

本项目采用 MIT 许可证。

---

**🎯 专为AI与Node-RED协作而生，让智能化工作流管理触手可及！**
