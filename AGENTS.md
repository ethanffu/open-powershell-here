# AGENTS.md — Open PowerShell Here 项目约束

本文件永久记录本项目（Obsidian 插件 `open-powershell-here`）的核心约束。任何 Agent 在继续本项目前必须完整阅读并遵守本文件；如与本文件冲突，以本文件为准；如与用户最新明确指示冲突，以用户指示为准并在提交前说明。

## 项目本质

- 轻量 Windows 桌面 Obsidian 插件，提供**两个入口**（用户 2026-08-09 明确批准的约束变更，覆盖旧的“Ribbon 唯一入口”约束）：
  1. **Ribbon 按钮**：打开本机 PowerShell 7+（`pwsh.exe`），初始工作目录为当前 vault 根目录；
  2. **单文件夹右键菜单**（Obsidian 左侧文件列表中右键单个文件夹，菜单项 `Open PowerShell here`）：以被右键文件夹的真实 Windows 绝对路径打开 PowerShell 7+。
- **Ribbon 按钮只允许隐藏、不允许移除**（2026-08-10 用户明确指示：撤销“移除 Ribbon”的计划，改为适配 Style Settings）：`styles.css` 的 `@settings` 块只含**一个扁平选项** **Hide the ribbon button**（`class-toggle`，**不得添加 “Ribbon button” 分组标题**）。
  - **关键机制（踩坑后确认，读 Style Settings 源码验证）**：`class-toggle` 加到 `<body>` 的类名是**设置项 `id`**（`SettingsManager.ts` 中 `document.body.classList.add(setting.id)`；`addClass` 属性已被新版 Style Settings 忽略）。因此 `id` 必须等于想要匹配的 body 类名，CSS 选择器与 `main.ts` 的 `HIDE_RIBBON_BODY_CLASS` 常量必须保持一致。
  - **双重保障**：CSS 双选择器（`.vault-powershell-ribbon` + `.clickable-icon[aria-label="Open PowerShell at vault root"]`，`display: none !important`）；同时 `main.ts` 用 `MutationObserver` 监听 body class 变化，以内联样式强制隐藏/恢复按钮（不依赖任何 CSS/DOM 假设，Obsidian 1.13.6 实测环境同样适用）。
  - 安装文档必须要求复制 `styles.css`。不得删除 Ribbon 入口，不得把隐藏做成硬编码（必须可切换）。
- 仍禁止：命令面板命令、快捷键、设置页、批量（多选）右键菜单（`files-menu`）、普通文件右键菜单、内嵌终端、自动执行脚本。
- 插件 ID：`open-powershell-here`（**安装/更新键，永不更改**；2026-08-10 与显示名/仓库名统一，此前为 `vault-powershell`，当时改名尚未发布，代价极低）；显示名 **Open PowerShell Here**；主类：`VaultPowerShellPlugin`（内部实现名，不改）；当前版本 `0.4.0`；仓库 **Public**（2026-08-10 用户决定公开）；默认分支 `main`。
- 内部 CSS hook class（`vault-powershell-ribbon`、`hide-vault-powershell-ribbon`）与插件 id 无关，保持原样（无用户可见影响）。

## 硬性约束（不可违反）

1. **只直接创建经过版本验证的 `pwsh.exe`**（主版本 ≥ 7，通过隐藏探测验证）。
2. **禁止调用或间接调用**：`powershell.exe`、`cmd.exe`、`conhost.exe`、Windows `start`、WSL、Git Bash、其他 Shell/终端程序；禁止 `shell: true`；禁止命令字符串、批处理文件、Shell 包装器、终端启动器绕过。
3. **例外（用户明确授权，2026-08-08）**：正式会话允许以 `wt.exe`（Windows Terminal）作为控制台窗口宿主，让 pwsh 获得真实控制台句柄（从资源管理器启动的 Obsidian 无控制台，直连 spawn 必然闪退，已实测）。授权范围仅限于：wt 只作为窗口宿主，不代理/监听/记录任何输入输出；目标路径仍作为独立 `-WorkingDirectory` 参数传递；`wt.exe` 缺失（ENOENT）时回退直连 spawn pwsh。
   **分号路径（用户明确变更，2026-08-09）**：目标路径（vault 根目录或右键文件夹）只要包含 `;`，**不创建任何进程**（包括版本探测），显示英文 Notice `PowerShell cannot be opened for paths containing a semicolon (;).`。原因：wt 会把 `;` 当作命令分隔符拆分（已实测），直连方案在无控制台环境下不可靠，用户已同意“明确报错、不启动”取代旧的“分号路径回退直连”。`wt.exe` 缺失回退直连 pwsh 的既有策略保持不变。
