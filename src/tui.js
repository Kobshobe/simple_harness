import * as readline from 'node:readline';
import { Agent } from './agent.js';
import { codingTools } from './tools/tools.js';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
});

const agent = new Agent({
    systemPrompt: '你是一个编程助手。',
    tools: codingTools,
});

console.log('Simple Harness REPL — Ctrl+C 退出\n');
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
