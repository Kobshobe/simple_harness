import { Agent } from './agent.js';
import { codingTools } from './tools/tools.js';
import { loadSkills } from './skill.js';

/**
 * 单次执行一段 prompt，输出结果后退出。
 * @param {string} prompt - 用户的 prompt
 */
export async function runOnce(prompt) {
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

    for await (const ev of agent.run(prompt)) {
        if (ev?.text) process.stdout.write(ev.text);
    }
    console.log();
}