4. **禁止回退到 Windows PowerShell 5.1**；禁止自动下载/安装/更新 PowerShell；不搜索整个磁盘，不遍历 WindowsApps。
5. 正式会话：不使用 `-NoProfile`/`-NonInteractive`/`-Command`；`-NoProfile` 与 `-Command` 只允许出现在隐藏版本探测中；不自动执行任何命令；正常加载用户 Profile。
6. **安全传递目标路径**（vault 根目录或任意文件夹）：作为独立参数传给 `-WorkingDirectory`，并把 `cwd` 设为该目录；不得把路径拼进命令字符串；不得手动构造 `Set-Location`/`cd`/带引号脚本。
7. 路径解析全部走 `FileSystemAdapter` + `instanceof` 运行时检查：vault 根路径用 `getBasePath()`；文件夹路径用 `getFullPath(folder.path)`（vault 根文件夹 path 为 `''` 时用 `getBasePath()`）；不反推、不读笔记、不改 vault。
8. **右键菜单约束**：只监听公开 `file-menu` 事件（`this.registerEvent(this.app.workspace.on('file-menu', ...))` 管理生命周期，禁用/重载/重启用后不得重复注册）；对目标做可靠的 `instanceof TFolder` 运行时检查，只为**单个** `TFolder` 添加菜单项；菜单项标题 `Open PowerShell here`、图标 `terminal`；目标路径在**点击菜单项时**解析（不在菜单构建阶段固定）；不依赖内部菜单 section 名称；非 Windows 平台、非 `FileSystemAdapter` 不显示菜单项；**不注册 `files-menu`**（不支持多选）。
9. **不修改真实 vault**；测试只使用项目内 `.test-vault/`（gitignore）；`npm run install:test` 只复制 `main.js`/`manifest.json`/存在的 `styles.css`。
10. **不联网、不遥测、不上传**；不写日志文件；不监听/记录 PowerShell 会话；vault 路径只作为进程参数与 `cwd` 使用。
11. 内存缓存（路径 + 主版本）只存在于内存，**Ribbon 与右键菜单共用同一个 `PowerShellFinder` 实例（同一缓存、同一单飞锁）**；正式启动 `ENOENT` 时清缓存并**最多重试一次**；查找期间用单飞锁避免并行探测；缓存后每次点击任一入口都开新窗口、无冷却。
12. 若无法实现可靠交互窗口，必须**如实报告**（实现、表现、原因、代码状态、约束冲突），不得用被禁止的程序悄悄绕过，不得把 mock 测试说成真实窗口验证。

## 平台行为发现（2026-08-06 至 2026-08-08，Windows + pwsh 7.6.4 + Node 24 实测）

- 从无控制台的 GUI 父进程（如资源管理器启动的 Obsidian）用 Node `spawn` 直接创建 `pwsh.exe`：`stdio:'ignore'` → NUL 句柄（pwsh 立即退出）；`stdio:'inherit'` → INVALID_HANDLE_VALUE（libuv `process-stdio.c`：无效 fd ≤2 时传 INVALID_HANDLE_VALUE，且 `STARTF_USESTDHANDLES` 恒置位 → pwsh 立即退出）；管道 → pwsh 挂起且不可交互。**真实用户点击确认：窗口闪退。**
- 父进程有控制台（终端启动的 Obsidian）时，直连 `stdio:'inherit'` → pwsh 附加到同一控制台，完全可交互（`IsInputRedirected=False` 已实测）。
- `conhost.exe pwsh …` 方案实测**参数丢失**（pwsh 以无参数启动），不可用；`wt.exe` 的 `-d`/`-WorkingDirectory` 均会被 `;` 拆分（wt 命令分隔符），`&`/空格/括号/单引号/中文路径均实测安全。
- **`wt.exe` 宿主方案（已授权、已实测）**：从无控制台（DETACHED 模拟）父进程 `spawn('wt.exe', ['-w','0', pwshPath, '-WorkingDirectory', targetDir])` → pwsh `IsInputRedirected=False`（真实控制台句柄、完全可交互）、`-WorkingDirectory` 安全送达特殊字符路径、会话独立于父进程存活。
- 因此正式会话采用：默认 `wt.exe` 宿主（`stdio:'ignore'`，wt 是启动器，句柄无关）；`wt.exe` ENOENT 时回退直连 `spawn(pwsh, …, stdio:'inherit')`。**目标路径含 `;` 时不启动任何进程（2026-08-09 用户变更，见硬性约束 3）。不得把宿主模式改回直连作为默认，也不得用 `cmd.exe`/`conhost.exe`/`shell:true`。**
- 真实 Obsidian GUI 人工验收：Ribbon 的 wt 宿主版本（2026-08-08）与文件夹右键菜单入口（2026-08-09，`Open PowerShell here` 在目标文件夹打开、`Get-Location` 正确）用户均已实测确认可用（`.test-vault`）；分号报错等边缘项仍待验证。`MANUAL_TESTS.md` 未执行项保持“未执行/not performed”，不得伪造。

