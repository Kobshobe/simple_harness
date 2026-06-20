# simple-harness

轻量级 AI Agent harness，支持流式对话、工具调用、多轮代码修改。

核心逻辑一句话：**一个循环，三个部件**。

```
用户输入 → [ LLM 思考 → 想调用工具 → 执行工具 → 返回结果 ] × N → 最终回复
```

## 快速开始

```bash
# 安装依赖
npm install

# 启动交互式 REPL
npm run tui
# 或
node bin/cli.js
```

## CLI 命令

通过 `npm link` 或 `npm install -g` 安装后可直接使用：

```bash
# 全局安装
npm link

# 使用
shn                   # 启动交互式 REPL（默认）
shn tui               # 启动交互式 REPL
shn web               # 启动 Web 服务器 (http://localhost:3000)
shn run <p>           # 单次执行一段 prompt
shn --help            # 显示帮助
shn --version         # 显示版本号
```

或者不安装，直接用 npm run script：

```bash
npm run cli               # 启动 REPL
npm run cli -- web        # 启动 Web
npm run cli -- run "你好" # 单次执行
```

## 架构

```
bin/cli.js          ← CLI 入口 (shebang, 命令名: shn)
  │
  ├─ src/tui.js     ← REPL 交互模式
  ├─ src/web.js     ← Web 服务器 (SSE)
  └─ src/cli-run.js ← 一次性执行模式
         │
         ▼
src/agent.js        ← 核心循环 (Agent + Message)
    │
    ├─ src/ai.js    ← DeepSeek API 调用
    │
    └─ src/core/compaction/compaction.js  ← 上下文压缩
         │
src/tools/          ← 工具集
    ├─ read.js      ← 读取文件
    ├─ write.js     ← 创建文件
    ├─ edit.js      ← 精确编辑
    └─ bash.js      ← 执行命令

src/skill.js        ← Skill 加载 (扫描 SKILL.md)
skills/             ← Skill 目录
