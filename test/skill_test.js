import fs from 'fs';
import { loadSkills } from "../src/skill.js";
import { Agent } from "../src/agent.js";
import { codingTools } from "../src/tools/tools.js";

//删除 .code 目录下的所有文件
fs.rmSync('./.code', { recursive: true, force: true });

const skills = await loadSkills('./skills')

const skillList = skills
    .map(s => `- **${s.name}**: ${s.description}`)
    .join('\n');

const systemPrompt = `你是一个编程助手。

## 可用技能
${skillList}

要使用某个技能，用 read 工具读取 skills/<技能名>/SKILL.md 获取完整说明。`;

const agent = new Agent({systemPrompt, tools: codingTools})
for await (const ev of agent.run('用 js 在 .code 目录下写一个 hi 程序')) {
    if (ev?.text) process.stdout.write(ev.text);
}