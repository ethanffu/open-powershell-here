# MANUAL_TESTS.md — 真实 Windows 人工验收清单

本文件记录需要在真实 Windows 桌面 + 真实 Obsidian 中人工执行的验收项，以及本机已完成的脚本化平台实验结论。

## 当前状态

```
context-menu entry manually verified (core items); edge items pending
```

- 真实 Obsidian GUI 验收（2026-08-08 用户实测，Ribbon 入口）：**核心项与主要扩展项已通过**。
  - v0.1 直连版本：窗口闪退（与平台行为发现一致）。
  - wt.exe 宿主修复版：可正常打开 PowerShell 窗口、可正常输入输出、`Get-Location` 为 vault 根目录、版本 ≥ 7、关闭 Obsidian 后会话继续运行。
  - 插件自动启用：`.test-vault` 打开后自动加载（受限模式关闭后生效；`install:test` 同时幂等写入 `community-plugins.json`）。
  - `Test-Path $PROFILE` 为 False 属正常（用户从未创建 profile 文件），插件未阻断 Profile 加载（正式会话不带 `-NoProfile`）。
- **文件夹右键菜单入口（2026-08-09 用户实测，新增功能）**：右键单个文件夹出现且只有一项 `Open PowerShell here`（终端图标），点击后在**该文件夹的真实绝对路径**打开可交互 PowerShell，`Get-Location` 正确。对应清单 #25–#27 已通过。
- **尚未真实验收的边缘项**：分号文件夹报错（#31）、vault 根文件夹右键（#28）、普通文件右键不显示（#29）、特殊字符子文件夹（#30）、插件重载无重复项（#32）、Ribbon 与右键交替（#33）、Style Settings 隐藏 Ribbon（#34）等仍为“未执行”，不得把自动化测试当作真实 GUI 验收。
  - #34 实测记录：用户开启 **Hide the ribbon button** 后按钮**未隐藏**（v0.3.0 与 v0.3.1 两版均撤销）。**真实根因**（读 Style Settings 源码确认）：`class-toggle` 加到 `<body>` 的是**设置项 `id`**，`addClass` 属性被新版忽略——此前选择器与 body 类名不匹配。修复：设置项 `id` 即类名、CSS 双选择器（自定义 class + tooltip `aria-label`）+ `!important`、`main.ts` MutationObserver 内联样式强制隐藏。**2026-08-10 用户实机复验：开关可正常隐藏/恢复按钮，已通过（随 v0.4.0 发布）。**
- 剩余低优先级项（特殊字符 vault 路径、wt 缺失回退、UNC、未安装场景等）未在用户环境逐一验证，见下方清单。
- 脚本化 Windows 平台实验：已执行（2026-08-06/08，Windows 桌面会话 + pwsh 7.6.4 MSIX + Node 24.16.0），结论见下。

## 人工验收步骤（准备）

1. 准备一台 Windows 桌面机，安装 Obsidian 桌面版与 PowerShell 7+（如 `winget install Microsoft.PowerShell`）。
2. 准备一个测试 vault（不要使用真实 vault）。
3. `npm ci && npm run build && npm run install:test`（产物进入项目内 `.test-vault/`）。
4. 用 Obsidian 打开 `.test-vault`，在设置中启用 `Open PowerShell Here` 插件。
5. 按下方清单逐项验收并勾选。

## 验收清单

