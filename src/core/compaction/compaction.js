
import { complete } from '../../ai.js';

const SUMMARIZATION_SYSTEM_PROMPT = `You are a context summarization assistant. Your task is to read a conversation between a user and an AI coding assistant, then produce a structured summary following the exact format specified.

Do NOT continue the conversation. Do NOT respond to any questions in the conversation. ONLY output the structured summary.`;

const SUMMARIZATION_PROMPT = `The messages above are a conversation to summarize. Create a structured context checkpoint summary that another LLM will use to continue the work.

Use this EXACT format:

## Goal
[What is the user trying to accomplish? Can be multiple items if the session covers different tasks.]

## Constraints & Preferences
- [Any constraints, preferences, or requirements mentioned by user]
- [Or "(none)" if none were mentioned]

## Progress
### Done
- [x] [Completed tasks/changes]

### In Progress
- [ ] [Current work]

### Blocked
- [Issues preventing progress, if any]

## Key Decisions
- **[Decision]**: [Brief rationale]

## Next Steps
1. [Ordered list of what should happen next]

## Critical Context
- [Any data, examples, or references needed to continue]
- [Or "(none)" if not applicable]

Keep each section concise. Preserve exact file paths, function names, and error messages.`;

const UPDATE_SUMMARIZATION_PROMPT = `The messages above are NEW conversation messages to incorporate into the existing summary provided in <previous-summary> tags.

Update the existing structured summary with new information. RULES:
- PRESERVE all existing information from the previous summary
- ADD new progress, decisions, and context from the new messages
- UPDATE the Progress section: move items from "In Progress" to "Done" when completed
- UPDATE "Next Steps" based on what was accomplished
- PRESERVE exact file paths, function names, and error messages
- If something is no longer relevant, you may remove it

Use this EXACT format:

## Goal
[Preserve existing goals, add new ones if the task expanded]

## Constraints & Preferences
- [Preserve existing, add new ones discovered]

## Progress
### Done
- [x] [Include previously done items AND newly completed items]

### In Progress
- [ ] [Current work - update based on progress]

### Blocked
- [Current blockers - remove if resolved]

## Key Decisions
- **[Decision]**: [Brief rationale] (preserve all previous, add new)

## Next Steps
1. [Update based on current state]

## Critical Context
- [Preserve important context, add new if needed]

Keep each section concise. Preserve exact file paths, function names, and error messages.`;

// ============================================================================
// Token Estimation
// ============================================================================

/**
 * 估算单条消息的 token 数（保守估计：chars / 4）
 * @param {object} msg - 消息对象，格式同 agent.js 中的 message
 * @returns {number} 估算的 token 数
 */
export function estimateTokens(msg) {
    let chars = 0;

    switch (msg.role) {
        case 'user':
        case 'system':
            chars = (msg.content || '').length;
            break;

        case 'assistant':
            chars += (msg.content || '').length;
            chars += (msg.reasoning_content || '').length;
            if (Array.isArray(msg.tool_calls)) {
                for (const tc of msg.tool_calls) {
                    if (tc.function?.name) chars += tc.function.name.length;
                    if (tc.function?.arguments) chars += tc.function.arguments.length;
                }
            }
            break;

        case 'tool':
            chars = (msg.content || '').length;
            chars += (msg.name || '').length;
            break;

        default:
            chars = (msg.content || '').length;
    }

    return Math.ceil(chars / 4);
}

/**
 * 计算整组消息的总 token 数
 * @param {Array} messages - 消息数组
 * @returns {number} 总 token 数
 */
export function calculateContextTokens(messages) {
    return messages.reduce((sum, msg) => sum + estimateTokens(msg), 0);
}

// ============================================================================
// Compaction Settings
// ============================================================================

/** 默认上下文窗口大小（DeepSeek v4 为 128K） */
const DEFAULT_CONTEXT_WINDOW = 128_000;

/** 为 LLM 回复预留的 token 数 */
const DEFAULT_RESERVE_TOKENS = 16_384;

