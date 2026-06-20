#!/usr/bin/env node

/**
 * shn — AI Agent harness CLI
 *
 * Usage:
 *   shn                  启动 TUI REPL（默认）
 *   shn tui              启动 TUI REPL
 *   shn web              启动 Web 服务器 (http://localhost:3000)
 *   shn run <p>          单次执行一段 prompt 后退出
 *   shn --help           显示帮助
 *   shn --version        显示版本号
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf-8'));

const args = process.argv.slice(2);
const command = args[0];

// ── Help ───────────────────────────────────────────────────────────
if (command === '--help' || command === '-h') {
    console.log(`
  shn v${pkg.version}

  一个轻量级 AI Agent harness，支持流式对话、工具调用、多轮代码修改。

  用法:
    shn                  启动交互式 REPL（默认）
    shn tui              启动交互式 REPL
    shn web              启动 Web 服务器 (http://localhost:3000)
    shn run <p>          单次执行一段 prompt
    shn --help           显示此帮助
    shn --version        显示版本号

  示例:
    shn
    shn web
    shn run "用 js 写一个 hello world"
`);
    process.exit(0);
}

// ── Version ─────────────────────────────────────────────────────────
if (command === '--version' || command === '-v') {
    console.log(pkg.version);
    process.exit(0);
}

// ── Web ─────────────────────────────────────────────────────────────
if (command === 'web') {
    const { startWebServer } = await import('../src/web.js');
    await startWebServer();
    process.exit(0);
}

// ── Run (one-shot) ─────────────────────────────────────────────────
if (command === 'run') {
    const prompt = args.slice(1).join(' ');
    if (!prompt) {
        console.error('❌ 请提供 prompt，例如: simple-harness run "用 js 写 hello world"');
        process.exit(1);
    }
    const { runOnce } = await import('../src/cli-run.js');
    await runOnce(prompt);
    process.exit(0);
}

// ── TUI REPL (default) ─────────────────────────────────────────────
const { startREPL } = await import('../src/tui.js');
await startREPL();
