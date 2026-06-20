import { estimateTokens } from '../src/core/compaction/compaction.js';

// ============================================================================
// Helpers
// ============================================================================

let passed = 0;
let failed = 0;

function assertEq(actual, expected, label) {
    if (actual === expected) {
        passed++;
        console.log(`  ✅ ${label} (got ${actual})`);
    } else {
        failed++;
        console.log(`  ❌ ${label}: expected ${expected}, got ${actual}`);
    }
}

// ============================================================================
// Tests
// ============================================================================

console.log('\n--- estimateTokens ---\n');

// 1) user：普通文本
assertEq(
    estimateTokens({ role: 'user', content: '你好世界' }),
    Math.ceil('你好世界'.length / 4),
    'user 消息按 content 长度估算'
);

// 2) user：空 content
assertEq(
    estimateTokens({ role: 'user', content: '' }),
    0,
    'user 空 content 返回 0'
);

// 3) user：undefined content
assertEq(
    estimateTokens({ role: 'user' }),
    0,
    'user 无 content 字段返回 0'
);

// 4) assistant：纯文本
assertEq(
    estimateTokens({ role: 'assistant', content: 'hello world' }),
    Math.ceil('hello world'.length / 4),
    'assistant 纯文本'
);

// 5) assistant：content + reasoning_content
assertEq(
    estimateTokens({
        role: 'assistant',
        content: '答案是 42',
        reasoning_content: '先算 6*7',
    }),
    Math.ceil('答案是 42先算 6*7'.length / 4),
    'assistant 包含 reasoning_content'
);

// 6) assistant：content + tool_calls
assertEq(
    estimateTokens({
        role: 'assistant',
        content: '我来查一下',
        tool_calls: [
            { function: { name: 'read', arguments: '{"path":"a.js"}' } },
        ],
    }),
    Math.ceil(('我来查一下'.length + 'read'.length + '{"path":"a.js"}'.length) / 4),
    'assistant 包含 tool_calls'
);

// 7) assistant：多个 tool_calls
assertEq(
    estimateTokens({
        role: 'assistant',
        content: '',
        tool_calls: [
            { function: { name: 'read', arguments: '{"path":"a.js"}' } },
            { function: { name: 'bash', arguments: '{"command":"ls"}' } },
        ],
    }),
    Math.ceil((
        'read'.length + '{"path":"a.js"}'.length +
        'bash'.length + '{"command":"ls"}'.length
    ) / 4),
    'assistant 多个 tool_calls 全部计入'
);

// 8) assistant：无 tool_calls 字段（不是数组）
assertEq(
    estimateTokens({ role: 'assistant', content: 'ok' }),
    Math.ceil('ok'.length / 4),
    'assistant 无 tool_calls 字段不报错'
);

// 9) tool：content 和 name
assertEq(
    estimateTokens({ role: 'tool', content: '文件内容', name: 'read' }),
    Math.ceil(('文件内容'.length + 'read'.length) / 4),
    'tool 包含 content 和 name'
);

// 10) tool：只有 content，无 name
assertEq(
    estimateTokens({ role: 'tool', content: 'some result' }),
    Math.ceil('some result'.length / 4),
    'tool 无 name 字段'
);

// 11) system
assertEq(
    estimateTokens({ role: 'system', content: '你是一个助手' }),
    Math.ceil('你是一个助手'.length / 4),
    'system 消息'
);

// 12) 未知 role → 走 default
assertEq(
    estimateTokens({ role: 'unknown', content: 'fallback' }),
    Math.ceil('fallback'.length / 4),
    '未知 role 走 default'
);

// 13) chars / 4 向上取整验证
assertEq(
    estimateTokens({ role: 'user', content: 'abc' }),   // 3 chars → ceil(3/4) = 1
    1,
    '3 个字符 → ceil(3/4) = 1'
);
assertEq(
    estimateTokens({ role: 'user', content: 'abcdef' }), // 6 chars → ceil(6/4) = 2
    2,
    '6 个字符 → ceil(6/4) = 2'
);
assertEq(
    estimateTokens({ role: 'user', content: 'abcdefg' }), // 7 chars → ceil(7/4) = 2
    2,
    '7 个字符 → ceil(7/4) = 2'
);
assertEq(
    estimateTokens({ role: 'user', content: 'abcdefgh' }), // 8 chars → ceil(8/4) = 2
    2,
    '8 个字符 → ceil(8/4) = 2'
);
assertEq(
    estimateTokens({ role: 'user', content: 'abcde' }),   // 5 chars → ceil(5/4) = 2
    2,
    '5 个字符 → ceil(5/4) = 2'
);

// ============================================================================
// Summary
// ============================================================================

console.log(`\n结果: ${passed} 通过, ${failed} 失败\n`);
process.exit(failed > 0 ? 1 : 0);
