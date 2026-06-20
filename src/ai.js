import OpenAI from 'openai';
import { loadAuthConfig } from './config.js';

// 懒初始化：首次调用 API 时从配置文件创建 client
let _client = null;
let _model = null;

function getClient() {
    if (!_client) {
        const config = loadAuthConfig();
        _client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseURL,
        });
        _model = config.model;
    }
    return { client: _client, model: _model };
}

/**
 * 调用 LLM（非流式）
 * @param {object} config
 * @param {Array}  config.messages     - 消息历史
 * @param {string} config.systemPrompt - 系统提示词 (可选)
 * @param {Array}  config.tools        - 工具定义 (可选，OpenAI格式)
 * @returns {Promise<object>} { content, toolCalls, stopReason }
 */
export async function complete(config) {
    const { client, model } = getClient();

    const body = {
        model,
        messages: [
            ...(config.systemPrompt ? [{ role: 'system', content: config.systemPrompt }] : []),
            ...config.messages
        ],
        ...(config.tools ? { tools: config.tools } : {}),
    };
    config.onEvent?.('request', body);

    const completion = await client.chat.completions.create(body);
    config.onEvent?.('completion', completion);
    const msg = completion.choices[0].message;

    return msg;
}

/**
 * 调用 LLM（流式）
 * @param {object} config
 * @param {Array}  config.messages     - 消息历史
 * @param {string} config.systemPrompt - 系统提示词 (可选)
 * @param {Array}  config.tools        - 工具定义 (可选，OpenAI格式)
 * @returns {AsyncGenerator}
 */
export async function* completeStream(config) {
    const { client, model } = getClient();

    const body = {
        model,
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
