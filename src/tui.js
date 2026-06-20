import chalk from 'chalk';
import {
    TUI, ProcessTerminal, Editor, Markdown, Text, Loader, Spacer,
    CombinedAutocompleteProvider, matchesKey, Key,
} from '@earendil-works/pi-tui';
import { Agent } from './agent.js';
import { codingTools } from './tools/tools.js';
import { loadSkills } from './skill.js';
import { loadAuthConfig } from './config.js';

// ── Themes ────────────────────────────────────────────────────────

const markdownTheme = {
    heading:      (s) => chalk.bold.cyan(s),
    link:         (s) => chalk.blue(s),
    linkUrl:      (s) => chalk.dim(s),
    code:         (s) => chalk.yellow(s),
    codeBlock:    (s) => chalk.green(s),
    codeBlockBorder: (s) => chalk.dim(s),
    quote:        (s) => chalk.italic(s),
    quoteBorder:  (s) => chalk.dim(s),
    hr:           (s) => chalk.dim(s),
    listBullet:   (s) => chalk.cyan(s),
    bold:         (s) => chalk.bold(s),
    italic:       (s) => chalk.italic(s),
    strikethrough:(s) => chalk.strikethrough(s),
    underline:    (s) => chalk.underline(s),
};

const editorTheme = {
    borderColor: (s) => chalk.dim(s),
    selectList: {
        selectedPrefix: (s) => chalk.blue(s),
        selectedText:   (s) => chalk.bold(s),
        description:    (s) => chalk.dim(s),
        scrollInfo:     (s) => chalk.dim(s),
        noMatch:        (s) => chalk.dim(s),
    },
};

// ── Start REPL ────────────────────────────────────────────────────

export async function startREPL() {
    // 检查认证配置
    try {
        loadAuthConfig();
    } catch (err) {
        console.error(chalk.red('❌ ' + err.message));
        console.error(chalk.dim('运行 shn init 创建配置文件'));
        process.exit(1);
    }

    // Load skills
    let skills = [];
    try {
        skills = await loadSkills('./.agents/skills');
    } catch {}

    const skillSection = skills.length > 0
        ? `\n\n## 可用技能\n${skills.map(s => `- **${s.name}**: ${s.description}`).join('\n')}\n\n要使用某个技能，用 read 工具读取 .agents/skills/<技能名>/SKILL.md 获取完整说明。`
        : '';

    const systemPrompt = `你是一个编程助手。${skillSection}`;

    // ── TUI setup ─────────────────────────────────────────────
    const terminal = new ProcessTerminal();
    const tui = new TUI(terminal);

    // Welcome message
    tui.addChild(new Text(
        chalk.bold(' shn — AI Agent Harness\n') +
        chalk.dim(' 输入问题，Agent 会自动使用工具完成任务。Tab 补全路径，/ 查看命令。Ctrl+C 退出。'),
    ));
    tui.addChild(new Spacer(1));

    // Editor (always last child)
    const editor = new Editor(tui, editorTheme);
    const autocomplete = new CombinedAutocompleteProvider(
        [
            { name: 'delete', description: '删除上一条消息' },
            { name: 'clear', description: '清空所有消息' },
        ],
        process.cwd(),
    );
    editor.setAutocompleteProvider(autocomplete);
    tui.addChild(editor);
    tui.setFocus(editor);

    let isResponding = false;

    editor.onSubmit = async (value) => {
        if (isResponding) return;
        const trimmed = value.trim();
        if (!trimmed) return;

        // ── Slash commands ──────────────────────────────────
        if (trimmed === '/delete') {
            const kids = tui.children;
            // kids: [welcome, spacer, messages..., editor]
            if (kids.length > 3) {
                kids.splice(kids.length - 2, 1);
                tui.requestRender();
            }
            return;
        }
        if (trimmed === '/clear') {
            const kids = tui.children;
            kids.splice(2, kids.length - 3);
            tui.requestRender();
            return;
        }

        // ── Submit ──────────────────────────────────────────
        isResponding = true;
        editor.disableSubmit = true;

        const kids = tui.children;
        const insertAt = kids.length - 1; // before editor

        // User message
        kids.splice(insertAt, 0, new Markdown(
            `**user>** ${trimmed}`,
            1, 1, markdownTheme,
        ));

        // Loader
        const loader = new Loader(
            tui,
            (s) => chalk.cyan(s),
            (s) => chalk.dim(s),
            '思考中…',
        );
        kids.splice(insertAt + 1, 0, loader);
        tui.requestRender();

        // ── Run Agent ───────────────────────────────────────
        const agent = new Agent({
            systemPrompt,
            tools: codingTools,
        });

        let assistantContent = '';
        try {
            for await (const ev of agent.run(trimmed)) {
                if (ev?.text) {
                    assistantContent += ev.text;
                }
                // Also stream text to a temporary buffer for display
                // For now we just collect all text
            }
        } catch (err) {
            assistantContent = `**Error:** ${err.message}`;
        }

        // Replace loader with assistant response
        tui.removeChild(loader);

        const responseText = assistantContent.trim() || '(no response)';
        kids.splice(insertAt + 1, 0, new Markdown(
            responseText,
            1, 1, markdownTheme,
        ));

        isResponding = false;
        editor.disableSubmit = false;
        tui.requestRender();
    };

    // Ctrl+C to exit
    tui.addInputListener((data) => {
        if (matchesKey(data, Key.ctrl('c'))) {
            tui.stop();
            process.exit(0);
        }
    });

    tui.start();
}

// Direct run
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMain) {
    await startREPL();
}