| # | 项目 | 步骤 | 预期 | 状态 |
| --- | --- | --- | --- | --- |
| 1 | 窗口可见 | 点击 Ribbon 按钮 | 出现新的 PowerShell 窗口 | **通过**（2026-08-08） |
| 2 | 可以输入命令 | 在新窗口中输入 `Get-Location` 回车 | 有输出 | **通过**（2026-08-08） |
| 3 | 可以看到输出 | 同上 | 输出可见 | **通过**（2026-08-08） |
| 4 | Ribbon 初始目录正确 | 点击 Ribbon 后输入 `Get-Location` | 等于 vault 根目录 | **通过**（2026-08-08） |
| 5 | PowerShell 版本 | 输入 `$PSVersionTable.PSVersion.Major` | ≥ 7 | **通过**（2026-08-08） |
| 6 | Profile 正常加载 | 观察窗口标题/提示符或输入 `$PROFILE` 相关命令 | 用户 Profile 生效 | **通过**（无 profile 文件属正常，插件未阻断加载；创建文件即可验证） |
| 7 | 关闭 Obsidian 后会话继续 | 打开窗口后关闭 Obsidian | pwsh 进程仍在运行 | **通过**（2026-08-08） |
| 8 | 未调用其他 Shell/终端 | 打开任务管理器或 `Get-Process` | 无 cmd/wt/conhost 由插件启动 | **通过**（代码审查 + wt 宿主实测，仅 wt.exe 宿主 + pwsh） |
| 9 | PATH 中的 PowerShell | 仅把 `pwsh.exe` 放入 PATH | 可启动 | **通过**（用户环境经 PATH 解析启动） |
| 10 | 标准安装目录 | `%ProgramFiles%\PowerShell\7\pwsh.exe` | 可启动 | 未执行 |
| 11 | 未安装 PowerShell | 移除/改名 pwsh | Notice：`PowerShell 7 or later was not found. Install PowerShell and restart Obsidian.` | 未执行（自动化测试覆盖） |
| 12 | PowerShell 6 候选被拒绝 | 仅提供 pwsh 6 | 继续下一个候选或提示未找到 | 未执行（自动化测试覆盖） |
| 13 | PowerShell 7/8+ 被接受 | 安装 7、8 或更高 | 正常启动 | **通过**（用户环境 pwsh ≥ 7） |
| 14 | 普通路径 vault | vault 路径无特殊字符 | 正常 | 未执行 |
| 15 | 含空格路径 | 如 `E:\My Vault` | 正常 | **通过**（`.test-vault` 路径含空格，实测正常） |
| 16 | 中文路径 | 如 `E:\笔记库` | 正常 | 未执行（脚本实验已验证） |
| 17 | 含 `&` 路径 | 如 `E:\A & B` | 正常 | 未执行（脚本实验已验证） |
| 18 | 含括号路径 | 如 `E:\Vault (x)` | 正常 | 未执行（脚本实验已验证） |
| 19 | 含单引号路径 | 如 `E:\It's vault` | 正常 | 未执行（脚本实验已验证） |
| 20 | 其他盘符 | 如 `D:\Vault` | 正常 | 未执行 |
| 21 | UNC 路径 | 系统与 PowerShell 支持的情况下 | 尽力验证并记录结果 | 未执行 |
| 22 | wt 宿主窗口（修复版） | 点击 Ribbon（Windows Terminal 已安装） | 出现新的 WT 窗口且 pwsh 不闪退 | **通过**（2026-08-08，可交互） |
| 23 | wt 缺失回退 | 临时移除 wt 或 PATH 中无 wt | 回退直连（终端启动场景可用） | 未执行（自动化测试覆盖） |
| 24 | 插件自动启用 | 重启 Obsidian 后打开 vault | 插件自动加载（无需手动开启） | **通过**（2026-08-08，受限模式关闭后生效） |
| 25 | **右键单个嵌套文件夹**（新增） | 在 Obsidian 左侧文件列表中右键一个嵌套文件夹（如 `.test-vault` 下的子文件夹） | 菜单出现且只有一项 `Open PowerShell here` | **通过**（2026-08-09 用户实测） |
| 26 | **菜单文字与图标**（新增） | 右键文件夹，观察菜单项 | 文字为 `Open PowerShell here`，图标为终端（Lucide `terminal`） | **通过**（2026-08-09 用户实测） |
| 27 | **右键文件夹初始目录**（新增） | 点击 `Open PowerShell here` 后输入 `Get-Location` | 等于被右键文件夹的真实绝对路径 | **通过**（2026-08-09 用户实测） |
| 28 | **右键 vault 根文件夹**（新增） | 右键文件列表顶部/空白处（能触发文件夹菜单的根位置） | `Open PowerShell here` 存在，点击后在 vault 根目录打开 | 未执行 |
| 29 | **右键普通文件不显示**（新增） | 右键一个普通笔记文件 | 菜单中**没有** `Open PowerShell here` | 未执行 |
| 30 | **特殊字符子文件夹**（新增） | 右键路径含空格/中文/`&`/括号/单引号的子文件夹 | 菜单项存在，点击后 `Get-Location` 为该文件夹 | 未执行 |
| 31 | **分号子文件夹明确报错**（新增） | 右键路径含 `;` 的子文件夹（如 `E:\Odd;Folder`），点击菜单项 | 显示 Notice：`PowerShell cannot be opened for paths containing a semicolon (;).`，**没有任何窗口/进程启动** | 未执行 |
| 32 | **插件重载无重复菜单项**（新增） | 禁用→启用插件（或重载 vault），再右键文件夹 | 菜单中仍只有一项 `Open PowerShell here`（无重复项） | 未执行 |
| 33 | **Ribbon 与右键交替使用**（新增） | 依次点击 Ribbon、右键文件夹点击菜单项、再点 Ribbon | 每次打开一个新会话窗口，工作目录分别正确 | 未执行 |
| 34 | **Style Settings 隐藏 Ribbon**（新增） | 安装 Style Settings 插件 → 设置 → Style Settings → Open PowerShell Here → 打开 **Hide the ribbon button** | 左侧 Ribbon 按钮消失；关闭开关后按钮恢复；右键菜单入口不受影响 | **通过**（2026-08-10 用户实测） |

