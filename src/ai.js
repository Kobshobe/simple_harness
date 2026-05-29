import OpenAI from 'openai';

// 初始化 DeepSeek 客户端
const client = new OpenAI({
    apiKey: 'sk-c44e213d85364b1a929dd2b9172c5876',
    baseURL: 'https://api.deepseek.com/v1'
});

/**                                                                                                                                                                             
 * 调用 LLM，纯函数，不关心工具、不关心循环                                                                                                                                     
 * @param {object} config                                                                                                                                                       
 * @param {Array}  config.messages       - 消息历史                                                                                                                             
 * @param {string} config.systemPrompt   - 系统提示词 (可选)                                                                                                                    
 * @param {Array}  config.tools          - 工具定义 (可选，OpenAI格式)                                                                                                          
 * @returns {object} { content, toolCalls, stopReason }                                                                                                                         
 */
export async function complete(config) {
    const body = {
        model: 'deepseek-v4-pro', // DeepSeek v4 模型
        messages: [
            ...(config.systemPrompt ? [{ role: 'system', content: config.systemPrompt }] : []),
            ...config.messages
        ],
        ...(config.tools ? { tools: config.tools } : {})
    }
    config.onEvent?.('request', body);

    const completion = await client.chat.completions.create(body);
    config.onEvent?.('completion', completion);
    const msg = completion.choices[0].message;

    return msg;
}

export async function* completeStream(config) {
    const body = {
        model: 'deepseek-v4-pro',
        messages: [
            ...(config.systemPrompt ? [{ role: 'system', content: config.systemPrompt }] : []),
            ...config.messages
        ],
        ...(config.tools?.length ? { tools: config.tools } : {}),
        stream: true,                                                                                                                                           
    };
    config.onEvent?.('request', body);

    const stream = await client.chat.completions.create(body);

    for await (const chunk of stream) {
        yield chunk;
    }
} 

export function logMessages(msgType, msg) {
    if (!msg) return;
    console.log(`--- [ ${msgType} ] ---`);
    console.log(JSON.stringify(msg, null, 2));
}