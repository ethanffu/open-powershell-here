# Vault PowerShell

[English](README.en.md)

在 Obsidian 左侧 Ribbon 中点击一个按钮，直接打开本机 **PowerShell 7 或更高版本**，并以当前 vault 根目录作为初始工作目录。

> ⚠️ **仓库可见性：Private**。当前 GitHub 仓库为私有仓库，主要通过手动复制构建产物（`main.js` + `manifest.json`）安装，详见下文。

## 项目简介

Vault PowerShell 是一个轻量级 Obsidian 桌面插件，只提供一个 Ribbon 按钮。它不做任何终端内嵌、命令面板命令、设置页或自动脚本执行；它只做一件事：找到本机已安装的 `pwsh.exe`（PowerShell 7+），验证版本，然后直接启动它并把当前 vault 根目录设为初始工作目录。

## 功能

- Obsidian 左侧 Ribbon 按钮（Lucide `terminal` 图标，tooltip：`Open PowerShell at vault root`）。
- 只启动经过版本验证的 `pwsh.exe`；正式会话默认以 Windows Terminal（`wt.exe`）作为控制台窗口宿主（仅宿主用途，用户已授权）。不调用 `powershell.exe`、`cmd.exe`、`conhost.exe`、`start`、WSL、Git Bash 或其他 Shell/终端程序，不使用 `shell: true`。
- PowerShell 查找顺序：
  1. `pwsh.exe`（由 Windows 使用 Obsidian 进程继承的 `PATH` 解析）
  2. `%ProgramFiles%\PowerShell\7\pwsh.exe`
  3. `%USERPROFILE%\.dotnet\tools\pwsh.exe`
- 对每个候选执行隐藏的版本探测（`-NoLogo -NoProfile -NonInteractive -Command $PSVersionTable.PSVersion.Major`，无窗口、5 秒超时、只接受退出码 0、输出必须是可解析且 ≥ 7 的整数）。PowerShell 6 会被拒绝。
- 版本验证通过后，通过 Windows Terminal（`wt.exe`，仅作为控制台窗口宿主）启动同一个 `pwsh.exe` 正式会话：不附加 `-NoProfile`/`-NonInteractive`/`-Command`，用户 Profile 正常加载，不自动执行任何命令。`wt.exe` 缺失或 vault 路径含 `;` 时自动回退直接启动 `pwsh.exe`。
  > 背景：从资源管理器启动的 Obsidian（无控制台的 GUI 进程）直接 `spawn` 时，pwsh 无法获得可交互控制台句柄会立即退出（v0.1 实测闪退）；以 Windows Terminal 作为窗口宿主后 pwsh 获得真实控制台句柄，完全可交互（已实测，详见 MANUAL_TESTS.md）。本变更经用户明确授权，且仅限宿主用途：插件不代理、不监听、不记录任何输入输出。
- vault 路径通过 `-WorkingDirectory` 独立参数传递，同时把子进程 `cwd` 设为 vault 根目录；路径不会被拼进任何命令字符串，兼容空格、中文、`&`、括号、单引号等特殊字符。
- 内存缓存已验证的 `pwsh.exe` 路径与主版本号（仅存在于内存，重启 Obsidian 后重新验证）；正式启动发生 `ENOENT` 时清除缓存并重试一次。
- 查找期间有“解析中”单飞锁，快速双击不会产生多个并行探测；缓存就绪后每次单击都打开一个新会话，无冷却时间。

## 系统要求

- **仅支持 Windows 桌面端 Obsidian**（`isDesktopOnly: true`）。非 Windows 平台仍显示 Ribbon 按钮，点击时提示 `Vault PowerShell only supports Obsidian Desktop on Windows.`
- **仅支持 PowerShell 7 或更高版本（pwsh）**。不支持 Windows PowerShell 5.1（`powershell.exe`），插件也不会自动下载或安装 PowerShell。
- 需要本机已安装 PowerShell 7+（Microsoft Store 版、MSI 安装或 `dotnet tool install` 均可，只要 `pwsh.exe` 可被找到）。

## 使用方式