## 平台行为发现（脚本化实验，2026-08-06）

实验方法：用 `CreateProcess` 以 `DETACHED_PROCESS`（无控制台、无标准句柄）启动 Node，模拟从资源管理器启动的 Obsidian（GUI、无控制台）；再让该 Node 用 `child_process.spawn('pwsh.exe', …)` 直接创建 pwsh，观察其行为。同时阅读了 Node 24 捆绑 libuv 的 `src/win/process-stdio.c` / `src/win/process.c` 源码交叉验证。

| stdio 配置 | pwsh 标准句柄 | 交互能力 | 表现 |
| --- | --- | --- | --- |
| `'ignore'` | NUL（libuv 打开 NUL 并置 `STARTF_USESTDHANDLES`） | 否 | `IsInputRedirected=True`；交互式 pwsh（无 `-Command`）**立即退出**（exit 0），窗口一闪而过 |
| `'inherit'` | INVALID_HANDLE_VALUE（libuv：无效 fd ≤ 2 时传 INVALID；`STARTF_USESTDHANDLES` 恒置位） | 否（无控制台父进程时） | `IsInputRedirected=True`；交互式 pwsh **立即退出**（exit 0） |
| `'pipe'` / `stdio: []` | 管道（Node 对缺失项补默认 pipe） | 否 | pwsh 挂起等待管道输入，不可交互；Obsidian 退出后管道 EOF 会终止 pwsh |
| `'inherit'`（父进程有控制台时） | 真实控制台句柄 | **是** | pwsh 附加到父进程控制台，`IsInputRedirected=False`，完全可交互（但不产生新窗口） |
| `conhost.exe pwsh …` | — | 不可用 | **参数丢失**：conhost 只取第一个 token 作为目标程序，pwsh 以无参数启动（实测 pwsh 命令行完全为空） |
| `wt.exe` 宿主（`-w 0 pwsh -WorkingDirectory <路径>`） | 真实控制台句柄（ConPTY） | **是** | 从无控制台（DETACHED 模拟）父进程实测：`IsInputRedirected=False`，`-WorkingDirectory` 正确送达含空格/`&`/括号/单引号/中文路径，pwsh 存活且独立于父进程；**唯一限制：路径含 `;` 会被 wt 拆分**（`-WorkingDirectory` 与 `-d` 均无效） |

