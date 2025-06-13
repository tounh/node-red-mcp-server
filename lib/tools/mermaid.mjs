/**
 * MCP tools for generating Mermaid diagrams from Node-RED flows
 * 极简版：只保留基础流程图生成
 */

import { z } from 'zod';
import { callNodeRed } from '../utils.mjs';

/**
 * 简化的Node-RED到Mermaid转换器
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
     * 生成基础流程图
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
                node.wires.forEach((outputWires) => {
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
     * 转义Mermaid标签中的特殊字符
     */
    escapeLabel(str) {
        if (!str) return 'Unknown';
        return str.replace(/["\[\]{}]/g, '').trim().substring(0, 50);
    }

    /**
     * 根据节点类型获取对应的Mermaid形状
     */
    getNodeShape(nodeType) {
        const shapes = {
            'http in': { start: '>', end: ']' },
            'http out': { start: '>', end: ']' },
            'http response': { start: '[', end: '<' },
            'inject': { start: '[', end: ']' },
            'debug': { start: '((', end: '))' },
            'function': { start: '{', end: '}' },
            'switch': { start: '{', end: '}' },
            'template': { start: '[/', end: '/]' },
            'change': { start: '[', end: ']' },
            'join': { start: '[', end: ']' },
            'split': { start: '[', end: ']' }
        };

        return shapes[nodeType] || { start: '[', end: ']' };
    }
}

/**
 * 注册Mermaid工具到MCP服务器
 * @param {Object} server - MCP服务器实例
 * @param {Object} config - 服务器配置
 */
export default function registerMermaidTools(server, config) {
    // ✅ 简化版：基础流程图生成
    server.tool(
        'generate-flow-chart',
        {
            flowLabel: z.string().optional().describe('指定流程标签，留空则分析所有流程 (推荐指定以减少内存消耗)')
        },
        async ({ flowLabel }) => {
            try {
                const flows = await callNodeRed('get', '/flows', null, config);
                const converter = new NodeRedMermaidConverter(config);
                
                let flowInfo = null;
                if (flowLabel) {
                    flowInfo = converter.filterFlowsByLabel(flows, flowLabel);
                }

                const mermaidDiagram = converter.generateFlowChart(flows, flowInfo);
                
                const output = [
                    `# 流程架构图${flowLabel ? ` - ${flowLabel}` : ''}`,
                    '',
                    '```mermaid',
                    mermaidDiagram,
                    '```'
                ];

                return {
                    content: [{ type: 'text', text: output.join('\n') }]
                };
            } catch (error) {
                return {
                    content: [{ type: 'text', text: `生成流程图失败: ${error.message}` }]
                };
            }
        }
    );
} 