# MANUAL_TESTS.md — 真实 Windows 人工验收清单

本文件记录需要在真实 Windows 桌面 + 真实 Obsidian 中人工执行的验收项，以及本机已完成的脚本化平台实验结论。

## 当前状态

```
MVP completed and manually verified (core items); extended checklist pending
```

- 真实 Obsidian GUI 验收：**核心项已通过**（2026-08-08 用户实测）。
  - v0.1 直连版本：用户确认**窗口闪退**（与平台行为发现一致）。
  - wt.exe 宿主修复版：用户确认**可正常打开 PowerShell 窗口、可正常输入输出（对话）**。
- 扩展清单项（特殊字符路径、Profile、关闭 Obsidian 后会话存活等）仍待用户验证。
- 脚本化 Windows 平台实验：已执行（2026-08-06/08，Windows 桌面会话 + pwsh 7.6.4 MSIX + Node 24.16.0），结论见下。
- 不得将自动化测试或脚本化实验描述为真实窗口验证。

## 人工验收步骤（准备）

1. 准备一台 Windows 桌面机，安装 Obsidian 桌面版与 PowerShell 7+（如 `winget install Microsoft.PowerShell`）。
2. 准备一个测试 vault（不要使用真实 vault）。
3. `npm ci && npm run build && npm run install:test`（产物进入项目内 `.test-vault/`）。
4. 用 Obsidian 打开 `.test-vault`，在设置中启用 `Vault PowerShell` 插件。
5. 按下方清单逐项验收并勾选。

## 验收清单

| # | 项目 | 步骤 | 预期 | 状态 |
| --- | --- | --- | --- | --- |
| 1 | 窗口可见 | 点击 Ribbon 按钮 | 出现新的 PowerShell 窗口 | **通过**（2026-08-08） |
| 2 | 可以输入命令 | 在新窗口中输入 `Get-Location` 回车 | 有输出 | **通过**（2026-08-08） |
| 3 | 可以看到输出 | 同上 | 输出可见 | **通过**（2026-08-08） |
| 4 | 初始目录正确 | 输入 `Get-Location` | 等于 vault 根目录 | 待验证 |
| 5 | PowerShell 版本 | 输入 `$PSVersionTable.PSVersion.Major` | ≥ 7 | **通过**（隐含：插件版本探测放行后才启动） |
| 6 | Profile 正常加载 | 观察窗口标题/提示符或输入 `$PROFILE` 相关命令 | 用户 Profile 生效 | 待验证 |
| 7 | 关闭 Obsidian 后会话继续 | 打开窗口后关闭 Obsidian | pwsh 进程仍在运行 | 待验证 |
| 8 | 未调用其他 Shell/终端 | 打开任务管理器或 `Get-Process` | 无 cmd/wt/conhost 由插件启动 | 待验证（代码层面保证：仅 wt.exe 宿主 + pwsh） |
| 9 | PATH 中的 PowerShell | 仅把 `pwsh.exe` 放入 PATH | 可启动 | 未执行 |
| 10 | 标准安装目录 | `%ProgramFiles%\PowerShell\7\pwsh.exe` | 可启动 | 未执行 |
| 11 | 未安装 PowerShell | 移除/改名 pwsh | Notice：`PowerShell 7 or later was not found. Install PowerShell and restart Obsidian.` | 未执行 |
| 12 | PowerShell 6 候选被拒绝 | 仅提供 pwsh 6 | 继续下一个候选或提示未找到 | 未执行 |
| 13 | PowerShell 7/8+ 被接受 | 安装 7、8 或更高 | 正常启动 | 未执行 |
| 14 | 普通路径 vault | vault 路径无特殊字符 | 正常 | 未执行 |
| 15 | 含空格路径 | 如 `E:\My Vault` | 正常 | 未执行 |
| 16 | 中文路径 | 如 `E:\笔记库` | 正常 | 未执行 |
| 17 | 含 `&` 路径 | 如 `E:\A & B` | 正常 | 未执行 |
| 18 | 含括号路径 | 如 `E:\Vault (x)` | 正常 | 未执行 |
| 19 | 含单引号路径 | 如 `E:\It's vault` | 正常 | 未执行 |
| 20 | 其他盘符 | 如 `D:\Vault` | 正常 | 未执行 |
| 21 | UNC 路径 | 系统与 PowerShell 支持的情况下 | 尽力验证并记录结果 | 未执行 |
| 22 | wt 宿主窗口（修复版） | 点击 Ribbon（Windows Terminal 已安装） | 出现新的 WT 窗口且 pwsh 不闪退 | **通过**（2026-08-08，可交互） |
| 23 | wt 缺失回退 | 临时移除 wt 或 PATH 中无 wt | 回退直连（终端启动场景可用） | 未执行 |
| 24 | 含 `;` 路径 vault | 路径含分号（罕见） | 回退直连，行为与 v0.1 相同 | 未执行 |

