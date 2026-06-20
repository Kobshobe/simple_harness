import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

/** Config directory: ~/.shn/ */
export const SHN_DIR = join(homedir(), '.shn');

/** Auth config path: ~/.shn/agents/auth.json */
export const AUTH_CONFIG_PATH = join(SHN_DIR, 'agents', 'auth.json');

/** Default model */
export const DEFAULT_MODEL = 'deepseek-v4-pro';

/** Default base URL */
export const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';

/**
 * Load auth config from ~/.shn/agents/auth.json
 * 
 * Expected format:
 * {
 *   "apiKey": "sk-xxx",
 *   "baseURL": "https://api.deepseek.com/v1",    // optional
 *   "model": "deepseek-v4-pro"                     // optional
 * }
 * 
 * @returns {{ apiKey: string, baseURL: string, model: string }}
 * @throws {Error} if config file not found
 */
export function loadAuthConfig() {
    if (!existsSync(AUTH_CONFIG_PATH)) {
        throw new Error(
            `未找到认证配置: ${AUTH_CONFIG_PATH}\n` +
            `请创建该文件，格式:\n` +
            JSON.stringify({
                apiKey: 'sk-你的密钥',
                baseURL: DEFAULT_BASE_URL,
                model: DEFAULT_MODEL,
            }, null, 2)
        );
    }

    let raw;
    try {
        raw = readFileSync(AUTH_CONFIG_PATH, 'utf-8');
    } catch (err) {
        throw new Error(`无法读取配置文件 ${AUTH_CONFIG_PATH}: ${err.message}`);
    }

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        throw new Error(`配置文件格式错误 ${AUTH_CONFIG_PATH}: ${err.message}`);
    }

    if (!parsed.apiKey || typeof parsed.apiKey !== 'string') {
        throw new Error(`配置缺少 "apiKey" 字段: ${AUTH_CONFIG_PATH}`);
    }

    return {
        apiKey: parsed.apiKey,
        baseURL: parsed.baseURL || DEFAULT_BASE_URL,
        model: parsed.model || DEFAULT_MODEL,
    };
}

/**
 * 创建示例配置文件
 */
export function createSampleConfig() {
    mkdirSync(dirname(AUTH_CONFIG_PATH), { recursive: true });
    writeFileSync(AUTH_CONFIG_PATH, JSON.stringify({
        apiKey: 'sk-你的密钥',
        baseURL: DEFAULT_BASE_URL,
        model: DEFAULT_MODEL,
    }, null, 2) + '\n');
    console.log(`已创建示例配置文件: ${AUTH_CONFIG_PATH}`);
    console.log('请编辑该文件填入你的 API 密钥。');
}