1. 安装插件（见下方安装方式）。
2. 重启 Obsidian 或重新加载插件。
3. 点击左侧 Ribbon 中的终端图标。
4. 插件会查找并验证 `pwsh.exe`，然后在 vault 根目录打开 PowerShell 会话。

失败时显示简短、可操作的英文 Notice，详细错误写入 Obsidian 开发者控制台（`Ctrl+Shift+I`）。成功时不显示 Notice。

## 手动安装方式

私有仓库不发布到 Obsidian 社区市场，请手动复制构建产物：

1. 在项目根目录执行 `npm run build`（或直接使用仓库中已提交的 `main.js`）。
2. 找到你的 vault 目录，进入 `.obsidian/plugins/`（不存在则创建）。
3. 创建文件夹 `vault-powershell/`，把 `main.js` 和 `manifest.json` 复制进去（如有 `styles.css` 一并复制）。
4. 在 Obsidian 设置 → 第三方插件中启用 **Vault PowerShell**。

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
5. 验证通过后缓存路径与主版本号；正式会话直接用该 `pwsh.exe` 启动。

## 隐私与安全

- 插件**不联网**、**不收集遥测**、**不上传任何数据**。
- 插件**不读取笔记内容**、**不修改 vault 中的任何文件**、不创建日志文件。
- vault 路径只作为独立进程参数（`-WorkingDirectory`）和子进程 `cwd` 使用，不写入任何文件。
- 插件**不监听、不代理、不记录** PowerShell 会话的输入输出。
- 插件**不自动执行任何 PowerShell 命令或脚本**（正式会话不含 `-Command`）。
- 插件**不下载、不安装、不更新** PowerShell。
- 不执行来自 vault 文件名或路径的代码。

## 已知限制

- 插件只提供 Ribbon 按钮：没有命令面板命令、快捷键、设置页、右键菜单或内嵌终端。
- 仅支持 Windows；仅支持 PowerShell 7+；不支持 5.1。
- 正式会话默认以 Windows Terminal（`wt.exe`）作为控制台窗口宿主（用户授权的约束变更，v0.1 直连方案实测会闪退）；`wt.exe` 缺失时回退为直接启动 `pwsh.exe`（从终端启动 Obsidian 时可用）。插件始终不调用 `cmd.exe`、`powershell.exe`、`conhost.exe`、`start` 或 `shell: true`。
- **含 `;` 的 vault 路径**不受支持（Windows Terminal 会把分号当作命令分隔符，实测确认）；此类路径自动回退为直接启动 `pwsh.exe`。其他特殊字符（空格、`&`、括号、单引号、中文）均已实测安全。
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
| `npm run install:test` | 把构建产物复制到项目内 `.test-vault`（临时测试 vault，已 gitignore） |

## 测试说明

- 自动化测试覆盖：候选生成与去重、版本探测（`7`/`8`/`7\r\n`/`6`/`abc`/空串/超时/非零退出码/文件不存在）、启动参数（只启动已验证的 `pwsh.exe`、`-WorkingDirectory` 独立参数、`cwd`、无 Shell、无 `-NoProfile`/`-NonInteractive`/`-Command`）、完整流程（候选回退、PowerShell 6 拒绝、缓存失效重试一次、单飞锁、缓存后多窗口、非 Windows 提示、adapter 运行时检查）。
- 自动化测试通过 mock 进程调用层完成，**不会真的弹出 PowerShell 窗口**。
- 真实 Windows 人工验收清单见 `MANUAL_TESTS.md`。自动化测试不能替代真实窗口交互验证。

## 当前项目状态

`Implementation completed; manual Windows verification pending`

- 代码、构建与自动化测试已完成；Windows 上的进程创建行为已通过脚本化实验验证（详见 `MANUAL_TESTS.md` 的“平台行为发现”）。
- 用户在真实 Obsidian 中实测 v0.1 直连版确认闪退；wt 宿主修复版（v0.1.1 工作区版本）已交付，待用户重新人工验收（`.test-vault`）。

## License

MIT License，见 [LICENSE](LICENSE)。
