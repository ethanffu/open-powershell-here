# Open PowerShell here

[English](README.md)

在 Obsidian 中打开本机 **PowerShell 7 或更高版本**：点击左侧 Ribbon 按钮在 vault 根目录打开，或在 Obsidian 左侧**文件列表**中右键**单个文件夹**，从菜单选择 **Open PowerShell here** 在该文件夹打开。

> 从最新 GitHub Release 安装（见下文）或从源码构建。插件尚未发布到 Obsidian 社区市场。

## 项目简介

Open PowerShell here 是一个轻量级 Obsidian 桌面插件，提供两个入口：Ribbon 按钮（在 vault 根目录打开）与单文件夹右键菜单项（在被右键文件夹打开）。它不做任何终端内嵌、命令面板命令、快捷键、设置页、批量右键菜单或自动脚本执行；它只做一件事：找到本机已安装的 `pwsh.exe`（PowerShell 7+），验证版本，然后直接启动它并把目标目录（vault 根目录或右键文件夹）设为初始工作目录。

## 功能

- **Ribbon 按钮**（Lucide `terminal` 图标，tooltip：`Open PowerShell at vault root`）：在当前 vault 根目录打开 PowerShell。
- **Style Settings 可选集成**：安装 [Style Settings](https://github.com/mgmeyers/obsidian-style-settings) 插件后，可在 设置 → Style Settings → Open PowerShell here 中打开 **Hide the ribbon button** 隐藏左侧 Ribbon 按钮（仅隐藏按钮，功能保留；单文件夹右键菜单入口不受影响）。
- **单文件夹右键菜单**：在 Obsidian 左侧**文件列表**中右键**单个文件夹**，菜单显示 **`Open PowerShell here`**（Lucide `terminal` 图标），点击后在该文件夹的真实 Windows 绝对路径中打开 PowerShell。vault 根文件夹同样支持。右键普通文件、多选时不显示该菜单项。
- 只启动经过版本验证的 `pwsh.exe`；正式会话默认以 Windows Terminal（`wt.exe`）作为控制台窗口宿主（仅宿主用途，用户已授权）。不调用 `powershell.exe`、`cmd.exe`、`conhost.exe`、`start`、WSL、Git Bash 或其他 Shell/终端程序，不使用 `shell: true`。
- PowerShell 查找顺序：
  1. `pwsh.exe`（由 Windows 使用 Obsidian 进程继承的 `PATH` 解析）
  2. `%ProgramFiles%\PowerShell\7\pwsh.exe`
  3. `%USERPROFILE%\.dotnet\tools\pwsh.exe`
- 对每个候选执行隐藏的版本探测（`-NoLogo -NoProfile -NonInteractive -Command $PSVersionTable.PSVersion.Major`，无窗口、5 秒超时、只接受退出码 0、输出必须是可解析且 ≥ 7 的整数）。PowerShell 6 会被拒绝。
- 版本验证通过后，通过 Windows Terminal（`wt.exe`，仅作为控制台窗口宿主）启动同一个 `pwsh.exe` 正式会话：不附加 `-NoProfile`/`-NonInteractive`/`-Command`，用户 Profile 正常加载，不自动执行任何命令。`wt.exe` 缺失时自动回退直接启动 `pwsh.exe`。
  > 背景：从资源管理器启动的 Obsidian（无控制台的 GUI 进程）直接 `spawn` 时，pwsh 无法获得可交互控制台句柄会立即退出（v0.1 实测闪退）；以 Windows Terminal 作为窗口宿主后 pwsh 获得真实控制台句柄，完全可交互（已实测，详见 MANUAL_TESTS.md）。本变更经用户明确授权，且仅限宿主用途：插件不代理、不监听、不记录任何输入输出。
- 目标路径通过 `-WorkingDirectory` 独立参数传递，同时把子进程 `cwd` 设为该目录；路径不会被拼进任何命令字符串，兼容空格、中文、`&`、括号、单引号等特殊字符。
- 内存缓存已验证的 `pwsh.exe` 路径与主版本号（仅存在于内存，重启 Obsidian 后重新验证；Ribbon 与右键菜单共用同一缓存）；正式启动发生 `ENOENT` 时清除缓存并重试一次。
- 查找期间有“解析中”单飞锁，快速双击（或两个入口同时触发）不会产生多个并行探测；缓存就绪后每次点击任一入口都打开一个新会话，无冷却时间。

## 适合人群

> **特别适合**：在 vault 根目录下按主题/项目拆分了多个知识库（子库），并习惯用 Agent CLI（如 Claude Code、Codex CLI、Gemini CLI 等）在终端里干活的人——右键对应的子库文件夹 → **Open PowerShell here**，Agent 直接在你想要的目录就位，全程不用手动 `cd`。

- **Windows 桌面端 Obsidian 用户**，且已安装 PowerShell 7+（`pwsh`）——开发者、运维、脚本爱好者。
- 经常需要在 **vault 根目录或某个文件夹里**打开 PowerShell 的人：运行 vault 内的脚本、`git` 操作、批量重命名/处理文件、在 vault 真实路径下测试命令。
- 不想每次都手动打开终端再 `cd` 到 vault 路径的人。
- 偏好**真实的、可交互的 PowerShell 窗口**（默认由 Windows Terminal 承载）而不是内嵌面板的用户。

**不适合**：macOS/Linux 用户、只有 Windows PowerShell 5.1 的用户、期望内嵌终端或跨平台 Shell 启动器的用户、尚未安装 PowerShell 7+ 的用户。

## 系统要求

- **仅支持 Windows 桌面端 Obsidian**（`isDesktopOnly: true`）。非 Windows 平台仍显示 Ribbon 按钮，点击时提示 `Open PowerShell here only supports Obsidian Desktop on Windows.`；文件夹右键菜单项在非 Windows 平台不显示。
- **仅支持 PowerShell 7 或更高版本（pwsh）**。不支持 Windows PowerShell 5.1（`powershell.exe`），插件也不会自动下载或安装 PowerShell。
- 需要本机已安装 PowerShell 7+（Microsoft Store 版、MSI 安装或 `dotnet tool install` 均可，只要 `pwsh.exe` 可被找到）。
- vault 必须是本地文件系统 vault（`FileSystemAdapter`）；远程/非本地 vault 不显示文件夹右键菜单项。
- （可选）隐藏 Ribbon 按钮需要第三方插件 [Style Settings](https://github.com/mgmeyers/obsidian-style-settings)。

## 使用方式

1. 安装插件（见下方安装方式）。
2. 重启 Obsidian 或重新加载插件。
3. 方式一：点击左侧 Ribbon 中的终端图标，在 vault 根目录打开 PowerShell。
4. 方式二：在 Obsidian 左侧**文件列表**中右键**单个文件夹**（包括 vault 根文件夹），点击 **Open PowerShell here**，在该文件夹打开 PowerShell。
5. （可选）不想看到 Ribbon 按钮时：安装 [Style Settings](https://github.com/mgmeyers/obsidian-style-settings) 插件，在其设置 → Open PowerShell here 中打开 **Hide the ribbon button**。

失败时显示简短、可操作的英文 Notice，详细错误写入 Obsidian 开发者控制台（`Ctrl+Shift+I`）。成功时不显示 Notice。

## 手动安装方式

仓库尚未发布到 Obsidian 社区市场，可通过以下任一方式安装：

**方式 A：从 GitHub Release 下载 zip（推荐，无需命令行）**

1. 用浏览器打开仓库 Release 页面（需登录 GitHub）：`https://github.com/ethanffu/vault-powershell/releases`（或直接访问 v0.3.0 资产页）。
2. 下载 `vault-powershell-0.3.0.zip`，解压得到 `vault-powershell/` 文件夹。
3. 找到你的 vault 目录，进入 `.obsidian/plugins/`（不存在则创建）。
4. 把解压出的 `vault-powershell/` 整个文件夹复制进去。
5. 在 Obsidian 设置 → 第三方插件中启用 **Open PowerShell here**（若提示受限模式，先关闭它）。

> Release 页面下载无需 GitHub 登录；zip 可自由转发给需要的人（解压即用，无需 GitHub 账号）。

**方式 B：从源码构建**

1. 在项目根目录执行 `npm run build`（或直接使用仓库中已提交的 `main.js`）。
2. 同方式 A 第 3–5 步，把 `main.js`、`manifest.json` 与 `styles.css`（Style Settings 开关依赖它，**必须一并复制**）放进 `.obsidian/plugins/vault-powershell/` 并启用。

## 从源码构建

```bash
npm ci          # 可重复安装（使用 lockfile）
npm run dev     # 监听并重新构建
npm run build   # 生成生产版 main.js
npm run verify  # lint + typecheck + test + build 全量验证
```

## PowerShell 查找和版本验证逻辑

1. 生成候选列表：`pwsh.exe`（PATH 优先）→ `%ProgramFiles%\PowerShell\7\pwsh.exe` → `%USERPROFILE%\.dotnet\tools\pwsh.exe`；去除重复（不区分大小写）；缺少环境变量时跳过对应候选。
2. 逐个候选执行隐藏版本探测（参数数组、`shell: false`、`windowsHide: true`、5 秒超时、只接受退出码 0）。
3. 输出必须 trim 后是纯整数且主版本 ≥ 7；PowerShell 6 及以下被拒绝；当前候选失败继续验证下一个。
4. 全部失败时提示安装 PowerShell。
5. 验证通过后缓存路径与主版本号（Ribbon 与右键菜单共用）；正式会话直接用该 `pwsh.exe` 启动。

## 隐私与安全

- 插件**不联网**、**不收集遥测**、**不上传任何数据**。
- 插件**不读取笔记内容**、**不修改 vault 中的任何文件**、不创建日志文件。
- vault 路径与文件夹路径只作为独立进程参数（`-WorkingDirectory`）和子进程 `cwd` 使用，不写入任何文件。
- 插件**不监听、不代理、不记录** PowerShell 会话的输入输出。
- 插件**不自动执行任何 PowerShell 命令或脚本**（正式会话不含 `-Command`）。
- 插件**不下载、不安装、不更新** PowerShell。
- 不执行来自 vault 文件名或路径的代码。

## 已知限制

- 入口仅限 Ribbon 与单文件夹右键菜单：没有命令面板命令、快捷键、设置页、批量（多选）右键菜单、文件右键菜单或内嵌终端。
- 仅支持 Windows；仅支持 PowerShell 7+；不支持 5.1；仅支持本地文件系统 vault。
- 正式会话默认以 Windows Terminal（`wt.exe`）作为控制台窗口宿主（用户授权的约束变更，v0.1 直连方案实测会闪退）；`wt.exe` 缺失时回退为直接启动 `pwsh.exe`（从终端启动 Obsidian 时可用）。插件始终不调用 `cmd.exe`、`powershell.exe`、`conhost.exe`、`start` 或 `shell: true`。
- **含 `;` 的目标路径**（vault 根目录或右键文件夹）不受支持（Windows Terminal 会把分号当作命令分隔符，实测确认）；此类路径**不会启动任何进程**，而是显示 Notice：`PowerShell cannot be opened for paths containing a semicolon (;).`。其他特殊字符（空格、`&`、括号、单引号、中文）均已实测安全。
- 仓库已为 **Public**（2026-08-10 起），但尚未发布到 Obsidian 社区市场；主要通过手动复制构建产物安装。

## 开发命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 监听并重新构建 |
| `npm run build` | 生成生产版 `main.js` |
| `npm run lint` | ESLint 检查（src 与 tests） |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm test` | 运行自动化测试（Vitest） |
| `npm run verify` | 依次执行 lint、typecheck、test、build |
| `npm run install:test` | 把构建产物复制到项目内 `.test-vault`（临时测试 vault，已 gitignore），并自动把插件写入启用列表（`community-plugins.json`），打开测试 vault 即自动加载 |

## 测试说明

- 自动化测试覆盖：候选生成与去重、版本探测（`7`/`8`/`7\r\n`/`6`/`abc`/空串/超时/非零退出码/文件不存在）、启动参数（只启动已验证的 `pwsh.exe`、`-WorkingDirectory` 独立参数、`cwd`、无 Shell、无 `-NoProfile`/`-NonInteractive`/`-Command`、`wt.exe` ENOENT 回退直连）、完整流程（候选回退、PowerShell 6 拒绝、缓存失效重试一次、单飞锁、缓存后多窗口、非 Windows 提示、adapter 运行时检查）、文件夹右键菜单（单个文件夹恰好一个 `Open PowerShell here` 菜单项、`terminal` 图标、嵌套/根文件夹路径、文件右键与多选不显示、非 Windows 与非本地 adapter 不显示、`registerEvent` 生命周期无重复处理器、Ribbon 元素携带稳定 CSS class（Style Settings 钩子）、Ribbon 与菜单共享缓存与单飞、分号路径 Notice 且零进程）。
- 自动化测试通过 mock 进程调用层完成，**不会真的弹出 PowerShell 窗口**。
- 真实 Windows 人工验收清单见 `MANUAL_TESTS.md`。自动化测试不能替代真实窗口交互验证。

## 当前项目状态

`context-menu entry manually verified (core items); edge items pending`

- 代码、构建与自动化测试已完成；Windows 进程创建行为已通过脚本化实验验证（MANUAL_TESTS.md“平台行为发现”）。
- 用户在真实 Obsidian 中实测（2026-08-08）：wt 宿主版的 Ribbon 入口可正常打开交互式 PowerShell 窗口，`Get-Location` 为 vault 根目录、版本 ≥ 7、关闭 Obsidian 后会话继续运行、插件重启后自动加载。
- 用户在真实 Obsidian 中实测（2026-08-09）：文件夹右键菜单入口可正常使用——右键单个文件夹出现 `Open PowerShell here`（终端图标），点击后在该文件夹真实绝对路径打开可交互 PowerShell，`Get-Location` 正确。
- 分号文件夹报错、vault 根文件夹右键、文件右键不显示、插件重载去重等边缘项**尚未逐一实机验证**（见 MANUAL_TESTS.md #28–#33）；剩余低优先级项（特殊字符路径实机验证、wt 缺失回退、UNC、未安装场景等）同样未逐一实机验证，其中多项已有脚本化实验/自动化测试覆盖。
- 用户要求移除 Ribbon 入口的计划已撤销（2026-08-10）：保留 Ribbon 按钮，改为 Style Settings 集成（`styles.css` 提供 **Hide the ribbon button** 开关）。首次实现（曾以 v0.3.0/v0.3.1 名义发布后均撤销）在用户环境中不生效，**真实根因**：Style Settings 的 `class-toggle` 把**设置项 `id`**（而非 `addClass`，该属性被忽略）加到 `<body>`，此前 CSS 选择器与 body 类名不匹配。修复：设置项 `id` 即类名；CSS 双选择器（自定义 class + tooltip `aria-label`）+ `!important`；并在 `main.ts` 中用 MutationObserver 监听 body 类、以内联样式强制隐藏按钮（不依赖任何 CSS/DOM 假设）。**Release 待用户实机确认后另行发布（用户指示：经同意才 release，版本号 0.3.0）。**

## 参与贡献

欢迎提交 Issue 和 Pull Request。遇到问题或有改进想法，欢迎开 [Issue](https://github.com/ethanffu/vault-powershell/issues)；想直接改代码，欢迎 fork 后提 PR——提交前请先运行 `npm run verify`。

## License

MIT License，见 [LICENSE](LICENSE)。
