import { readFile, writeFile, access } from 'fs/promises';
import { constants } from 'fs';
import { resolve } from 'path';

export async function edit({ path, oldText, newText }) {
    console.log(`[edit] ${path}`);
    const absolutePath = resolve(path);

    // 检查文件存在且可写                                                                                                                                                       
    try {
        await access(absolutePath, constants.R_OK | constants.W_OK);
    } catch {
        return { success: false, error: `File not found or not writable: ${path}` };
    }

    const content = await readFile(absolutePath, 'utf-8');

    // 精确匹配 oldText                                                                                                                                                         
    if (!content.includes(oldText)) {
        return {
            success: false,
            error: `Could not find the exact text in ${path}. Make sure oldText matches exactly, including whitespace.`
        };
    }

    // 检查唯一性                                                                                                                                                               
    const count = content.split(oldText).length - 1;
    if (count > 1) {
        return {
            success: false,
            error: `Found ${count} occurrences. Text must be unique. Provide more surrounding context.`
        };
    }

    // 执行替换（用 indexOf + substring，避免 $ 等特殊字符问题）                                                                                                                
    const index = content.indexOf(oldText);
    const newContent = content.substring(0, index) + newText + content.substring(index + oldText.length);

    await writeFile(absolutePath, newContent, 'utf-8');

    return {
        success: true,
        path,
        message: `Replaced ${oldText.length} → ${newText.length} chars in ${path}`
    };
}