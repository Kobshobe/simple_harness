# AI Agent Harness 最小实现

一个不到 200 行的引擎核心，支持流式对话、工具调用、多轮代码修改。

## 1. 什么是 Harness Engine

Harness 的含义是"马具"——你把 LLM 套上马具，给它工具，它就能干活。

核心逻辑一句话：**一个循环，三个部件**。

```
用户输入 → [ LLM 思考 → 想调用工具 → 执行工具 → 返回结果 ] × N → 最终回复
```

和普通 ChatBot 的区别：ChatBot 一问一答就结束，Harness 会在一个 while 循环里反复"思考-行动"，直到 LLM 认为任务完成。

## 2. 整体架构

```
tui.js            ← readline REPL，唯一入口
  ↑ yield
agent.js          ← 核心循环 + 流合并 (Message 类)
  ↑ stream
ai.js             ← DeepSeek API 调用 (OpenAI SDK)
  ↑ tool calls
tools/
  write.js        ← 创建文件
  read.js         ← 读取文件
  edit.js         ← 精确编辑
  bash.js         ← 执行命令
```

## 3. 运行

```bash
npm install

npm run tui
```

## 4. MCP 支持 (学习用)

```bash
npm run tui-mcp     # 本地工具 + MCP 工具 一起进 REPL
npm run mcp-server  # 单独启动 MCP 服务器（供其他宿主连接）
```

### MCP 和 CLI 的区别

| | CLI | MCP |
|---|---|---|
| 生命周期 | 一次启动，跑完即退出 | 常驻进程，一次握手多次调用 |
| 通信 | 命令行参数 + stdout 文本 | stdin/stdout 上的 JSON-RPC 2.0 |
| 输出 | 给人读的文本 | 机器可解析的 JSON 结构 |
| 接口发现 | 靠文档/man | `tools/list` 动态自描述 |
| 典型用例 | 人敲命令 | AI 宿主动态挂载工具 |

### 协议本质

MCP = **在 stdin/stdout 上跑 JSON-RPC 2.0**，每行一条 JSON。

```
客户端                            服务器
  │─ initialize ──────────────→   │ 握手：协商协议版本、能力
  │←────── {协议版本,能力} ──────│
  │─ notifications/initialized →  │ 通知（无响应）
  │─ tools/list ──────────────→   │ 列出工具
  │←────── {tools:[...]} ────────│
  │─ tools/call ──────────────→   │ 执行工具
  │←── {content:[{type,text}]} ──│
```

### 代码位置

```
src/mcp/
  server.js   ← 手写 MCP 服务器（零依赖，教学用）：把 calculator/echo 包成 MCP 工具
  client.js   ← 手写 MCP 客户端（零依赖）：spawn 进程 + 握手 + list/call
src/tui-mcp.js ← harness 入口：本地工具 + MCP 工具合并喂给 agent 循环
```

关键洞察：**MCP 工具和 harness 工具是同一个东西**，只是字段名不同。
转换只需 `inputSchema → parameters`，`execute` 指向 `client.callTool`。

### 学习验证

```bash
# 纯协议层：手写 client ↔ 手写 server
node --input-type=module -e "
  import { McpClient } from './src/mcp/client.js';
  const c = new McpClient({ name: 't', command: 'node', args: ['src/mcp/server.js'] });
  await c.connect();
  console.log(await c.callTool('calculator', { expression: '2+2' }));
  c.close();"

# 完整链路：LLM 通过 agent 循环调用 MCP 工具
npm run tui-mcp
```

也支持连接第三方服务器（把 `tui-mcp.js` 里的 server 配置换成任意
MCP 服务器命令即可，代码不用改）。

## 5. 运行

```bash
npm run tui        # 纯本地工具
npm run tui-mcp    # 本地 + MCP 工具
```

```
> 在 .code 目录写一个 hello js 程序
我来创建一个 hello 程序...

> 用 calculator 算 12345 * 6789
我来调用 MCP 工具...
```
