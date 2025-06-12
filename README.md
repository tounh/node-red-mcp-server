# 🚀 @tounh/node-red-mcp-server

[![NPM 版本](https://img.shields.io/npm/v/@tounh/node-red-mcp-server.svg)](https://www.npmjs.com/package/@tounh/node-red-mcp-server)
[![NPM 下载量](https://img.shields.io/npm/dm/@tounh/node-red-mcp-server.svg)](https://www.npmjs.com/package/@tounh/node-red-mcp-server)
[![GitHub 许可证](https://img.shields.io/github/license/tounh/node-red-mcp-server.svg)](https://github.com/tounh/node-red-mcp-server/blob/main/LICENSE)


**`@tounh/node-red-mcp-server`** 是一个为 [Node-RED](https://nodered.org/) 设计的模型上下文协议（MCP）服务器。它允许语言模型（如 Claude、GPT 等）通过一套标准化的 API 与 Node-RED 进行交互，实现自动化工作流的编程控制。

简单来说，它就是一座连接 AI 语言模型和你的 Node-RED 项目的桥梁！🌉

## ✨ 核心功能

- 🀄️ **流程管理**: 通过 MCP 检索和更新 Node-RED 的工作流。
- 🧩 **节点控制**: 管理标签页和单个节点，按类型或属性搜索。
- ⚙️ **状态访问**: 获取设置和运行时状态。
- 💉 **远程触发**: 远程触发注入（`inject`）节点。
- 📊 **Mermaid可视化**: 支持4种核心模式的流程图表自动生成，专注最实用的可视化功能。
- 🧠 **智能上下文管理**: 专为大型语言模型优化，有效控制上下文大小。
- 🔄 **动态认证**: 推荐使用动态认证，自动管理令牌，无感刷新。

## 📦 安装

你可以根据需要选择全局安装或本地安装。

**全局安装 (推荐)**:

```bash
npm install -g @tounh/node-red-mcp-server
```

**本地安装**:

```bash
npm install @tounh/node-red-mcp-server
```

## 🔄 更新

**全局安装的用户**:

```bash
npm update -g @tounh/node-red-mcp-server
```

**本地安装的用户**:

在你的项目目录中运行：

```bash
npm update @tounh/node-red-mcp-server
```

**使用 `npx` 的用户**:

无需任何操作！`npx` 每次运行时都会获取最新的版本，确保你使用的总是最新的代码。

## 🚀 快速上手

有多种方式可以启动服务器：

### 命令行启动

**使用静态令牌**:

```bash
node-red-mcp-server --url http://localhost:1880 --token YOUR_TOKEN
```

**使用动态认证 (推荐)**:

```bash
node-red-mcp-server --url http://localhost:1880 --username admin --password your_password
```

### 通过 `.env` 文件配置

在项目根目录创建一个 `.env` 文件，内容如下：

**选项 1: 静态令牌**

```env
NODE_RED_URL=http://localhost:1880
NODE_RED_TOKEN=YOUR_STATIC_TOKEN
```

**选项 2: 动态认证 (推荐)**

```env
NODE_RED_URL=http://localhost:1880
NODE_RED_USERNAME=your_username
NODE_RED_PASSWORD=your_password
```

然后运行:

```bash
node-red-mcp-server
```

### 🤖 与 Claude 等语言模型集成

1.  启动 MCP 服务器，或在 AI 工具（如 Claude Desktop）中配置自动启动。
2.  在你的 AI 工具中添加一个新的工具配置：

    ```json
    {
      "mcpServers": {
        "node-red": {
          "command": "node",
          "args": [
            "/path/to/@tounh/node-red-mcp-server/bin/node-red-mcp-server.mjs",
            "--verbose"
          ],
          "env": {
            "NODE_RED_URL": "http://your-node-red-url:1880",
            "NODE_RED_USERNAME": "your-username",
            "NODE_RED_PASSWORD": "your-password"
          }
        }
      }
    }
    ```

    - 确保将 `/path/to/@tounh/node-red-mcp-server` 替换为你的实际安装路径。
    - 更新 `NODE_RED_URL`、`NODE_RED_USERNAME` 和 `NODE_RED_PASSWORD`。

3.  配置完成后，你的 AI 助手就可以通过 MCP 工具与 Node-RED 实例交互了。
### 通过 `npx` 临时运行

如果你不想全局或本地安装，可以直接使用 `npx` 来运行 MCP 服务器。这在临时测试或作为大型工具链一部分时非常有用。

在你的 AI 工具（如 Claude Desktop）的工具配置中，有两种方式来传递配置：

**方式一：通过命令行参数 (简单但不推荐用于敏感信息)**

```json
{
  "mcpServers": {
    "node-red": {
      "command": "npx",
      "args": [
        "--yes",
        "@tounh/node-red-mcp-server",
        "--url", "http://your-node-red-url:1880",
        "--username", "your-username",
        "--password", "your-password",
        "--verbose"
      ]
    }
  }
}
```

**方式二：通过环境变量 (推荐)**

这种方式更安全，因为它避免了将密码等敏感信息直接写在命令行里。

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
        "NODE_RED_URL": "http://your-node-red-url:1880",
        "NODE_RED_USERNAME": "your-username",
        "NODE_RED_PASSWORD": "your-password"
      }
    }
  }
}
```

- `npx` 会自动下载最新版本的包，并在运行后清理，不会污染你的全局环境。
- 优先推荐使用 `env` 环境变量来配置，更加安全和灵活。
- `--yes` 参数确保自动确认包安装，无需手动交互。

### 📋 Windows 配置路径

在 Windows 上，Claude Desktop 的配置文件位于：
```
%APPDATA%\Claude\claude_desktop_config.json
```

有关模型上下文协议的更多信息，请访问 [官方 MCP 文档](https://modelcontextprotocol.io/introduction)。

## 🔧 配置选项

### CLI 参数

| 参数 | 缩写 | 描述 |
| :--- | :--- | :--- |
| `--url` | `-u` | Node-RED 基础 URL |
| `--token` | `-t` | 静态 API 访问令牌 |
| `--username` | | 动态认证的用户名 |
| `--password` | | 动态认证的密码 |
| `--verbose` | `-v` | 启用详细日志 |
| `--help` | `-h` | 显示帮助信息 |
| `--version` | `-V` | 显示版本号 |

### 环境变量

| 变量 | 描述 |
| :--- | :--- |
| `NODE_RED_URL` | Node-RED 实例的 URL |
| `NODE_RED_TOKEN` | 静态 API 访问令牌 |
| `NODE_RED_USERNAME` | 动态认证的用户名 |
| `NODE_RED_PASSWORD` | 动态认证的密码 |

## 🛠️ 可用的 MCP 工具

### 流程工具 (Flow Tools)

- `get-flows`: 获取所有工作流
- `update-flows`: 更新所有工作流
- `get-flow`: 按 ID 获取特定工作流
- `get-flow-with-context`: 使用智能上下文控制获取工作流
- `analyze-flow-dependencies`: 分析工作流依赖关系
- `update-flow`: 按 ID 更新特定工作流
- `list-tabs`: 列出所有标签页
- `create-flow`: 创建新的工作流标签页
- `delete-flow`: 删除工作流标签页
- `get-flows-state`: 获取部署状态
- `set-flows-state`: 更改部署状态
- `get-flows-formatted`: 获取人类可读的工作流列表
- `visualize-flows`: 生成流程图的可视化视图

### 节点工具 (Node Tools)

- `inject`: 触发一个注入节点
- `get-nodes`: 列出可用的节点类型
- `get-node-info`: 获取节点模块的详细信息
- `toggle-node-module`: 启用/禁用节点模块
- `find-nodes-by-type`: 按类型定位节点
- `search-nodes`: 按名称或属性查找节点

### 设置工具 (Settings Tools)

- `get-settings`: 获取 Node-RED 运行时设置
- `get-diagnostics`: 获取诊断信息

### Mermaid可视化工具 (Mermaid Tools)

专为Node-RED工作流设计的4种核心可视化模式：

- `generate-flow-chart`: 生成流程架构图 - 展示节点连接关系和整体架构
- `generate-sequence-diagram`: 生成通信序列图 - 分析节点间的消息传递时序
- `generate-dataflow-diagram`: 生成数据流图 - 追踪数据在系统中的流转路径
- `generate-state-diagram`: 生成状态变化图 - 可视化系统状态转换逻辑

**特色功能**:
- 🎯 **智能分析**: 自动识别节点类型和关系，生成高质量图表
- 🔍 **流程过滤**: 支持指定特定流程标签进行精准分析
- 📋 **即用格式**: 直接输出标准Mermaid代码，可在任何支持的平台使用
- ⚡ **快速生成**: 优化算法，快速处理复杂流程

### 实用工具 (Utility Tools)

- `api-help`: 显示 Node-RED API 帮助
- `auth-status`: 检查认证状态和令牌有效性
- `refresh-token`: 手动刷新认证令牌（仅限动态认证）

## 🧠 智能上下文管理

为了解决大型语言模型（LLM）的上下文窗口限制，我们提供了智能的上下文管理工具。

#### `get-flow-with-context` - 智能上下文控制

此工具可以控制在处理特定工作流时检索多少上下文信息：

- **🎯 Minimal (最小)**: 默认模式，最节省 Token。适用于简单的节点修改。
- **🔗 Related (相关)**: 平衡模式。获取相关标签页和全局配置摘要，适用于跨流程修改。
- **🌐 Full (完整)**: 获取所有工作流信息。**请谨慎使用**，适用于大型重构。

#### `analyze-flow-dependencies` - 轻量级依赖分析

在不加载完整内容的情况下分析流程关系。

### AI 提示词示例

- **最小上下文**: `"请修改工作流'sensor-data'中的HTTP请求节点，将URL改为新的API端点"`
- **相关上下文**: `"我要修改'dashboard'工作流，但需要确保不与其他工作流的变量名冲突"`
- **完整上下文**: `"请重新组织整个Node-RED项目，按功能模块重新分配工作流"`
- **依赖分析**: `"分析'api-gateway'工作流使用了哪些全局变量和外部依赖"`

## 🔐 认证方式

支持两种认证方法：

### 1. 静态令牌认证

使用从 Node-RED 生成的预共享访问令牌。令牌过期后需要手动更新。

### 2. 动态认证 (推荐) 🔄

使用用户名/密码凭据自动管理认证令牌。

- **自动令牌管理**: 自动获取和续订令牌。
- **过期处理**: 监控令牌过期并在到期前刷新。
- **重试逻辑**: 在认证失败时使用新令牌自动重试 API 调用。
- **状态监控**: 检查令牌状态和剩余有效期。

**工作原理**:
1. 启动时，服务器使用用户名/密码向 Node-RED 进行身份验证。
2. 收到一个带过期时间的访问令牌（通常为 7 天）。
3. 监控令牌过期并在到期前自动刷新。
4. 如果 API 调用因 401 (Unauthorized) 失败，会自动刷新令牌并重试。

**优点**:
-无需手动管理令牌。
-在令牌更新期间服务不中断。
-使用生命周期更短的令牌，安全性更高。

## ✅ 要求

- Node.js v16 或更高版本
- 一个正在运行并可访问 HTTP API 的 Node-RED 实例
- 对于动态认证：Node-RED 实例需要配置 `adminAuth`

## 📄 许可证

本项目采用 MIT 许可证。

---

## 🧑‍💻 开发提示

### 如何更新 npm

如果你在开发过程中需要更新你的 npm 客户端到最新版本，可以运行以下命令：

```bash
npm install -g npm@latest
```

运行此命令后，建议关闭并重新打开你的命令行工具，以确保新版本的 npm 生效。

### 🔗 相关链接

- [Node-RED 官方网站](https://nodered.org/)
- [MCP 协议文档](https://modelcontextprotocol.io/introduction)
- [Mermaid 图表语法](https://mermaid.js.org/)
- [项目问题反馈](https://github.com/tounh/node-red-mcp-server/issues)
