import { Agent } from '../src/agent.js';
import { codingTools } from '../src/tools/tools.js';

const agent = new Agent({ tools: codingTools });

let prompt = '用 js 在 .code 目录下写一个 hello_world 程序'
for await (const ev of agent.run(prompt)) {
    if (ev?.text) process.stdout.write(ev.text);
}

prompt = 'hello_world 加上打印时间'
for await (const ev of agent.run(prompt)) {
    if (ev?.text) process.stdout.write(ev.text);
}
