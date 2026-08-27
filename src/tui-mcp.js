/**
 * MCP 版 harness 入口 —— 本地工具 + 远程(MCP)工具 一起给 LLM 用
 * ==========================================================
 *
 * 运行：npm run tui-mcp
 *
 * 这里展示的是 MCP 最有价值的一个场景：
 * 你的 harness 不需要把工具写死在代码里，而是通过 MCP 协议
 * 动态连接任何"工具服务器"，拿到的工具直接喂给 agent 循环。
 *
 * 换个服务器配置（比如连接 Claude 官方 filesystem 服务器），
 * 下面所有代码一行都不用改 —— 这就是 MCP 标准化的意义。
 */

import * as path from 'node:path';
import * as readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { Agent } from './agent.js';
import { codingTools } from './tools/tools.js';
import { McpClient, toHarnessTools } from './mcp/client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- 1. 连接 MCP 服务器（这里连我们自己手写的教学服务器）----
const mcpClient = new McpClient({
    name: '教学服务器 (src/mcp/server.js)',
    command: 'node',
    args: [path.join(__dirname, 'mcp', 'server.js')],
});
await mcpClient.connect();

const mcpTools = await mcpClient.listTools();
console.log(`[mcp] 发现 ${mcpTools.length} 个工具: ${mcpTools.map((t) => t.name).join(', ')}`);

// ---- 2. 把 MCP 工具转成 harness 格式，和本地工具合并 ----
const allTools = [
    ...codingTools,                          // 本地工具：writeFile / bash / read / edit
    ...toHarnessTools(mcpClient, mcpTools),  // MCP 工具：calculator / echo
];

const agent = new Agent({
    systemPrompt: '你是一个编程助手。你可以使用本地文件工具，也可以使用 MCP 服务器提供的计算工具。',
    tools: allTools,
});

// ---- 3. 进入 REPL ----
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' });
console.log('\nSimple Harness + MCP REPL — Ctrl+C 退出\n');
rl.prompt();

rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }

    try {
        for await (const ev of agent.run(input)) {
            if (ev?.text) process.stdout.write(ev.text);
            if (ev?.type === 'tool_call') console.log(`\n  🔧 调用工具: ${ev.name}(${JSON.stringify(ev.arguments)})`);
        }
    } catch (err) {
        console.error('❌', err.message);
    }
    rl.prompt();
});

rl.on('close', () => {
    mcpClient.close(); // 退出时关掉 MCP 服务器进程
    process.exit(0);
});
