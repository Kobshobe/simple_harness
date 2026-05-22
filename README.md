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

```
> 在 .code 目录写一个 hello js 程序
我来创建一个 hello 程序...

> 加上打印时间
让我先看看现有代码...
然后加上时间输出...
```
