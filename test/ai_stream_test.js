import {completeStream} from '../src/ai.js'
import {Message} from '../src/agent.js'
import {tools} from '../src/tools/tools.js'


let result = await completeStream({
    messages: [{ role: 'user', content: 'hello' }],
})

let message = new Message()
for await (const chunk of result) {
    message.feed(chunk)
}

console.log('role:', message.role, '\n')
console.log('reasoning_content:', message.reasoning_content, '\n')
console.log('content:', message.content, '\n')
console.log('tool_calls:', message.tool_calls, '\n')


result = await completeStream({
    messages: [{ role: 'user', content: '计算 2 * 3' }],
    tools,
})

message = new Message()
for await (const chunk of result) {
    message.feed(chunk)
}

console.log('role:', message.role, '\n')
console.log('reasoning_content:', message.reasoning_content, '\n')
console.log('content:', message.content, '\n')
console.log('tool_calls:', message.tool_calls, '\n')