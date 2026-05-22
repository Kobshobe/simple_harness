import fs from 'fs';
import { Agent } from '../src/agent.js';
import { codingTools } from '../src/tools/tools.js';

fs.rmSync('./.code', { recursive: true, force: true });

const agent = new Agent({ tools: codingTools });

const prompt = '用 js 在 .code 目录下写一个 hello 程序, 加上时间'
for await (const ev of agent.run(prompt)) {
    if (ev?.text) process.stdout.write(ev.text);
}