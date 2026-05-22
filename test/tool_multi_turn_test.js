import { Agent } from '../src/agent.js';
import { tools } from '../src/tools/tools.js';

const agent = new Agent({ tools });

for await (const ev of agent.run('计算 100 * 200, 结果再乘以 3, 分两次计算')) {
    if (ev?.text) process.stdout.write(ev.text);
}