补充事实：

- `windowsHide: false` 时 libuv 不设 `CREATE_NO_WINDOW`（`wShowWindow=SW_SHOWDEFAULT`），新控制台窗口由操作系统创建——但标准句柄问题仍然存在。
- `detached: true` 在 Windows 映射为 `DETACHED_PROCESS`，会移除控制台，不可用于正式会话。
- 本会话中 `Get-Process MainWindowHandle` 对新控制台窗口始终返回 0（对照实验：`CREATE_NEW_CONSOLE` 启动 pwsh 成功创建新 conhost/OpenConsole 且子进程正常执行），因此本环境的窗口可见性无法通过该 API 确认，需真实桌面人工确认。

### 结论与当前代码状态

- **当前实现（2026-08-09 起）**：两个入口共用同一条启动流程——Ribbon 传 vault 根目录，单文件夹右键菜单（`file-menu` 事件，`Open PowerShell here`，`terminal` 图标）在点击时解析目标文件夹绝对路径（`FileSystemAdapter.getFullPath`，根文件夹用 `getBasePath()`）。
- 正式会话默认通过 `spawn('wt.exe', ['-w','0', verifiedPwsh, '-WorkingDirectory', targetDir], { cwd: targetDir, stdio: 'ignore', windowsHide: false, detached: false, shell: false })` 启动——Windows Terminal 只作为控制台窗口宿主，让 pwsh 获得真实控制台句柄（实测 `IsInputRedirected=False`，完全可交互）。`wt.exe` 缺失（ENOENT）时回退直连 `spawn(pwsh, …, stdio:'inherit')`。
- **分号路径（2026-08-09 用户批准的变更）**：目标路径（vault 根目录或右键文件夹）含 `;` 时**不再回退直连**（wt 会拆分分号；直连在无控制台环境下不可靠），而是**不创建任何进程**（含隐藏版本探测），显示 Notice：`PowerShell cannot be opened for paths containing a semicolon (;).`。`launcher.ts` 内还有一道防御性拒绝，保证任何情况下都不会为 `;` 路径创建进程。
- **变更原因**：v0.1 直连方案在 Explorer 启动的 Obsidian（无控制台 GUI 父进程）下被用户实测确认闪退；根因是 libuv 恒设 `STARTF_USESTDHANDLES` 并显式传无效句柄，Node `spawn` 不存在“让 OS 自动附加新控制台句柄”的模式。
- **授权范围**：用户 2026-08-08 明确接受“放宽约束换取可靠新窗口”的建议；变更仅限于把 `wt.exe` 作为窗口宿主（不代理/监听/记录 I/O，目标路径仍为独立 `-WorkingDirectory` 参数）。`cmd.exe`、`powershell.exe`、`conhost.exe`、`start`、`shell:true` 等仍被禁止。
- 若未来约束再次收紧，可在不改变插件其余设计的前提下替换 `launcher.ts`。

## 记录格式

完成某项后，把状态改为 `通过` 并注明日期与机器信息；新增发现追加到“平台行为发现”。

当前（2026-08-10）：Ribbon 入口的核心项与主要扩展项已通过真实 GUI 验收；文件夹右键菜单入口的核心流程（#25–#27）用户已实测通过；Style Settings 隐藏 Ribbon（#34）已由用户实机复验通过（v0.3.0/v0.3.1 两版曾失效并撤销，根因为 class-toggle 的 body 类名取设置项 `id`，修复后随 v0.4.0 发布）。**分号报错（#31）等边缘项仍未在真实 Obsidian 中执行**（#28–#33 中除 #25–#27 外均为“未执行”）。剩余未执行项均为低优先级/罕见场景（特殊字符路径的实机验证、wt 缺失回退、UNC、未安装场景），其中多项已有脚本化实验或自动化测试覆盖。
