
import { readdir, stat, readFile } from 'fs/promises';
import { join, resolve, basename, dirname } from 'path';

/**
 * 扫描目录，加载所有 skill
 * @param {string} skillsDir - skills 目录路径
 * @returns {Promise<Array<{name, description, path}>>}
 */
export async function loadSkills(skillsDir) {
    const absoluteDir = resolve(skillsDir);

    // ① 检查目录是否存在
    try {
        await stat(absoluteDir);
    } catch {
        return [];  // 目录不存在 → 空列表
    }

    // ② 递归扫描，找到所有 SKILL.md
    const skillFiles = await findSkillFiles(absoluteDir);

    // ③ 逐个解析
    const skills = [];
    for (const filePath of skillFiles) {
        const skill = await parseSkill(filePath);
        if (skill) skills.push(skill);
    }

    return skills;
}

async function findSkillFiles(dir) {
    const results = [];
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
            // 递归进入子目录
            const subResults = await findSkillFiles(fullPath);
            results.push(...subResults);
        } else if (entry.name === 'SKILL.md') {
            results.push(fullPath);
        }
    }

    return results;
}

async function parseSkill(filePath) {
    const content = await readFile(filePath, 'utf-8');

    // ① 提取 frontmatter（两个 --- 之间的内容）
    const lines = content.split('\n');

    // 第一行必须是 ---
    if (lines[0]?.trim() !== '---') {
        console.warn(`[skills] ${filePath}: 缺少 frontmatter`);
        return null;
    }

    // 找第二个 ---
    const endIndex = lines.slice(1).findIndex(l => l.trim() === '---');
    if (endIndex === -1) {
        console.warn(`[skills] ${filePath}: frontmatter 未闭合`);
        return null;
    }

    // ② 解析 key: value
    const fmLines = lines.slice(1, endIndex + 1);  // 两个 --- 之间的内容
    const meta = {};

    for (const line of fmLines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;

        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        meta[key] = value;
    }

    // ③ 校验必填字段
    if (!meta.name || !meta.description) {
        console.warn(`[skills] ${filePath}: 缺少 name 或 description`);
        return null;
    }

    return {
        name: meta.name,
        description: meta.description,
        path: filePath,  // 已经是绝对路径
    };
}