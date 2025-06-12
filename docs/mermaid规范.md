# Mermaid 图表语法完整规范

## 1. 简介

Mermaid.js 是一个基于 JavaScript 的开源库，允许用户使用简单的文本语法创建各种类型的图表和流程图。它支持多种图表类型，包括流程图、序列图、甘特图、类图等。

### 核心特性
- 使用 Markdown 风格的文本语法
- 支持多种图表类型
- 可集成到 GitHub、GitLab、文档系统等
- 支持主题和自定义样式
- 输出 SVG、PNG 等格式

## 2. 基本语法结构

所有 Mermaid 图表都以图表类型声明开始，后跟图表内容的定义。

### 基本格式：
```
图表类型声明
图表内容定义
```

### 配置选项：
```
%%{init: { 
  "theme": "default", 
  "themeVariables": { 
    "primaryColor": "#ffdead" 
  } 
}}%%
```

## 3. 流程图 (Flowchart)

### 基本语法
```
flowchart TD    %% TD = 从上到下; LR = 从左到右; TB = 从上到下
```

### 方向选项
- `TD` 或 `TB` - 从上到下
- `LR` - 从左到右
- `RL` - 从右到左
- `BT` - 从下到上

### 节点形状
```
A[矩形]
B(圆角矩形)
C((圆形))
D{菱形}
E>不对称形状]
F[[子程序]]
G[(圆柱形)]
H{{六边形}}
I[/平行四边形/]
J[\平行四边形\]
K[/梯形\]
L[\梯形/]
M(((双圆)))
```

### 连接线类型
```
A --> B     %% 实线箭头
A --- B     %% 实线
A -.-> B    %% 虚线箭头
A -.- B     %% 虚线
A ==> B     %% 粗线箭头
A === B     %% 粗线
```

### 带标签的连接
```
A -->|标签| B
A -- 标签 --> B
```

### 子图
```
subgraph 子图名称
    A --> B
    B --> C
end
```

### 样式和类
```
classDef className fill:#f9f,stroke:#333,stroke-width:4px
class nodeId className

%% 内联样式
A:::className
```

## 4. 序列图 (Sequence Diagram)

### 基本语法
```
sequenceDiagram
    participant A as 用户
    participant B as 服务器
    A->>B: 请求
    B-->>A: 响应
```

### 参与者声明
```
participant A
participant B as 别名
actor C as 角色
```

### 消息类型
```
A->>B: 同步消息
A-->>B: 异步消息
A->B: 实线箭头
A-->B: 虚线箭头
A-xB: 交叉结束
A--xB: 虚线交叉结束
```

### 激活和停用
```
A->>+B: 激活B
B-->>-A: 停用B
```

### 注释
```
Note left of A: 左侧注释
Note right of A: 右侧注释
Note over A,B: 跨越注释
```

### 循环和条件
```
loop 循环条件
    A->>B: 消息
end

alt 条件1
    A->>B: 分支1
else 条件2
    A->>C: 分支2
end

opt 可选条件
    A->>B: 可选消息
end
```

## 5. 甘特图 (Gantt Chart)

### 基本语法
```
gantt
    title 项目时间表
    dateFormat YYYY-MM-DD
    
    section 阶段1
        任务A :a1, 2024-01-01, 30d
        任务B :after a1, 20d
        
    section 阶段2
        任务C :2024-02-01, 12d
        任务D :24d
```

### 任务状态
```
任务名称 :done, a1, 2024-01-01, 30d
任务名称 :active, a2, 2024-02-01, 20d
任务名称 :crit, a3, 2024-03-01, 15d
```

## 6. 类图 (Class Diagram)

### 基本语法
```
classDiagram
    class Animal {
        +String name
        +int age
        +makeSound()
    }
    
    class Dog {
        +String breed
        +bark()
    }
    
    Animal <|-- Dog : 继承
```

### 关系类型
```
A <|-- B : 继承
A *-- B : 组合
A o-- B : 聚合
A --> B : 关联
A -- B : 链接
A ..> B : 依赖
A ..|> B : 实现
A <--> B : 双向关联
```

### 成员可见性
```
+public
-private
#protected
~package
```

## 7. 状态图 (State Diagram)

### 基本语法
```
stateDiagram-v2
    [*] --> 空闲
    空闲 --> 运行 : 开始
    运行 --> 暂停 : 暂停
    暂停 --> 运行 : 继续
    运行 --> [*] : 结束
```

### 复合状态
```
stateDiagram-v2
    state 复合状态 {
        [*] --> 子状态1
        子状态1 --> 子状态2
        子状态2 --> [*]
    }
```

## 8. 实体关系图 (ER Diagram)

