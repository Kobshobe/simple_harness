import { Agent } from '../src/agent.js';
import { codingTools } from '../src/tools/tools.js';

const agent = new Agent({ tools: codingTools });

let prompt = '用 js 在 .code 目录下写一个 hello 程序'
for await (const ev of agent.run(prompt)) {
    if (ev?.text) process.stdout.write(ev.text);
}

const agent2 = new Agent({ tools: codingTools });

prompt = '.code 目录下 hello 程序给加上打印时间'
for await (const ev of agent2.run(prompt)) {
    if (ev?.text) process.stdout.write(ev.text);
}
