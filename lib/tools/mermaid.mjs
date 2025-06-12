/**
 * MCP tools for generating Mermaid diagrams from Node-RED flows
 * 精简版：只保留4种核心可视化模式
 */

import { z } from 'zod';
import { callNodeRed } from '../utils.mjs';

/**
 * Node-RED到Mermaid转换器类
 * 支持4种核心可视化模式
 */
class NodeRedMermaidConverter {
    constructor(config) {
        this.config = config;
    }

    /**
     * 过滤指定标签的流程
     */
    filterFlowsByLabel(flows, label) {
        const targetFlow = flows.find(f => f.type === 'tab' && f.label === label);
        if (!targetFlow) {
            throw new Error(`未找到标签为 "${label}" 的流程`);
        }

        const nodes = flows.filter(f => f.z === targetFlow.id);
        return {
            flow: targetFlow,
            nodes: nodes
        };
    }

    /**
     * 生成基础mermaid图表
     */
    generateMermaid(flows, mode = 'flow', flowLabel = null) {
        let targetNodes;
        let flowInfo = null;

        if (flowLabel) {
            flowInfo = this.filterFlowsByLabel(flows, flowLabel);
            targetNodes = flowInfo.nodes;
        } else {
            targetNodes = flows.filter(f => f.type && f.type !== 'tab');
        }

        switch (mode) {
            case 'flow':
                return this.generateFlowChart(flows, flowInfo);
            case 'communication':
                return this.generateSequenceDiagram(flows, flowInfo);
            case 'dataflow':
                return this.generateDataFlowDiagram(flows, flowInfo);
            case 'state':
                return this.generateStateDiagram(flows, flowInfo);
            default:
                throw new Error(`不支持的模式: ${mode}`);
        }
    }

    /**
     * 模式1: 流程架构图
     */
    generateFlowChart(flows, flowInfo) {
        const flowLines = ['flowchart TD'];
        
        let targetNodes;
        if (flowInfo) {
            targetNodes = flowInfo.nodes;
        } else {
            targetNodes = flows.filter(f => f.type && f.type !== 'tab');
        }

        // 生成节点定义
        targetNodes.forEach(node => {
            const label = this.escapeLabel(node.name || node.type);
            const shape = this.getNodeShape(node.type);
            flowLines.push(`    ${node.id}${shape.start}"${label}"${shape.end}`);
        });

        // 生成连接
        targetNodes.forEach(node => {
            if (node.wires && Array.isArray(node.wires)) {
                node.wires.forEach((outputWires, outputIndex) => {
                    if (Array.isArray(outputWires)) {
                        outputWires.forEach(targetId => {
                            flowLines.push(`    ${node.id} --> ${targetId}`);
                        });
                    }
                });
            }
        });

        return flowLines.join('\n');
    }

    /**
     * 模式2: 通信序列图
     */
    generateSequenceDiagram(flows, flowInfo) {
        const seqLines = ['sequenceDiagram'];
        
        let targetNodes;
        if (flowInfo) {
            targetNodes = flowInfo.nodes;
        } else {
            targetNodes = flows.filter(f => f.type && f.type !== 'tab');
        }

        // 分析参与者
        const participants = new Set();
        targetNodes.forEach(node => {
            if (this.isSignificantNode(node.type)) {
                participants.add(node.id);
            }
        });

        // 添加参与者定义
        Array.from(participants).slice(0, 8).forEach(nodeId => {
            const node = targetNodes.find(n => n.id === nodeId);
            const name = this.escapeLabel(node.name || node.type);
            seqLines.push(`    participant ${nodeId} as ${name}`);
        });

        // 生成消息序列
        targetNodes.forEach(node => {
            if (node.wires && Array.isArray(node.wires) && participants.has(node.id)) {
                node.wires.forEach(outputWires => {
                    if (Array.isArray(outputWires)) {
                        outputWires.forEach(targetId => {
                            if (participants.has(targetId)) {
                                const msgType = this.inferMessageType(node, targetId, targetNodes);
                                seqLines.push(`    ${node.id}->>+${targetId}: ${msgType}`);
                            }
                        });
                    }
                });
            }
        });

        return seqLines.join('\n');
    }

