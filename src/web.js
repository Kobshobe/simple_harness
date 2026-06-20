import express from 'express';
import { Agent } from './agent.js';
import { codingTools } from './tools/tools.js';
import { loadSkills } from './skill.js';

/**
 * 启动 Web 服务器 (http://localhost:3000)
 */
export async function startWebServer() {
    const app = express();
    app.use(express.json());
    app.use(express.static('public'));

    const skills = await loadSkills('./.agents/skills');

    const skillList = skills
        .map(s => `- **${s.name}**: ${s.description}`)
        .join('\n');

    const systemPrompt = `你是一个编程助手。

## 可用技能
${skillList}

要使用某个技能，用 read 工具读取 .agents/skills/<技能名>/SKILL.md 获取完整说明。`;

    const agent = new Agent({
        systemPrompt,
        tools: codingTools,
    });

    app.post('/chat', async (req, res) => {
        const { prompt } = req.body;

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        });

        try {
            for await (const ev of agent.run(prompt)) {
                if (ev) {
                    res.write(`data: ${JSON.stringify(ev)}\n\n`);
                }
            }
        } catch (err) {
            res.write(`data: ${JSON.stringify({ type: 'error', text: err.message })}\n\n`);
        }

        res.end();
    });

    app.listen(3000, () => {
        console.log('Web UI running at http://localhost:3000');
    });
}

// 直接运行此文件时启动 Web 服务器
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain) {
    await startWebServer();
}
