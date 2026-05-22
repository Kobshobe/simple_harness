import { mkdir, writeFile as fsWriteFile } from 'fs/promises';
import { dirname, resolve } from 'path';

export async function writeFile({ path, content }) {
    console.log(`[write] ${path}`);

    const absolutePath = resolve(path);

    try {
        await mkdir(dirname(absolutePath), { recursive: true });
        await fsWriteFile(absolutePath, content, 'utf-8');
        return { success: true, path, bytes: content.length };
    } catch (error) {
        return { success: false, error: error.message };
    }
} 