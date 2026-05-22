import express from 'express';
import { Agent } from './agent.js';
import { codingTools } from './tools/tools.js';
import { loadSkills } from './skill.js';


const app = express();
app.use(express.json());
app.use(express.static('public'));

const skills = await loadSkills('./skills')

const skillList = skills
    .map(s => `- **${s.name}**: ${s.description}`)
    .join('\n');

const systemPrompt = `你是一个编程助手。
    
    ## 可用技能
    ${skillList}
    
    要使用某个技能，用 read 工具读取 skills/<技能名>/SKILL.md 获取完整说明。`;

// ② 每个请求 new 一个 Agent，避免消息串
const agent = new Agent({
    systemPrompt: systemPrompt,
    tools: codingTools,
});

app.post('/chat', async (req, res) => {
    const { prompt } = req.body;

    // 设置 SSE headers（三个缺一不可）
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });

    // 消费 async generator，推 SSE
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