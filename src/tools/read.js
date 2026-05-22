import { readFile, access } from 'fs/promises';
import { constants } from 'fs';
import { resolve } from 'path';

// 常量                                                                                                                                                                         
const MAX_LINES = 2000;    // 最大返回行数                                                                                                                                      
const MAX_BYTES = 50 * 1024;  // 最大返回字节 (50KB)  

export async function read({ path, offset, limit }) {
    console.log(`[read] ${path}`);
    const absolutePath = resolve(path);

    // 检查文件是否存在且可读                                                                                                                                                   
    try {
        await access(absolutePath, constants.R_OK);
    } catch {
        return { success: false, error: `File not found or not readable: ${path}` };
    }

    const content = await readFile(absolutePath, 'utf-8');
    const allLines = content.split('\n');

    // offset 是 1-indexed                                                                                                                                                      
    const start = offset ? Math.max(0, offset - 1) : 0;

    let selected = allLines.slice(start);
    if (limit) {
        selected = selected.slice(0, limit);
    }

    let output = selected.join('\n');

    // 截断超长内容                                                                                                                                                             
    const bytes = Buffer.byteLength(output, 'utf-8');
    if (bytes > MAX_BYTES || selected.length > MAX_LINES) {
        // 简单截断策略                                                                                                                                                         
        const truncated = selected.slice(0, MAX_LINES).join('\n').slice(0, MAX_BYTES);
        const endLine = start + truncated.split('\n').length;
        output = truncated + `\n\n[... truncated, showing lines ${start + 1}-${endLine} of ${allLines.length}]`;
    }

    return { success: true, path, content: output, totalLines: allLines.length };
}   