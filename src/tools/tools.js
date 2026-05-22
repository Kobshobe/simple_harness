import { writeFile } from "./write.js";
import { executeBash } from "./bash.js";
import { read } from "./read.js";
import { edit } from "./edit.js";

export const tools = [
    {
        type: 'function',
        function: {
            name: 'calculator',
            description: '执行数学计算',
            parameters: {
                type: 'object',
                properties: {
                    expression: {
                        type: 'string',
                        description: '数学表达式，例如 "2 + 3 * 4"'
                    }
                },
                required: ['expression']
            }
        },
        execute: calculator
    }
];

export const codingTools = [
    {
        type: 'function',
        function: {
            name: 'writeFile',
            description: 'write content to a file',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'path to the file'
                    },
                    content: {
                        type: 'string',
                        description: 'content to write'
                    }
                },
                required: ['path', 'content']
            }
        },
        execute: writeFile
    },
    {
        type: 'function',
        function: {
            name: 'bash',
            description: 'Execute a bash command in the terminal',
            parameters: {
                type: 'object',
                properties: {
                    command: {
                        type: 'string',
                        description: 'The bash command to execute'
                    },
                    cwd: {
                        type: 'string',
                        description: 'Working directory where the command will be executed (optional)'
                    }
                },
                required: ['command']
            }
        },
        execute: executeBash
    },
    {
        type: 'function',
        function: {
            name: 'read',
            description: 'Read the contents of a file...',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Path to the file to read' },
                    offset: { type: 'number', description: 'Line number to start from (1-indexed)' },
                    limit: { type: 'number', description: 'Max lines to read' }
                },
                required: ['path']
            }
        },
        execute: read
    },
    {
        type: 'function',
        function: {
            name: 'edit',
            description: 'Edit a file with precise text replacement. oldText must match exactly.',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Path to file' },
                    oldText: { type: 'string', description: 'Exact text to replace' },
                    newText: { type: 'string', description: 'Replacement text' }
                },
                required: ['path', 'oldText', 'newText']
            }
        },
        execute: edit
    }
];

/**
 * 计算器工具函数，用于模型调用执行数学计算
 * @param {object} params - 包含表达式的对象，例如 {expression: "2 + 3 * 4"}
 * @returns {object} 计算结果对象
 */
export function calculator(params) {
    console.log('[calculator]', params)
    try {
        // 验证表达式只包含安全的字符（数字、运算符、括号、小数点、空格）
        const safeExpression = params.expression.trim();

        if (!/^[0-9+\-*/().\s]+$/.test(safeExpression)) {
            throw new Error('表达式包含非法字符');
        }

        // 使用 Function 构造器安全地计算表达式
        const result = new Function('return ' + safeExpression)();

        if (typeof result !== 'number' || !isFinite(result)) {
            throw new Error('计算结果无效');
        }

        return {
            expression: safeExpression,
            result: result,
            success: true
        };
    } catch (error) {
        return {
            expression: params.expression,
            error: error.message,
            success: false
        };
    }
}