### 基本语法
```
erDiagram
    CUSTOMER ||--o{ ORDER : 下单
    ORDER ||--|{ LINE_ITEM : 包含
    CUSTOMER {
        string name
        string address
        string phone
    }
    ORDER {
        int order_id
        date order_date
        float total
    }
```

### 关系符号
```
||--||  一对一
||--o{  一对多（可选）
||--|{  一对多（必须）
}o--o{  多对多（可选）
}|--|{  多对多（必须）
```

## 9. 用户旅程图 (User Journey)

### 基本语法
```
journey
    title 用户注册流程
    section 访问
        访问首页 : 5: 访客
        查看注册页 : 3: 访客
    section 注册
        填写表单 : 2: 用户
        验证邮箱 : 5: 用户
```

## 10. 饼图 (Pie Chart)

### 基本语法
```
pie title 浏览器使用率
    "Chrome" : 60
    "Firefox" : 25
    "Safari" : 10
    "Edge" : 5
```

## 11. Git 图 (Git Graph)

### 基本语法
```
gitGraph
    commit
    branch develop
    commit
    checkout main
    merge develop
    commit
```

## 12. 象限图 (Quadrant Chart)

### 基本语法
```
quadrantChart
    title 重要性-紧急性矩阵
    x-axis 低紧急度 --> 高紧急度
    y-axis 低重要性 --> 高重要性
    quadrant-1 重要且紧急
    quadrant-2 重要不紧急
    quadrant-3 不重要但紧急
    quadrant-4 不重要不紧急
```

## 13. 时间线图 (Timeline)

### 基本语法
```
timeline
    title 公司发展历程
    section 2020
        创立公司 : 注册成立
                  : 招聘首批员工
    section 2021
        产品发布 : 发布1.0版本
                  : 获得投资
```

## 14. 思维导图 (Mindmap)

### 基本语法
```
mindmap
  root((思维导图))
    分支1
      子分支1
      子分支2
    分支2
      子分支3
        细分支1
        细分支2
```

## 15. 高级特性

### 点击事件
```
flowchart LR
    A[Google] --> B[点击我]
    click A "https://google.com" "访问Google"
    click B callback "提示信息"
```

### 样式定义
```
flowchart LR
    A --> B
    style A fill:#f9f,stroke:#333,stroke-width:4px
    style B fill:#bbf,stroke:#f66,stroke-width:2px,color:#fff
```

### 链接样式
```
flowchart LR
    A --> B --> C
    linkStyle 0 stroke:#ff3,stroke-width:4px
    linkStyle 1 stroke:#33f,stroke-width:2px
```

### Markdown 支持
```
flowchart LR
    A["**粗体文本**<br/>*斜体文本*"]
```

## 16. 配置选项

### 主题配置
```javascript
mermaid.initialize({
    theme: 'default', // 可选: default, forest, dark, neutral
    themeVariables: {
        primaryColor: '#ff0000',
        primaryTextColor: '#fff'
    }
});
```

### 流程图配置
```javascript
mermaid.initialize({
    flowchart: {
        htmlLabels: false,
        curve: 'linear'
    }
});
```

## 17. 注意事项

### 保留字避免
- 避免使用 `end` 作为节点名（使用引号包围）
- 避免在注释中使用 `%%{` 和 `}%%`

### 特殊字符转义
```
A["包含特殊字符的文本: #quot;引号#quot;"]
```

### HTML 实体编码
```
A["#35;号码标签#35;"]  %% # 的编码
```

## 18. 最佳实践

1. **命名规范**：使用有意义的节点ID和标签
2. **结构清晰**：合理使用子图和分组
3. **样式一致**：统一使用样式类而非内联样式
4. **注释充分**：在复杂图表中添加必要注释
5. **测试验证**：使用 Mermaid Live Editor 进行测试

## 19. 常用工具

- [Mermaid Live Editor](https://mermaid.live/) - 在线编辑器
- VS Code Mermaid 插件 - 代码编辑器支持
- GitHub/GitLab - 原生支持 Mermaid 渲染

## 20. 示例模板

### 简单流程图模板
```
flowchart TD
    开始([开始]) --> 输入[输入数据]
    输入 --> 处理{数据处理}
    处理 -->|成功| 输出[输出结果]
    处理 -->|失败| 错误[错误处理]
    输出 --> 结束([结束])
    错误 --> 结束
```

### 系统架构图模板
```
flowchart TD
    用户[用户] --> 前端[前端应用]
    前端 --> API[API网关]
    API --> 服务1[用户服务]
    API --> 服务2[订单服务]
    服务1 --> DB1[(用户数据库)]
    服务2 --> DB2[(订单数据库)]
```

这个规范文档涵盖了 Mermaid.js 的主要功能和语法，可以作为开发 Node-RED 到 Mermaid 转换工具的参考。 