/** 保留最近多少 token 不压缩 */
const DEFAULT_KEEP_RECENT_TOKENS = 20_000;

// ============================================================================
// Cut Point Detection
// ============================================================================

/**
 * 判断一条消息是否可以作为切割点（tool 消息不能独立切割）
 * @param {object} msg
 * @returns {boolean}
 */
function isValidCutPoint(msg) {
    return msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system';
}

/**
 * 从消息列表中找出切割点。从尾部往前扫描，累计 token 数达到 keepRecentTokens 时停止。
 * 切割点之前的早期消息会被压缩成摘要，之后的消息保留。
 *
 * @param {Array} messages - 消息数组（按时间顺序）
 * @param {number} keepRecentTokens - 保留多少最近的 token
 * @returns {number} 第一个要保留的消息的索引
 */
export function findCutPoint(messages, keepRecentTokens = DEFAULT_KEEP_RECENT_TOKENS) {
    if (messages.length === 0) return 0;

    // 从后往前扫描，收集所有有效切割点
    const cutPoints = [];
    for (let i = 0; i < messages.length; i++) {
        if (isValidCutPoint(messages[i])) {
            cutPoints.push(i);
        }
    }

    if (cutPoints.length === 0) return 0;

    // 从尾部往前走，累计 token
    let accumulated = 0;
    let cutIndex = cutPoints[0]; // 默认保留最老的消息

    for (let i = messages.length - 1; i >= 0; i--) {
        accumulated += estimateTokens(messages[i]);

        if (accumulated >= keepRecentTokens) {
            // 找到 >= 当前位置的最近有效切割点
            for (let c = 0; c < cutPoints.length; c++) {
                if (cutPoints[c] >= i) {
                    cutIndex = cutPoints[c];
                    break;
                }
            }
            break;
        }
    }

    return cutIndex;
}

// ============================================================================
// Compaction Trigger Check
// ============================================================================

/**
 * 判断是否需要触发 compaction
 * @param {number} contextTokens - 当前上下文 token 数
 * @param {number} contextWindow - 模型上下文窗口大小
 * @param {number} reserveTokens - 为回复预留的 token
 * @returns {boolean}
 */
export function shouldCompact(contextTokens, contextWindow = DEFAULT_CONTEXT_WINDOW, reserveTokens = DEFAULT_RESERVE_TOKENS) {
    return contextTokens > contextWindow - reserveTokens;
}

// ============================================================================
// Conversation Serialization
// ============================================================================

/**
 * 将消息列表序列化为纯文本，供 LLM 摘要使用。
 * 避免直接传原始 JSON，防止模型把它当成对话继续。
 *
 * @param {Array} messages - 消息数组
 * @returns {string} 序列化后的文本
 */
export function serializeConversation(messages) {
    const lines = [];

    for (const msg of messages) {
        switch (msg.role) {
            case 'user':
                lines.push(`[user]:\n${msg.content || ''}`);
                break;

            case 'assistant':
                if (msg.content) {
                    lines.push(`[assistant]:\n${msg.content}`);
                }
                if (msg.reasoning_content) {
                    lines.push(`[assistant reasoning]:\n${msg.reasoning_content}`);
                }
                if (Array.isArray(msg.tool_calls)) {
                    for (const tc of msg.tool_calls) {
                        const name = tc.function?.name || 'unknown';
                        const args = tc.function?.arguments || '{}';
                        lines.push(`[assistant: tool_call ${name}]:\n${args}`);
                    }
                }
                break;

            case 'tool':
                lines.push(`[tool${msg.name ? ' ' + msg.name : ''}]:\n${msg.content || ''}`);
                break;

            default:
                lines.push(`[${msg.role}]:\n${msg.content || ''}`);
        }

        lines.push(''); // 空行分隔
    }

    return lines.join('\n');
}

// ============================================================================
// Summary Generation
// ============================================================================

/**
 * 调用 LLM 生成对话摘要。
 *
 * @param {Array}  messagesToSummarize - 待压缩的消息
 * @param {object} [options]
 * @param {string} [options.previousSummary] - 上一次 compaction 的摘要（增量更新用）
 * @param {string} [options.customInstructions] - 额外指令
 * @returns {Promise<string>} 摘要文本
 */