    /**
     * 模式3: 数据流图
     */
    generateDataFlowDiagram(flows, flowInfo) {
        const dataflowLines = ['flowchart TD'];
        
        let targetNodes;
        if (flowInfo) {
            targetNodes = flowInfo.nodes;
        } else {
            targetNodes = flows.filter(f => f.type && f.type !== 'tab');
        }

        // 找到起始节点
        const startNodes = this.findStartNodes(targetNodes);
        const dataFlows = [];

        // 追踪每个数据流路径
        startNodes.forEach((startNode, index) => {
            const flowPath = this.traceDataFlow(startNode, targetNodes, [], new Set());
            if (flowPath.length > 1) {
                dataFlows.push({
                    id: index + 1,
                    path: flowPath,
                    dataType: this.inferDataType(startNode)
                });
            }
        });

        // 按数据流分组生成子图
        dataFlows.forEach((flow, index) => {
            dataflowLines.push(`    subgraph DF${flow.id}["数据流 ${flow.id}: ${flow.dataType}"]`);
            
            // 生成该数据流中的节点
            flow.path.forEach(node => {
                const label = this.escapeLabel(node.name || node.type);
                const shape = this.getNodeShape(node.type);
                dataflowLines.push(`        ${node.id}${shape.start}"${label}"${shape.end}`);
            });

            // 生成该数据流中的连接，添加数据类型标注
            for (let i = 0; i < flow.path.length - 1; i++) {
                const current = flow.path[i];
                const next = flow.path[i + 1];
                const dataType = this.inferDataType(current);
                dataflowLines.push(`        ${current.id} -->|"${dataType}"| ${next.id}`);
            }
            
            dataflowLines.push('    end');
        });

        return dataflowLines.join('\n');
    }

    /**
     * 模式4: 状态变化图
     */
    generateStateDiagram(flows, flowInfo) {
        const stateLines = ['stateDiagram-v2'];
        
        let targetNodes;
        if (flowInfo) {
            targetNodes = flowInfo.nodes;
        } else {
            targetNodes = flows.filter(f => f.type && f.type !== 'tab');
        }

        // 识别状态节点
        const stateNodes = targetNodes.filter(node => 
            this.isStateNode(node.type) || 
            (node.name && this.hasStateKeywords(node.name))
        );

        // 识别触发节点
        const triggerNodes = targetNodes.filter(node => 
            this.isTriggerNode(node.type)
        );

        if (stateNodes.length === 0) {
            // 如果没有明确的状态节点，基于节点类型推断状态
            return this.generateInferredStateDiagram(targetNodes);
        }

        // 定义状态
        const states = new Map();
        stateNodes.forEach(node => {
            const stateName = this.getStateName(node);
            states.set(node.id, stateName);
            stateLines.push(`    state "${stateName}" as ${node.id}`);
        });

        // 添加触发器状态
        triggerNodes.forEach(node => {
            if (!states.has(node.id)) {
                const triggerName = this.getTriggerName(node);
                states.set(node.id, triggerName);
                stateLines.push(`    state "${triggerName}" as ${node.id}`);
            }
        });

        // 生成状态转换
        targetNodes.forEach(node => {
            if (node.wires && Array.isArray(node.wires) && states.has(node.id)) {
                node.wires.forEach(outputWires => {
                    if (Array.isArray(outputWires)) {
                        outputWires.forEach(targetId => {
                            if (states.has(targetId)) {
                                const condition = this.inferStateCondition(node, targetId, targetNodes);
                                stateLines.push(`    ${node.id} --> ${targetId} : ${condition}`);
                            }
                        });
                    }
                });
            }
        });

        return stateLines.join('\n');
    }

    // 辅助方法
    generateInferredStateDiagram(targetNodes) {
        const stateLines = ['stateDiagram-v2'];
        
        // 基于节点功能推断系统状态
        const systemStates = {
            idle: '空闲状态',
            processing: '处理中',
            waiting: '等待输入',
            error: '错误状态',
            complete: '完成状态'
        };

        // 添加状态定义
        Object.entries(systemStates).forEach(([key, label]) => {
            stateLines.push(`    state "${label}" as ${key}`);
        });

        // 添加基础状态转换
        stateLines.push('    [*] --> idle');
        stateLines.push('    idle --> waiting : 触发输入');
        stateLines.push('    waiting --> processing : 开始处理');
        stateLines.push('    processing --> complete : 处理成功');
        stateLines.push('    processing --> error : 处理失败');
        stateLines.push('    complete --> idle : 重置');
        stateLines.push('    error --> idle : 重试');

        return stateLines.join('\n');
    }

