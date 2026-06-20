import * as readline from 'node:readline';
import { Agent } from './agent.js';
import { codingTools } from './tools/tools.js';
import { loadSkills } from './skill.js';

/**
 * 启动交互式 REPL（Read-Eval-Print Loop）
 */
export async function startREPL() {
    // 尝试加载 skills，不存在也无妨
    let skills = [];
    try {
        skills = await loadSkills('./.agents/skills');
    } catch {}

    const skillList = skills
        .map(s => `- **${s.name}**: ${s.description}`)
        .join('\n');

    const skillSection = skills.length > 0
        ? `\n\n## 可用技能\n${skillList}\n\n要使用某个技能，用 read 工具读取 .agents/skills/<技能名>/SKILL.md 获取完整说明。`
        : '';

    const systemPrompt = `你是一个编程助手。${skillSection}`;

    const agent = new Agent({
        systemPrompt,
        tools: codingTools,
    });

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '> ',
    });

    console.log(`Simple Harness REPL — Ctrl+C 退出${skills.length > 0 ? ` (${skills.length} skills loaded)` : ''}\n`);
    rl.prompt();

    rl.on('line', async (line) => {
        const input = line.trim();
        if (!input) { rl.prompt(); return; }

        try {
            for await (const ev of agent.run(input)) {
                if (ev?.text) process.stdout.write(ev.text);
            }
        } catch (err) {
            console.error('❌', err.message);
        }

        rl.prompt();
    });
}

// 直接运行此文件时启动 REPL
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain) {
    await startREPL();
}
