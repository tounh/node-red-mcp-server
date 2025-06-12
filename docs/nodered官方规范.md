# Node-RED官方规范文档

## 目录

1. [基础概念](#基础概念)
2. [流程格式规范](#流程格式规范)
3. [节点定义规范](#节点定义规范)
4. [Admin HTTP API](#admin-http-api)
5. [Runtime API](#runtime-api)
6. [Storage API](#storage-api)
7. [消息格式](#消息格式)
8. [配置模式](#配置模式)
9. [部署流程](#部署流程)
10. [错误处理](#错误处理)
11. [安全机制](#安全机制)
12. [扩展开发](#扩展开发)

---

## 基础概念

### 核心组件

#### Flow（流程）
- **定义**: Node-RED中的基本工作单元，包含一系列相互连接的节点
- **格式**: JSON数组，每个元素代表一个节点或连接
- **标识**: 通过唯一的flow ID进行识别

#### Node（节点）
- **定义**: 流程中的处理单元，执行特定功能
- **类型**: 输入节点、处理节点、输出节点、配置节点
- **属性**: id, type, name, wires, 以及特定于节点的配置属性

#### Message（消息）
- **定义**: 节点间传递的数据载体
- **格式**: JavaScript对象
- **核心属性**: payload（主要内容）, topic（主题）, _msgid（消息ID）

---

## 流程格式规范

### Flow JSON结构

```json
[
  {
    "id": "unique-node-id",
    "type": "node-type",
    "z": "flow-id",
    "name": "节点名称",
    "wires": [["output-node-id"]],
    "x": 100,
    "y": 100,
    "width": 60,
    "height": 30
  }
]
```

### 必需字段

- **id**: 节点唯一标识符（UUID格式）
- **type**: 节点类型名称
- **z**: 所属流程的ID

### 可选字段

- **name**: 节点显示名称
- **wires**: 输出连接数组
- **x, y**: 节点在编辑器中的位置坐标
- **width, height**: 节点尺寸

### 流程级属性

```json
{
  "id": "flow-id",
  "type": "tab",
  "label": "流程标签",
  "disabled": false,
  "info": "流程描述信息"
}
```

---

## 节点定义规范

### 节点类型分类

#### 1. 输入节点（Input Nodes）
- **inject**: 手动或定时注入消息
- **http in**: HTTP请求接收
- **mqtt in**: MQTT消息订阅
- **file in**: 文件读取
- **serial in**: 串口数据接收

#### 2. 处理节点（Function Nodes）
- **function**: JavaScript函数处理
- **change**: 消息属性修改
- **switch**: 条件分支路由
- **template**: 模板处理
- **delay**: 延时处理

#### 3. 输出节点（Output Nodes）
- **debug**: 调试输出
- **http response**: HTTP响应
- **mqtt out**: MQTT消息发布
- **file out**: 文件写入
- **email**: 邮件发送

#### 4. 配置节点（Config Nodes）
- **mqtt-broker**: MQTT代理配置
- **http request**: HTTP请求配置
- **tls-config**: TLS配置

### 节点属性架构

```json
{
  "id": "节点ID",
  "type": "节点类型",
  "z": "流程ID",
  "name": "节点名称",
  "topic": "消息主题",
  "payload": "消息载荷",
  "payloadType": "载荷类型",
  "repeat": "重复间隔",
  "crontab": "定时表达式",
  "once": "启动时执行",
  "onceDelay": "启动延时",
  "wires": [["输出节点ID"]]
}
```

---

## Admin HTTP API

### 基础端点

#### 流程管理

```http
GET /flows
```
- **功能**: 获取所有流程
- **返回**: JSON格式的流程配置

```http
POST /flows
```
- **功能**: 部署新的流程配置
- **请求体**: JSON格式的流程数组
- **参数**: 
  - `deploymentType`: 部署类型（full, nodes, flows）

```http
GET /flow/:id
```
- **功能**: 获取特定流程
- **参数**: flow ID

```http
PUT /flow/:id
```
- **功能**: 更新特定流程
- **请求体**: 流程配置JSON

```http
DELETE /flow/:id
```
- **功能**: 删除特定流程

#### 节点管理

```http
GET /nodes
```
- **功能**: 获取已安装的节点类型列表

```http
POST /nodes
```
- **功能**: 安装新的节点模块
- **请求体**: 
```json
{
  "module": "node-red-contrib-example"
}
```

```http
DELETE /nodes/:module
```
- **功能**: 卸载节点模块

#### 项目管理

```http
GET /projects
```
- **功能**: 获取项目列表

```http
POST /projects
```
- **功能**: 创建新项目

```http
GET /projects/:name
```
- **功能**: 获取项目详情

### 认证端点

```http
POST /auth/login
```
- **功能**: 用户登录
- **请求体**:
```json
{
  "client_id": "node-red-admin",
  "grant_type": "password",
  "scope": "",
  "username": "用户名",
  "password": "密码"
}
```

```http
POST /auth/revoke
```
- **功能**: 撤销认证令牌

---

## Runtime API

### Context API

#### 获取Context数据

```http
GET /context/global
GET /context/flow/:id
GET /context/node/:id
```

#### 设置Context数据

```http
PUT /context/global/:key
PUT /context/flow/:id/:key
PUT /context/node/:id/:key
```

### 诊断API

```http
GET /diagnostics
```
- **功能**: 获取系统诊断信息
- **返回**: 内存使用、节点状态等

---

## Storage API

### 文件操作

```http
GET /library/:type/*
```
- **功能**: 读取库文件
- **类型**: flows, functions, templates

```http
POST /library/:type/*
```
- **功能**: 保存到库

```http
GET /settings
```
- **功能**: 获取运行时设置

---

## 消息格式

### 标准消息结构

```javascript
{
  _msgid: "唯一消息ID",
  topic: "消息主题",
  payload: "消息内容",
  _event: "事件类型",
  _path: "消息路径",
  req: "HTTP请求对象（如适用）",
  res: "HTTP响应对象（如适用）"
}
```

### 消息属性类型

- **payload**: 任意类型的主要数据
- **topic**: 字符串类型的消息主题
- **_msgid**: 自动生成的消息唯一标识
- **error**: 错误信息对象

### 特殊消息属性

- **complete**: 指示消息处理完成
- **error**: 包含错误详情的对象
- **statusCode**: HTTP状态码
- **headers**: HTTP头信息
- **cookies**: Cookie信息

---

## 配置模式

### settings.js配置文件

```javascript
module.exports = {
    // 运行时端口
    uiPort: process.env.PORT || 1880,
    
    // 编辑器路径
    httpAdminRoot: '/admin',
    
    // HTTP节点路径
    httpNodeRoot: '/api',
    
    // 用户目录
    userDir: '.node-red/',
    
    // 流程文件
    flowFile: 'flows.json',
    
    // 凭据加密密钥
    credentialSecret: false,
    
    // 函数节点配置
    functionGlobalContext: {},
    
    // 日志配置
    logging: {
        console: {
            level: "info",
            metrics: false,
            audit: false
        }
    },
    
    // 编辑器主题
    editorTheme: {
        projects: {
            enabled: false
        }
    },
    
    // 安全配置
    adminAuth: {
        type: "credentials",
        users: [{
            username: "admin",
            password: "$2a$08$...",
            permissions: "*"
        }]
    }
};
```

### 环境变量

- **PORT**: 服务器端口
- **NODE_RED_CREDENTIAL_SECRET**: 凭据加密密钥
- **NODE_OPTIONS**: Node.js选项

---

## 部署流程

### 部署类型

1. **Full Deploy**: 完整部署所有流程
2. **Modified Flows**: 仅部署修改的流程
3. **Modified Nodes**: 仅部署修改的节点

### 部署过程

1. **验证阶段**: 检查流程语法和依赖
2. **停止阶段**: 停止当前运行的流程
3. **配置阶段**: 加载新的流程配置
4. **启动阶段**: 启动新流程

### 部署响应

```json
{
  "type": "full",
  "revision": "部署版本号",
  "timestamp": 1234567890
}
```

---

## 错误处理

### 错误类型

1. **语法错误**: 流程JSON格式错误
2. **配置错误**: 节点配置无效
3. **运行时错误**: 节点执行异常
4. **网络错误**: 网络连接问题

### 错误格式

```javascript
{
  source: {
    id: "节点ID",
    type: "节点类型",
    name: "节点名称"
  },
  level: "error|warn|info",
  msg: "错误消息",
  timestamp: 1234567890
}
```

### 错误处理机制

- **Catch节点**: 捕获流程中的错误
- **Status节点**: 监控节点状态变化
- **Debug节点**: 输出调试信息

---

## 安全机制

### 认证方式

1. **无认证**: 开发环境
2. **用户名密码**: 基础认证
3. **OAuth**: 第三方认证
4. **证书认证**: TLS客户端证书

### 权限控制

```javascript
{
  "*": ["read", "write"],
  "flows": ["read", "write"],
  "nodes": ["read"],
  "settings": ["read"]
}
```

### HTTPS配置

```javascript
https: {
    key: fs.readFileSync('privatekey.pem'),
    cert: fs.readFileSync('certificate.pem')
}
```

---

## 扩展开发

### 自定义节点开发

#### 节点定义文件（.js）

```javascript
module.exports = function(RED) {
    function SampleNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        
        node.on('input', function(msg) {
            // 处理输入消息
            msg.payload = msg.payload.toUpperCase();
            node.send(msg);
        });
    }
    
    RED.nodes.registerType("sample", SampleNode);
}
```

#### 节点HTML定义

```html
<script type="text/javascript">
    RED.nodes.registerType('sample', {
        category: 'function',
        color: '#a6bbcf',
        defaults: {
            name: {value: ""}
        },
        inputs: 1,
        outputs: 1,
        icon: "file.png",
        label: function() {
            return this.name || "sample";
        }
    });
</script>

<script type="text/html" data-template-name="sample">
    <div class="form-row">
        <label for="node-input-name"><i class="icon-tag"></i> Name</label>
        <input type="text" id="node-input-name" placeholder="Name">
    </div>
</script>
```

#### package.json配置

```json
{
  "name": "node-red-contrib-sample",
  "version": "1.0.0",
  "description": "Sample node for Node-RED",
  "node-red": {
    "nodes": {
      "sample": "sample.js"
    }
  },
  "keywords": ["node-red"],
  "author": "Your Name",
  "license": "Apache-2.0"
}
```

### 贡献节点注册

1. 发布到npm
2. 添加"node-red"关键字
3. 在package.json中定义节点入口
4. 提交到Node-RED流程库

---

## 最佳实践

### 性能优化

1. **避免阻塞操作**: 使用异步处理
2. **内存管理**: 及时清理大对象
3. **连接池**: 复用数据库连接
4. **批处理**: 合并多个操作

### 安全建议

1. **输入验证**: 验证所有外部输入
2. **权限最小化**: 只授予必要权限
3. **加密存储**: 敏感数据加密保存
4. **定期更新**: 保持Node-RED版本最新

### 调试技巧

1. **使用Debug节点**: 监控消息流
2. **设置断点**: 在Function节点中调试
3. **日志记录**: 记录关键操作
4. **性能监控**: 监控资源使用情况

---

*本文档基于Node-RED官方文档整理，版本信息以官方最新发布为准。* 