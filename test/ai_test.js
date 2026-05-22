import {complete, logMessages} from '../src/ai.js'

let result = await complete({
    messages: [{ role: 'user', content: 'hello' }],
    onEvent: logMessages,
})

console.log(result)