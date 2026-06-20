import { findCutPoint, estimateTokens } from '../src/core/compaction/compaction.js';

// ============================================================================
// Helpers
// ============================================================================

let passed = 0;
let failed = 0;

function assert(condition, label) {
    if (condition) {
        passed++;
        console.log(`  ✅ ${label}`);
    } else {
        failed++;
        console.log(`  ❌ ${label}`);
    }
}

function assertEq(actual, expected, label) {
    if (actual === expected) {
        passed++;
        console.log(`  ✅ ${label} (got ${actual})`);
    } else {
        failed++;
        console.log(`  ❌ ${label}: expected ${expected}, got ${actual}`);
    }
}

function makeMsg(role, content, toolCalls) {
    const msg = { role, content };
    if (toolCalls) msg.tool_calls = toolCalls;
    return msg;
}

// ============================================================================
// Tests
// ============================================================================

console.log('\n--- findCutPoint ---\n');

// 1) 空列表
{
    const result = findCutPoint([], 1000);
    assertEq(result, 0, '空列表返回 0');
}

// 2) 列表很短，累计未达阈值 → 保留全部（返回索引 0）
{
    const msgs = [
        makeMsg('user', 'hello'),
        makeMsg('assistant', 'hi'),
    ];
    const result = findCutPoint(msgs, 100_000);
    assertEq(result, 0, '未达阈值时返回 0，保留全部');
}

// 3) 超过阈值，正确切在 user 上
{
    const msgs = [
        makeMsg('user', 'A'.repeat(2000)),       // ~500 tokens
        makeMsg('assistant', 'B'.repeat(2000)),   // ~500 tokens
        makeMsg('user', 'C'.repeat(2000)),        // ~500 tokens
        makeMsg('assistant', 'D'.repeat(2000)),   // ~500 tokens
    ];
    // keepRecent = 600 tokens → 从尾部累加，到第三个消息(索引2)时已超过
    // 第三条是 user，可达；返回索引 2
    const result = findCutPoint(msgs, 600);
    assert(result >= 0, '超过阈值时返回有效切割点');
    assert(result === 2, `在 user 处切割，期望索引 2，实际 ${result}`);
}

// 4) 不会在 tool 消息处切割
{
    const msgs = [
        makeMsg('user', 'A'.repeat(2000)),        // ~500 tokens
        makeMsg('assistant', 'B'.repeat(2000), [   // ~500 tokens
            { function: { name: 'read', arguments: '{}' } }
        ]),
        makeMsg('tool', 'C'.repeat(2000)),         // ~500 tokens, 不可切割
        makeMsg('assistant', 'D'.repeat(2000)),    // ~500 tokens
    ];
    // keepRecent = 800 tokens，从尾部累加：
    //   msg[3] assistant → 500, 累计 500
    //   msg[2] tool      → 500, 累计 1000 ≥ 800
    // 最近的合法切割点 >= msg[2] 应该是 msg[3]（因为 msg[2] tool 不可切）
    const result = findCutPoint(msgs, 800);
    assertEq(result, 3, '跳过 tool 消息，切在 assistant 上');
}

// 5) 全是 tool 消息 → 无有效切割点，返回 0
{
    const msgs = [
        makeMsg('tool', 'result1'),
        makeMsg('tool', 'result2'),
    ];
    const result = findCutPoint(msgs, 1);
    assertEq(result, 0, '全是 tool 消息时返回 0');
}

// 6) 超过阈值但最早的合法切割点是 assistant
{
    const msgs = [
        makeMsg('assistant', 'X'.repeat(2000)),   // ~500 tokens
        makeMsg('tool', 'Y'.repeat(2000)),         // ~500 tokens
        makeMsg('user', 'Z'.repeat(2000)),         // ~500 tokens
    ];
    // keepRecent = 400 tokens
    //  msg[2] user → 500 ≥ 400，切在索引 2
    const result = findCutPoint(msgs, 400);
    assertEq(result, 2, '最近一个 user 处切割');
}

// 7) 边界：keepRecent 刚好等于某些消息的总和
{
    const msgs = [
        makeMsg('user', 'A'.repeat(400)),    // 100 tokens
        makeMsg('assistant', 'B'.repeat(400)), // 100 tokens
        makeMsg('user', 'C'.repeat(400)),     // 100 tokens
    ];
    // keepRecent = 200，从尾部累加：
    //   msg[2] user    → 100, 累计 100
    //   msg[1] assistant → 100, 累计 200 ≥ 200 → 最近的合法切割点 ≥ msg[1] 是 msg[2] 还是 msg[1]？
    //   msg[1] assistant 是合法切割点 (cutPoints = [0,1,2])，所以应该是 msg[1]
    const result = findCutPoint(msgs, 200);
    assertEq(result, 1, '边界：累计刚好等于阈值，切在 assistant 处');
}

// ============================================================================
// Summary
// ============================================================================

console.log(`\n结果: ${passed} 通过, ${failed} 失败\n`);
process.exit(failed > 0 ? 1 : 0);