export async function generateSummary(messagesToSummarize, options = {}) {
    const { previousSummary, customInstructions } = options;

    // 选 prompt：首次摘要 vs 增量更新
    let prompt = previousSummary ? UPDATE_SUMMARIZATION_PROMPT : SUMMARIZATION_PROMPT;
    if (customInstructions) {
        prompt = `${prompt}\n\nAdditional focus: ${customInstructions}`;
    }

    // 序列化对话
    const conversationText = serializeConversation(messagesToSummarize);

    let userContent = `<conversation>\n${conversationText}\n</conversation>\n\n`;
    if (previousSummary) {
        userContent += `<previous-summary>\n${previousSummary}\n</previous-summary>\n\n`;
    }
    userContent += prompt;

    const result = await complete({
        systemPrompt: SUMMARIZATION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
    });

    return result.content || '';
}

// ============================================================================
// Compaction Orchestration
// ============================================================================

/**
 * 准备 compaction：找出切割点，分离「待压缩」和「保留」的消息。
 * 纯函数，不调 LLM，方便测试。
 *
 * @param {Array}  messages - 完整消息列表
 * @param {object} [options]
 * @param {number} [options.keepRecentTokens] - 保留最近的 token 数
 * @param {number} [options.contextWindow]   - 模型上下文窗口
 * @param {number} [options.reserveTokens]   - 预留 token
 * @returns {object|null} { messagesToSummarize, keptMessages, firstKeptIndex, tokensBefore } 或 null（无需压缩）
 */
export function prepareCompaction(messages, options = {}) {
    const {
        keepRecentTokens = DEFAULT_KEEP_RECENT_TOKENS,
        contextWindow = DEFAULT_CONTEXT_WINDOW,
        reserveTokens = DEFAULT_RESERVE_TOKENS,
    } = options;

    const totalTokens = calculateContextTokens(messages);

    // 检查是否需要压缩
    if (!shouldCompact(totalTokens, contextWindow, reserveTokens)) {
        return null;
    }

    // 找切割点
    const cutIndex = findCutPoint(messages, keepRecentTokens);

    // 如果切在开头，说明全部保留，不需要压缩
    if (cutIndex <= 0) {
        return null;
    }

    return {
        messagesToSummarize: messages.slice(0, cutIndex),
        keptMessages: messages.slice(cutIndex),
        firstKeptIndex: cutIndex,
        tokensBefore: totalTokens,
    };
}

/**
 * 执行 compaction：压缩早期消息为摘要，返回重建后的消息列表。
 *
 * @param {Array}  messages - 完整消息列表
 * @param {object} [options]
 * @param {number} [options.keepRecentTokens]
 * @param {number} [options.contextWindow]
 * @param {number} [options.reserveTokens]
 * @param {string} [options.previousSummary] - 上一次的摘要（增量合并）
 * @param {string} [options.customInstructions] - 额外指令
 * @returns {Promise<{ summary: string, messages: Array, firstKeptIndex: number, tokensBefore: number }>}
 */
export async function compact(messages, options = {}) {
    const prep = prepareCompaction(messages, options);

    if (!prep) {
        // 不需要压缩，原样返回
        return {
            summary: '',
            messages: [...messages],
            firstKeptIndex: -1,
            tokensBefore: -1,
        };
    }

    const { messagesToSummarize, keptMessages, firstKeptIndex, tokensBefore } = prep;

    const summary = await generateSummary(messagesToSummarize, options);

    // 重建消息列表：摘要消息 + 保留的消息
    const compactedMessages = [
        {
            role: 'system',
            content: `[Compaction Summary]\n\n${summary}`,
        },
        ...keptMessages,
    ];

    return {
        summary,
        messages: compactedMessages,
        firstKeptIndex,
        tokensBefore,
    };
}

export { SUMMARIZATION_SYSTEM_PROMPT, SUMMARIZATION_PROMPT };