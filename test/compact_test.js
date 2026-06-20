import { prepareCompaction, compact, calculateContextTokens } from '../src/core/compaction/compaction.js';

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

function assert(condition, label) {
    if (condition) {
        passed++;
        console.log(`  ✅ ${label}`);
    } else {
        failed++;
        console.log(`  ❌ ${label}`);
    }
}

function makeMsg(role, content, toolCalls) {
    const msg = { role, content };
    if (toolCalls) msg.tool_calls = toolCalls;
    return msg;
}

// ============================================================================
// Tests: prepareCompaction
// ============================================================================

console.log('\n--- prepareCompaction ---\n');

// 1) 空列表 → null
{
    const result = prepareCompaction([]);
    assert(result === null, '空列表返回 null');
}

// 2) 消息很少，未达阈值 → null
{
    const msgs = [
        makeMsg('user', 'hi'),
        makeMsg('assistant', 'hello'),
    ];
    const result = prepareCompaction(msgs);
    assert(result === null, '未达阈值返回 null');
}

// 3) 足够多的消息，触发压缩
{
    // 每条 ~500 tokens，6 条 = ~3000 tokens
    // contextWindow = 2000, reserveTokens = 500 → 阈值 1500
    // 3000 > 1500 → 触发
    const msgs = [
        makeMsg('user', 'A'.repeat(2000)),       // ~500
        makeMsg('assistant', 'B'.repeat(2000)),   // ~500
        makeMsg('user', 'C'.repeat(2000)),        // ~500
        makeMsg('assistant', 'D'.repeat(2000)),   // ~500
        makeMsg('user', 'E'.repeat(2000)),        // ~500
        makeMsg('assistant', 'F'.repeat(2000)),   // ~500
    ];
    // keepRecent = 800 tokens → 从尾部累加，到第三条时超过
    const result = prepareCompaction(msgs, {
        contextWindow: 2000,
        reserveTokens: 500,
        keepRecentTokens: 800,
    });

    assert(result !== null, '超过阈值返回 preparation 对象');
    assertEq(result.tokensBefore, 3000, 'tokensBefore = 总 token 数');
    assert(result.messagesToSummarize.length > 0, '有待压缩的消息');
    assert(result.keptMessages.length > 0, '有保留的消息');
    assertEq(
        result.messagesToSummarize.length + result.keptMessages.length,
        msgs.length,
        '待压缩 + 保留 = 总消息数'
    );
}

// 4) 第一个有效切割点在索引 0 → null（全部保留）
{
    // 有效切割点只有索引 0，累计未超阈值
    const msgs = [
        makeMsg('user', 'tiny'),
    ];
    const result = prepareCompaction(msgs, {
        contextWindow: 1000,
        reserveTokens: 100,
        keepRecentTokens: 100,
    });
    assert(result === null, '切在开头(null) 返回 null');
}

// 5) 全是 tool 消息 → 无有效切割点 → null
{
    const msgs = [
        makeMsg('tool', 'result1'),
        makeMsg('tool', 'result2'),
    ];
    const result = prepareCompaction(msgs, {
        contextWindow: 100,
        reserveTokens: 10,
        keepRecentTokens: 1,
    });
    assert(result === null, '全是 tool 消息返回 null');
}

// ============================================================================
// Tests: compact (不需 LLM 的场景)
// ============================================================================

console.log('\n--- compact (no LLM needed) ---\n');

// 6) 不需要压缩 → summary='', messages 原样返回
{
    const msgs = [
        makeMsg('user', 'hi'),
        makeMsg('assistant', 'hello'),
    ];
    const result = await compact(msgs);
    assertEq(result.summary, '', '无需压缩时 summary 为空');
    assertEq(result.firstKeptIndex, -1, '无需压缩时 firstKeptIndex = -1');
    assertEq(result.messages.length, 2, '消息数组不变');
    assert(result.messages === msgs || result.messages[0] === msgs[0], '消息内容不变');
}

// 7) 空列表 → 原样返回
{
    const result = await compact([]);
    assertEq(result.summary, '', '空列表 summary 为空');
    assertEq(result.messages.length, 0, '空列表返回空数组');
}

// ============================================================================
// Summary
// ============================================================================

console.log(`\n结果: ${passed} 通过, ${failed} 失败\n`);
process.exit(failed > 0 ? 1 : 0);
