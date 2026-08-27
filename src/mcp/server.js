/**
 * 手写 MCP Server —— 零依赖，展示 MCP 协议的本质
 * ===============================================
 *
 * MCP (Model Context Protocol) 本质就是：**在 stdin/stdout 上跑 JSON-RPC 2.0**
 *
 * 传输层：stdio 传输 = 每行一条 JSON 消息（换行符分隔），无 Content-Length 头
 *   客户端 → 服务端 : 通过服务端的 stdin
 *   服务端 → 客户端 : 通过服务端的 stdout
 *
 * 协议层：JSON-RPC 2.0
 *   请求  = { jsonrpc:"2.0", id: 1, method: "...", params: {...} }
 *   响应  = { jsonrpc:"2.0", id: 1, result: {...} }   ← id 必须和请求一致
 *   通知  = { jsonrpc:"2.0", method: "..." }           ← 没有 id，不需要响应
 *
 * 核心方法（学习版只实现 3 个）：
 *   initialize              → 握手，协商协议版本和能力
 *   notifications/initialized → 通知客户端已就绪（注意：这是通知，无响应）
 *   tools/list              → 列出所有工具（带 JSON Schema 参数定义）
 *   tools/call              → 调用某个工具
 *
 * 运行方式：node src/mcp/server.js  （被 MCP 客户端 spawn 出来，通过 stdio 通信）
 */

import { calculator } from '../tools/tools.js';

// ---- 工具注册表：一个工具 = 名字 + 描述 + 参数Schema + 实现 ----
// 注意：这正是你 harness 里 tools 定义去掉 execute 之后的样子！
const REGISTERED_TOOLS = [
    {
        name: 'calculator',
        description: '执行数学计算',
        inputSchema: {
            type: 'object',
            properties: {
                expression: { type: 'string', description: '数学表达式，例如 "2 + 3 * 4"' }
            },
            required: ['expression']
        },
        // 直接复用 harness 里已有的实现 —— 同一个函数，两种出场方式
        handler: (args) => calculator(args),
    },
    {
        name: 'echo',
        description: '原样返回你传入的文字，用于测试 MCP 通信',
        inputSchema: {
            type: 'object',
            properties: {
                text: { type: 'string', description: '要回显的文字' }
            },
            required: ['text']
        },
        handler: (args) => ({ text: args.text }),
    },
];

// ---- 工具执行：MCP 要求返回值包装成 content 数组 ----
function runTool(name, args) {
    const tool = REGISTERED_TOOLS.find((t) => t.name === name);
    if (!tool) {
        return {
            content: [{ type: 'text', text: `未知工具: ${name}` }],
            isError: true,
        };
    }
    try {
        const result = tool.handler(args ?? {});
        // 任何返回值都要转成字符串，包进 content[].text
        const text = typeof result === 'string' ? result : JSON.stringify(result);
        return { content: [{ type: 'text', text }], isError: false };
    } catch (err) {
        return { content: [{ type: 'text', text: err.message }], isError: true };
    }
}

// ---- 主循环：读一行 → 解析 JSON → 分发 → 回一行 ----
import * as readline from 'node:readline';

const rl = readline.createInterface({ input: process.stdin });

rl.on('line', (line) => {
    let msg;
    try {
        msg = JSON.parse(line);
    } catch {
        return; // 不是合法 JSON，忽略
    }

    const { id, method, params } = msg;
    let result;

    switch (method) {
        case 'initialize':
            // 握手：客户端发来它想用的协议版本和能力
            // 我们只做一件事——把客户端请求的版本原样回显（表示"我支持"）
            // SDK 客户端只接受固定几个版本号，回显保证互通
            result = {
                protocolVersion: params.protocolVersion,
                capabilities: { tools: { listChanged: false } }, // 声明我们支持 tools 能力
                serverInfo: { name: 'simple-harness-mcp-server', version: '0.1.0' },
            };
            break;

        case 'notifications/initialized':
            // 客户端通知我们它初始化完成 —— 通知没有 id，直接忽略即可
            return;

        case 'tools/list':
            // 列出工具：name/description/inputSchema
            result = {
                tools: REGISTERED_TOOLS.map(({ name, description, inputSchema }) => ({
                    name,
                    description,
                    inputSchema,
                })),
            };
            break;

        case 'tools/call':
            // 调用工具：name + arguments
            result = runTool(params.name, params.arguments);
            break;

        default:
            // 未知方法：回一个 JSON-RPC 错误
            const err = { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
            process.stdout.write(JSON.stringify(err) + '\n');
            return;
    }

    // 所有响应都是：id 回显 + result 包装
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
});

// 服务器启动时打印一行到 stderr（stderr 不会干扰 stdout 的协议通信）
console.error('[mcp-server] ready, listening on stdio');