## 质量与流程

- 每次改动后、回复用户前必须依次完成：
  1. `npm run verify`（lint → typecheck → test → build）通过；
  2. 确认 `main.js` 已重新构建且与源码一致（CI 同样检查 `git diff --exit-code -- main.js`）；
  3. 检查并同步中英文 README（`README.md` 英文为默认、`README.zh.md` 简体中文）、`MANUAL_TESTS.md`、manifest 与 GitHub About/Topics（事实变化才改，不制造无意义差异）；
  4. 检查暂存区无敏感文件（`.env`、token、凭据、`.test-vault`、node_modules、日志）；
  5. `git add -A`；有变化才提交（Conventional Commits，如 `feat:`/`fix:`/`test:`/`docs:`/`chore:`）；无变化不得空提交；
  6. 推送 `main`（本机推送方式见 `AGENTS.local.md`，不提交）；确认远端 HEAD 与本地一致；`git status` 干净后才回复。
- **禁止**：`git push --force` / `--force-with-lease`、改写已推送历史、删除远端分支、覆盖/删除已有远端、跳过 Git hooks、提交凭据。
- 推送与发布由维护者执行（维护者本地运维细节见 `AGENTS.local.md`，该文件不提交、不进入公开仓库）；CI 会检查 `main.js` 与源码同步。
- 构建或测试失败时不得创建声称“已完成”的提交；用户要求保存进度时可提交 WIP 并明确说明。
- 版本发布（tag/Release/版本号/versions.json 更新）只在用户明确要求时进行；普通提交不创建 tag、不创建 Release、不升版本号。**用户 2026-08-10 补充指示：功能经用户实机确认后才可发布 Release；版本号遵循 0.1.1 → 0.2.0 → 0.3.0 的逐次规律（勿跳号）。**
- 自动化验证、构建、真实 Windows GUI 验证、Git 提交、GitHub 推送、README/About 同步必须分开如实报告，不得笼统声称“全部完成”。

## 参考文件

- `MANUAL_TESTS.md`：真实 Windows 人工验收清单与平台行为发现。
- `README.md`（英文，默认）/ `README.zh.md`（简体中文）：用户文档（必须同步，两文件仅在语言与互链上不同）。
- `CONTRIBUTING.md` / `CODE_OF_CONDUCT.md` / `.github/`（Issue/PR 模板）：公开仓库的贡献指南、行为准则与模板。
- `AGENTS.local.md`：维护者本地运维指引（deploy key、推送/发布命令），**不提交**（已 gitignore），仅本机工作区存在。
- `.github/workflows/ci.yml`：Windows CI（lint/typecheck/test/build/`main.js` 同步检查）。
- `src/`：`main.ts`（生命周期、Ribbon 与单文件夹右键菜单、共享启动流程）、`vault-path.ts`（vault 根路径与文件夹路径解析）、`powershell/{candidates,version-probe,launcher,finder,types}.ts`。`styles.css`：Style Settings `@settings` 块（隐藏 Ribbon 开关）与对应 CSS 规则。
- `tests/`：Vitest 测试；`tests/mocks/obsidian.ts` 是 `obsidian` 包（仅类型）的测试替身（见 `vitest.config.ts` 别名），含 Workspace/`file-menu` 事件、Menu/MenuItem、TFolder/TFile、`FileSystemAdapter.getFullPath()` 与 `registerEvent` 生命周期的模拟。
