import { completeStream } from './ai.js';

const MAX_TURNS = 50;

export class Agent {
    messages = [];
    tools = [];
    onEvent = null;

    constructor(config) {
        this.systemPrompt = config.systemPrompt || '';
        this.tools = config.tools || [];
        this.onEvent = config.onEvent || null;
    }

    async *run(prompt) {
        this.messages.push({ role: 'user', content: prompt});

        let turnCount = 0;

        while (turnCount < MAX_TURNS) {
            turnCount++;

            const stream = await completeStream({
                systemPrompt: this.systemPrompt,
                messages: this.messages,
                tools: this.tools,
                onEvent: this.onEvent,
            });

            const msg = new Message()
            for await (const chunk of stream) {
                const ev = msg.feed(chunk)
                if (ev) yield ev;
            }
            console.log('\n')

            const assistantMessage = {
                role: 'assistant',
                content: msg.content,
                reasoning_content: msg.reasoning_content || '',
            }
            if (msg.tool_calls && msg.tool_calls.length > 0) {
                assistantMessage.tool_calls = msg.tool_calls;
            }
            this.messages.push(assistantMessage);

            if (!Array.isArray(msg.tool_calls) || msg.tool_calls.length === 0) {
                break;
            }

            for (const tc of msg.tool_calls) {
                const tool = this.tools.find(t => t.function.name === tc.function.name);
                const functionArgs = JSON.parse(tc.function.arguments);

                yield { type: 'tool_call', name: tc.function.name, arguments: functionArgs };

                if (!tool) {
                    let result = `Tool "${tc.function.name}" not found`;
                    throw new Error(result);
                } else {
                    try {
                        const result = await tool.execute(functionArgs);
                        const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
                        this.messages.push({
                            role: 'tool',
                            tool_call_id: tc.id,
                            name: tc.function.name,
                            content: resultStr,
                        });
                        yield { type: 'tool_result', name: tc.function.name, result: resultStr };
                    } catch (error) {
                        yield { type: 'tool_result', name: tc.function.name, error: error.message };
                        throw error;
                    }
                }
            }
        }
    }
}

export class Message {
    role = '';
    content = '';
    reasoning_content = '';
    tool_calls = [];

    feed(chunk) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.role) {
            this.role = delta.role;
        }
        if (delta?.content) {
            this.content += delta.content;
            return { type: 'text', text: delta.content };
        }
        if (delta?.reasoning_content) {
            this.reasoning_content += delta.reasoning_content;
            return { type: 'reasoning', text: delta.reasoning_content };
        }

        if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
                if (!this.tool_calls[tc.index]) {
                    this.tool_calls[tc.index] = {
                        function: { name: '', arguments: '' },
                    };
                }
                if (tc.id) this.tool_calls[tc.index].id = tc.id;
                if (tc.type) this.tool_calls[tc.index].type = tc.type;
                if (tc.function?.name) this.tool_calls[tc.index].function.name = tc.function.name;

                if (tc.function?.arguments) this.tool_calls[tc.index].function.arguments += tc.function.arguments;
            }
        }

        return null;
    }
}
