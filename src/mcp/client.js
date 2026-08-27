/**
 * 手写 MCP Client —— 零依赖，展示"宿主"如何连接 MCP 服务器
 * =====================================================
 *
 * 角色对应：
 *   MCP Host   = Claude Desktop / pi / 你的 simple_harness   ← 你在用的东西
 *   MCP Client = 宿主里的连接器（本文件）
 *   MCP Server = 提供工具的程序（server.js / filesystem 服务器等）
 *
 * 流程（和浏览器访问网站的三次握手类似）：
 *   1. spawn 服务器进程
 *   2. 发 initialize 请求 → 收到版本+能力 → 发 initialized 通知
 *   3. tools/list 拿到工具列表
 *   4. tools/call 执行工具
 *
 * 与 CLI 的本质区别：
 *   CLI    = 一次性执行：你启动进程 → 传参数 → 拿 stdout → 进程结束
 *   MCP    = 常驻进程 + 结构化协议：一次启动，多次"方法调用"，来回 JSON
 *            CLI 的输出是人读的文本，MCP 的响应是机器可解析的 JSON
 */

import { spawn } from 'node:child_process';
import * as readline from 'node:readline';

export class McpClient {
    constructor(serverConfig) {
        // serverConfig = { command: 'node', args: ['src/mcp/server.js'], name: '本地教学服务器' }
        this.serverConfig = serverConfig;
        this.pending = new Map();   // id → { resolve, reject } 挂起的请求
        this.nextId = 1;
        this.tools = [];            // 服务器声明的原始工具列表
    }

    /** 连接：spawn 进程 + 完成 initialize 握手 */
    async connect() {
        const { command, args = [] } = this.serverConfig;

        // 1. 启动服务器进程。stdio: ['pipe','pipe','inherit']
        //    - 0 我们写给它（它的 stdin ← 我们的请求）
        //    - 1 它写给我们（它的 stdout → 我们的响应）
        //    - 2 继承到终端（日志/报错不干扰协议）
        this.proc = spawn(command, args, { stdio: ['pipe', 'pipe', 'inherit'] });

        this.rl = readline.createInterface({ input: this.proc.stdout });
        this.rl.on('line', (line) => {
            let msg;
            try { msg = JSON.parse(line); } catch { return; }
            this.#onMessage(msg);
        });

        // 2. 握手：请求用我们支持的协议版本
        const res = await this.#request('initialize', {
            protocolVersion: '2025-06-18',
            capabilities: {}, // 客户端能力：我们只消费工具，不声明额外能力
            clientInfo: { name: 'simple-harness', version: '0.1.0' },
        });
        console.log(`[mcp] 已连接 ${this.serverConfig.name} (协议 ${res.protocolVersion})`);

        // 3. 通知服务器我们初始化完成（通知 = 无 id，不需要响应）
        this.#notify('notifications/initialized');

        // 4. 预取工具列表
        const listRes = await this.#request('tools/list', {});
        this.tools = listRes.tools;
    }

    /** 列出工具（原始 MCP 格式） */
    async listTools() {
        return this.tools;
    }

    /**
     * 调用工具，返回解析后的结果对象
     * MCP 结果统一包在 content[] 里，我们从 text 项提取
     */
    async callTool(name, args) {
        const res = await this.#request('tools/call', { name, arguments: args });
        const texts = res.content
            .filter((c) => c.type === 'text')
            .map((c) => c.text)
            .join('\n');
        // 尝试解析 JSON（很多工具返回 JSON 字符串），失败就原样返回
        try { return JSON.parse(texts); } catch { return texts; }
    }

    /** 关闭连接：杀掉服务器进程 */
    close() {
        this.proc?.kill();
        this.rl?.close();
    }

    // ============ 内部：JSON-RPC 收发 ============

    /** 发送请求并等待匹配 id 的响应 */
    #request(method, params) {
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
        });
    }

    /** 发送通知（不需要响应） */
    #notify(method, params = {}) {
        this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
    }

    /** 收到服务器消息：按 id 找到挂起的请求，settle 它 */
    #onMessage(msg) {
        if (msg.id === undefined) return; // 服务器主动推送（本示例不用）
        const pending = this.pending.get(msg.id);
        if (!pending) return;
        this.pending.delete(msg.id);

        if (msg.error) {
            pending.reject(new Error(`MCP 错误 [${msg.error.code}]: ${msg.error.message}`));
        } else {
            pending.resolve(msg.result);
        }
    }
}

/**
 * 把 MCP 工具转换成 harness 的工具格式
 * -----------------------------------------------------------
 * 关键洞察：两边的"工具"本质是同一个东西，只是字段名不同！
 *
 *   MCP 格式:                    harness 格式:
 *   {                            {
 *     name: 'calculator',          type: 'function',
 *     description: '...',          function: {
 *     inputSchema: {                 name: 'calculator',
 *       type: 'object',              description: '...',
 *       properties: {...}            parameters: { type:'object', properties:{...} }
 *       required: [...]            },
 *     }                            execute: fn   ← MCP 没有，由 client.callTool 充当
 *   }                            }
 *
 * 所以转换 = inputSchema → parameters + execute 指向 client.callTool
 */
export function toHarnessTools(mcpClient, mcpTools) {
    return mcpTools.map((tool) => ({
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description || '',
            parameters: tool.inputSchema, // 本身就是 JSON Schema，直接复用
        },
        // execute 收到参数后，转发给 MCP 服务器的 tools/call
        execute: (args) => mcpClient.callTool(tool.name, args),
    }));
}
