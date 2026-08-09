# Vault PowerShell

[English](README.en.md)

在 Obsidian 中打开本机 **PowerShell 7 或更高版本**：点击左侧 Ribbon 按钮在 vault 根目录打开，或在文件资源管理器中右键单个文件夹，从菜单选择 **Open PowerShell here** 在该文件夹打开。

> ⚠️ **仓库可见性：Private**。当前 GitHub 仓库为私有仓库，主要通过手动复制构建产物（`main.js` + `manifest.json`）安装，详见下文。

## 项目简介

Vault PowerShell 是一个轻量级 Obsidian 桌面插件，提供两个入口：Ribbon 按钮（在 vault 根目录打开）与单文件夹右键菜单项（在被右键文件夹打开）。它不做任何终端内嵌、命令面板命令、快捷键、设置页、批量右键菜单或自动脚本执行；它只做一件事：找到本机已安装的 `pwsh.exe`（PowerShell 7+），验证版本，然后直接启动它并把目标目录（vault 根目录或右键文件夹）设为初始工作目录。

## 功能

- **Ribbon 按钮**（Lucide `terminal` 图标，tooltip：`Open PowerShell at vault root`）：在当前 vault 根目录打开 PowerShell。
- **单文件夹右键菜单**：在 Obsidian 文件资源管理器中右键**单个文件夹**，菜单显示 **`Open PowerShell here`**（Lucide `terminal` 图标），点击后在该文件夹的真实 Windows 绝对路径中打开 PowerShell。vault 根文件夹同样支持。右键普通文件、多选时不显示该菜单项。
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

## 系统要求

- **仅支持 Windows 桌面端 Obsidian**（`isDesktopOnly: true`）。非 Windows 平台仍显示 Ribbon 按钮，点击时提示 `Vault PowerShell only supports Obsidian Desktop on Windows.`；文件夹右键菜单项在非 Windows 平台不显示。
- **仅支持 PowerShell 7 或更高版本（pwsh）**。不支持 Windows PowerShell 5.1（`powershell.exe`），插件也不会自动下载或安装 PowerShell。
- 需要本机已安装 PowerShell 7+（Microsoft Store 版、MSI 安装或 `dotnet tool install` 均可，只要 `pwsh.exe` 可被找到）。
- vault 必须是本地文件系统 vault（`FileSystemAdapter`）；远程/非本地 vault 不显示文件夹右键菜单项。

## 使用方式

1. 安装插件（见下方安装方式）。
2. 重启 Obsidian 或重新加载插件。
3. 方式一：点击左侧 Ribbon 中的终端图标，在 vault 根目录打开 PowerShell。
4. 方式二：在左侧文件资源管理器中右键**单个文件夹**（包括 vault 根文件夹），点击 **Open PowerShell here**，在该文件夹打开 PowerShell。

失败时显示简短、可操作的英文 Notice，详细错误写入 Obsidian 开发者控制台（`Ctrl+Shift+I`）。成功时不显示 Notice。

## 手动安装方式

私有仓库不发布到 Obsidian 社区市场，可通过以下任一方式安装：

**方式 A：从 GitHub Release 下载 zip（推荐，无需命令行）**

1. 用浏览器打开仓库 Release 页面（需登录 GitHub）：`https://github.com/ethanffu/vault-powershell/releases`（或直接访问 v0.1.1 资产页）。
2. 下载 `vault-powershell-0.1.1.zip`，解压得到 `vault-powershell/` 文件夹。
3. 找到你的 vault 目录，进入 `.obsidian/plugins/`（不存在则创建）。
4. 把解压出的 `vault-powershell/` 整个文件夹复制进去。
5. 在 Obsidian 设置 → 第三方插件中启用 **Vault PowerShell**（若提示受限模式，先关闭它）。

> 因仓库为 Private，下载需要 GitHub 账号登录；zip 可自由转发给需要的人（解压即用，无需 GitHub 账号）。

**方式 B：从源码构建**

1. 在项目根目录执行 `npm run build`（或直接使用仓库中已提交的 `main.js`）。
2. 同方式 A 第 3–5 步，把 `main.js` 与 `manifest.json` 放进 `.obsidian/plugins/vault-powershell/` 并启用。

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
- 仓库当前为 **Private**，没有发布到 Obsidian 社区市场；私有仓库版本主要通过手动复制构建产物安装。

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

- 自动化测试覆盖：候选生成与去重、版本探测（`7`/`8`/`7\r\n`/`6`/`abc`/空串/超时/非零退出码/文件不存在）、启动参数（只启动已验证的 `pwsh.exe`、`-WorkingDirectory` 独立参数、`cwd`、无 Shell、无 `-NoProfile`/`-NonInteractive`/`-Command`、`wt.exe` ENOENT 回退直连）、完整流程（候选回退、PowerShell 6 拒绝、缓存失效重试一次、单飞锁、缓存后多窗口、非 Windows 提示、adapter 运行时检查）、文件夹右键菜单（单个文件夹恰好一个 `Open PowerShell here` 菜单项、`terminal` 图标、嵌套/根文件夹路径、文件右键与多选不显示、非 Windows 与非本地 adapter 不显示、`registerEvent` 生命周期无重复处理器、Ribbon 与菜单共享缓存与单飞、分号路径 Notice 且零进程）。
- 自动化测试通过 mock 进程调用层完成，**不会真的弹出 PowerShell 窗口**。
- 真实 Windows 人工验收清单见 `MANUAL_TESTS.md`。自动化测试不能替代真实窗口交互验证。

## 当前项目状态

`context-menu entry added; GUI acceptance pending`

- 代码、构建与自动化测试已完成；Windows 进程创建行为已通过脚本化实验验证（MANUAL_TESTS.md“平台行为发现”）。
- 用户在真实 Obsidian 中实测（2026-08-08）：wt 宿主版的 Ribbon 入口可正常打开交互式 PowerShell 窗口，`Get-Location` 为 vault 根目录、版本 ≥ 7、关闭 Obsidian 后会话继续运行、插件重启后自动加载。
- 文件夹右键菜单入口（`Open PowerShell here`）与分号路径 Notice 行为为 2026-08-09 新增，**尚未在真实 Obsidian 中人工验收**，见 MANUAL_TESTS.md。
- 剩余低优先级验收项（特殊字符路径的实机验证、wt 缺失回退、UNC、未安装场景等）未逐一实机验证，其中多项已有脚本化实验/自动化测试覆盖，见 MANUAL_TESTS.md。

## License

MIT License，见 [LICENSE](LICENSE)。