## 平台行为发现（脚本化实验，2026-08-06）

实验方法：用 `CreateProcess` 以 `DETACHED_PROCESS`（无控制台、无标准句柄）启动 Node，模拟从资源管理器启动的 Obsidian（GUI、无控制台）；再让该 Node 用 `child_process.spawn('pwsh.exe', …)` 直接创建 pwsh，观察其行为。同时阅读了 Node 24 捆绑 libuv 的 `src/win/process-stdio.c` / `src/win/process.c` 源码交叉验证。

| stdio 配置 | pwsh 标准句柄 | 交互能力 | 表现 |
| --- | --- | --- | --- |
| `'ignore'` | NUL（libuv 打开 NUL 并置 `STARTF_USESTDHANDLES`） | 否 | `IsInputRedirected=True`；交互式 pwsh（无 `-Command`）**立即退出**（exit 0），窗口一闪而过 |
| `'inherit'` | INVALID_HANDLE_VALUE（libuv：无效 fd ≤ 2 时传 INVALID；`STARTF_USESTDHANDLES` 恒置位） | 否（无控制台父进程时） | `IsInputRedirected=True`；交互式 pwsh **立即退出**（exit 0） |
| `'pipe'` / `stdio: []` | 管道（Node 对缺失项补默认 pipe） | 否 | pwsh 挂起等待管道输入，不可交互；Obsidian 退出后管道 EOF 会终止 pwsh |
| `'inherit'`（父进程有控制台时） | 真实控制台句柄 | **是** | pwsh 附加到父进程控制台，`IsInputRedirected=False`，完全可交互（但不产生新窗口） |
| `conhost.exe pwsh …` | — | 不可用 | **参数丢失**：conhost 只取第一个 token 作为目标程序，pwsh 以无参数启动（实测 pwsh 命令行完全为空） |
| `wt.exe` 宿主（`-w 0 pwsh -WorkingDirectory <路径>`） | 真实控制台句柄（ConPTY） | **是** | 从无控制台（DETACHED 模拟）父进程实测：`IsInputRedirected=False`，`-WorkingDirectory` 正确送达含空格/`&`/括号/单引号/中文路径，pwsh 存活且独立于父进程；**唯一限制：路径含 `;` 会被 wt 拆分**（`-WorkingDirectory` 与 `-d` 均无效），此类路径回退直连 |

补充事实：

- `windowsHide: false` 时 libuv 不设 `CREATE_NO_WINDOW`（`wShowWindow=SW_SHOWDEFAULT`），新控制台窗口由操作系统创建——但标准句柄问题仍然存在。
- `detached: true` 在 Windows 映射为 `DETACHED_PROCESS`，会移除控制台，不可用于正式会话。
- 本会话中 `Get-Process MainWindowHandle` 对新控制台窗口始终返回 0（对照实验：`CREATE_NEW_CONSOLE` 启动 pwsh 成功创建新 conhost/OpenConsole 且子进程正常执行），因此本环境的窗口可见性无法通过该 API 确认，需真实桌面人工确认。

### 结论与当前代码状态

- **当前实现（2026-08-08，用户授权变更后）**：正式会话默认通过 `spawn('wt.exe', ['-w','0', verifiedPwsh, '-WorkingDirectory', vaultPath], { cwd: vaultPath, stdio: 'ignore', windowsHide: false, detached: false, shell: false })` 启动——Windows Terminal 只作为控制台窗口宿主，让 pwsh 获得真实控制台句柄（实测 `IsInputRedirected=False`，完全可交互）。`wt.exe` 缺失（ENOENT）或 vault 路径含 `;` 时回退直连 `spawn(pwsh, …, stdio:'inherit')`。
- **变更原因**：v0.1 直连方案在 Explorer 启动的 Obsidian（无控制台 GUI 父进程）下被用户实测确认闪退；根因是 libuv 恒设 `STARTF_USESTDHANDLES` 并显式传无效句柄，Node `spawn` 不存在“让 OS 自动附加新控制台句柄”的模式。
- **授权范围**：用户 2026-08-08 明确接受“放宽约束换取可靠新窗口”的建议；变更仅限于把 `wt.exe` 作为窗口宿主（不代理/监听/记录 I/O，vault 路径仍为独立 `-WorkingDirectory` 参数）。`cmd.exe`、`powershell.exe`、`conhost.exe`、`start`、`shell:true` 等仍被禁止。
- 若未来约束再次收紧，可在不改变插件其余设计的前提下替换 `launcher.ts`。

## 记录格式

完成某项后，把状态改为 `通过` 并注明日期与机器信息；新增发现追加到“平台行为发现”。所有条目完成前，项目状态保持：

`Implementation completed; manual Windows verification pending`