    // 工具方法
    escapeLabel(label) {
        return label.replace(/"/g, '\\"').replace(/\n/g, ' ');
    }

    getNodeShape(nodeType) {
        const shapes = {
            'inject': { start: '[', end: ']' },
            'debug': { start: '((', end: '))' },
            'function': { start: '{', end: '}' },
            'http in': { start: '>', end: ']' },
            'http response': { start: '[', end: '<' },
            'switch': { start: '{', end: '}' },
            'change': { start: '(', end: ')' },
            'template': { start: '[/', end: '/]' },
            'mqtt in': { start: '>', end: ']' },
            'mqtt out': { start: '[', end: '<' }
        };
        return shapes[nodeType] || { start: '[', end: ']' };
    }

    isSignificantNode(nodeType) {
        const significantTypes = [
            'inject', 'http in', 'mqtt in', 'function', 
            'switch', 'change', 'template', 'debug', 
            'http response', 'mqtt out'
        ];
        return significantTypes.includes(nodeType);
    }

    inferMessageType(sourceNode, targetId, allNodes) {
        const targetNode = allNodes.find(n => n.id === targetId);
        if (!targetNode) return '数据';
        
        const msgTypes = {
            'http in': 'HTTP请求',
            'mqtt in': 'MQTT消息',
            'inject': '注入数据',
            'function': '处理结果',
            'switch': '路由数据',
            'change': '修改数据',
            'template': '格式化数据',
            'debug': '调试输出',
            'http response': 'HTTP响应',
            'mqtt out': 'MQTT发布'
        };
        
        return msgTypes[sourceNode.type] || '数据传输';
    }

    findStartNodes(nodes) {
        return nodes.filter(node => {
            const hasNoInputs = !nodes.some(otherNode => 
                otherNode.wires && 
                otherNode.wires.some(wireArray => 
                    Array.isArray(wireArray) && wireArray.includes(node.id)
                )
            );
            return hasNoInputs && ['inject', 'http in', 'mqtt in'].includes(node.type);
        });
    }

    traceDataFlow(currentNode, allNodes, path, visited) {
        if (visited.has(currentNode.id) || path.length > 10) {
            return path;
        }

        visited.add(currentNode.id);
        path.push(currentNode);

        if (currentNode.wires && Array.isArray(currentNode.wires)) {
            for (const outputWires of currentNode.wires) {
                if (Array.isArray(outputWires) && outputWires.length > 0) {
                    const nextNodeId = outputWires[0];
                    const nextNode = allNodes.find(n => n.id === nextNodeId);
                    if (nextNode) {
                        return this.traceDataFlow(nextNode, allNodes, path, visited);
                    }
                }
            }
        }

        return path;
    }

    inferDataType(node) {
        const dataTypes = {
            'http in': 'HTTP数据',
            'mqtt in': 'MQTT消息',
            'inject': '测试数据',
            'function': '处理数据',
            'file': '文件数据',
            'csv': 'CSV数据',
            'json': 'JSON数据'
        };
        return dataTypes[node.type] || '通用数据';
    }

    isStateNode(nodeType) {
        const stateTypes = ['switch', 'function', 'delay', 'trigger'];
        return stateTypes.includes(nodeType);
    }

    hasStateKeywords(name) {
        const keywords = ['状态', '模式', '阶段', 'state', 'mode', 'phase', '开始', '结束', '等待'];
        return keywords.some(keyword => name.toLowerCase().includes(keyword.toLowerCase()));
    }

    isTriggerNode(nodeType) {
        const triggerTypes = ['inject', 'http in', 'mqtt in', 'file in'];
        return triggerTypes.includes(nodeType);
    }

    getStateName(node) {
        if (node.name) {
            return this.escapeLabel(node.name);
        }
        
        const stateNames = {
            'switch': '判断状态',
            'function': '处理状态', 
            'delay': '延迟状态',
            'trigger': '触发状态'
        };
        
        return stateNames[node.type] || node.type;
    }

    getTriggerName(node) {
        if (node.name) {
            return this.escapeLabel(node.name);
        }
        
        const triggerNames = {
            'inject': '手动触发',
            'http in': 'HTTP触发',
            'mqtt in': 'MQTT触发',
            'file in': '文件触发'
        };
        
        return triggerNames[node.type] || '外部触发';
    }

    inferStateCondition(sourceNode, targetId, allNodes) {
        const targetNode = allNodes.find(n => n.id === targetId);
        if (!targetNode) return '条件';
        
        const conditions = {
            'switch': '满足条件',
            'function': '处理完成',
            'delay': '延迟结束',
            'trigger': '触发事件'
        };
        
        return conditions[sourceNode.type] || '状态转换';
    }
}

/**
 * 注册Mermaid工具到MCP服务器
 */
export default function registerMermaidTools(server, config) {
    const converter = new NodeRedMermaidConverter(config);

    // 生成流程架构图
    server.tool(
        'generate-flow-chart',
        {
            flowLabel: z.string().optional().describe('指定流程标签，留空则分析所有流程'),
        },
        async ({ flowLabel }) => {
            try {
                const flows = await callNodeRed('get', '/flows', null, config);
                const mermaidCode = converter.generateMermaid(flows, 'flow', flowLabel);
                
                return {
                    content: [{
                        type: 'text',
                        text: `# 流程架构图${flowLabel ? ` - ${flowLabel}` : ''}\n\n\`\`\`mermaid\n${mermaidCode}\n\`\`\``
                    }]
                };
            } catch (error) {
                return {
                    content: [{ type: 'text', text: `错误: ${error.message}` }]
                };
            }
        }
    );

    // 生成通信序列图
    server.tool(
        'generate-sequence-diagram',
        {
            flowLabel: z.string().optional().describe('指定流程标签，留空则分析所有流程'),
        },
        async ({ flowLabel }) => {
            try {
                const flows = await callNodeRed('get', '/flows', null, config);
                const mermaidCode = converter.generateMermaid(flows, 'communication', flowLabel);
                
                return {
                    content: [{
                        type: 'text',
                        text: `# 通信序列图${flowLabel ? ` - ${flowLabel}` : ''}\n\n\`\`\`mermaid\n${mermaidCode}\n\`\`\``
                    }]
                };
            } catch (error) {
                return {
                    content: [{ type: 'text', text: `错误: ${error.message}` }]
                };
            }
        }
    );

    // 生成数据流图
    server.tool(
        'generate-dataflow-diagram',
        {
            flowLabel: z.string().optional().describe('指定流程标签，留空则分析所有流程'),
        },
        async ({ flowLabel }) => {
            try {
                const flows = await callNodeRed('get', '/flows', null, config);
                const mermaidCode = converter.generateMermaid(flows, 'dataflow', flowLabel);
                
                return {
                    content: [{
                        type: 'text',
                        text: `# 数据流图${flowLabel ? ` - ${flowLabel}` : ''}\n\n\`\`\`mermaid\n${mermaidCode}\n\`\`\``
                    }]
                };
            } catch (error) {
                return {
                    content: [{ type: 'text', text: `错误: ${error.message}` }]
                };
            }
        }
    );

    // 生成状态变化图
    server.tool(
        'generate-state-diagram',
        {
            flowLabel: z.string().optional().describe('指定流程标签，留空则分析所有流程'),
        },
        async ({ flowLabel }) => {
            try {
                const flows = await callNodeRed('get', '/flows', null, config);
                const mermaidCode = converter.generateMermaid(flows, 'state', flowLabel);
                
                return {
                    content: [{
                        type: 'text',
                        text: `# 状态变化图${flowLabel ? ` - ${flowLabel}` : ''}\n\n\`\`\`mermaid\n${mermaidCode}\n\`\`\``
                    }]
                };
            } catch (error) {
                return {
                    content: [{ type: 'text', text: `错误: ${error.message}` }]
                };
            }
        }
    );
} 