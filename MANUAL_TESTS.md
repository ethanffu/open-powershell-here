# MANUAL_TESTS.md — 真实 Windows 人工验收清单

本文件记录需要在真实 Windows 桌面 + 真实 Obsidian 中人工执行的验收项，以及本机已完成的脚本化平台实验结论。

## 当前状态

```
Manual Windows verification: not performed
```

- 真实 Obsidian GUI（点击 Ribbon）验收：**未执行**（not performed）。本环境未安装可用于点击验收的 Obsidian GUI 会话，且不得擅自启动/修改用户环境。
- 脚本化 Windows 平台实验：**已执行**（2026-08-06，Windows 桌面会话 + pwsh 7.6.4 MSIX + Node 24.16.0），结论见下文“平台行为发现”。
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
| 1 | 窗口可见 | 点击 Ribbon 按钮 | 出现新的 PowerShell 窗口 | 未执行 |
| 2 | 可以输入命令 | 在新窗口中输入 `Get-Location` 回车 | 有输出 | 未执行 |
| 3 | 可以看到输出 | 同上 | 输出可见 | 未执行 |
| 4 | 初始目录正确 | 输入 `Get-Location` | 等于 vault 根目录 | 未执行 |
| 5 | PowerShell 版本 | 输入 `$PSVersionTable.PSVersion.Major` | ≥ 7 | 未执行 |
| 6 | Profile 正常加载 | 观察窗口标题/提示符或输入 `$PROFILE` 相关命令 | 用户 Profile 生效 | 未执行 |
| 7 | 关闭 Obsidian 后会话继续 | 打开窗口后关闭 Obsidian | pwsh 进程仍在运行 | 未执行 |
| 8 | 未调用其他 Shell/终端 | 打开任务管理器或 `Get-Process` | 无 cmd/wt/conhost 由插件启动 | 未执行 |
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

## 平台行为发现（脚本化实验，2026-08-06）

实验方法：用 `CreateProcess` 以 `DETACHED_PROCESS`（无控制台、无标准句柄）启动 Node，模拟从资源管理器启动的 Obsidian（GUI、无控制台）；再让该 Node 用 `child_process.spawn('pwsh.exe', …)` 直接创建 pwsh，观察其行为。同时阅读了 Node 24 捆绑 libuv 的 `src/win/process-stdio.c` / `src/win/process.c` 源码交叉验证。

| stdio 配置 | pwsh 标准句柄 | 交互能力 | 表现 |
| --- | --- | --- | --- |
| `'ignore'` | NUL（libuv 打开 NUL 并置 `STARTF_USESTDHANDLES`） | 否 | `IsInputRedirected=True`；交互式 pwsh（无 `-Command`）**立即退出**（exit 0），窗口一闪而过 |
| `'inherit'` | INVALID_HANDLE_VALUE（libuv：无效 fd ≤ 2 时传 INVALID；`STARTF_USESTDHANDLES` 恒置位） | 否（无控制台父进程时） | `IsInputRedirected=True`；交互式 pwsh **立即退出**（exit 0） |
| `'pipe'` / `stdio: []` | 管道（Node 对缺失项补默认 pipe） | 否 | pwsh 挂起等待管道输入，不可交互；Obsidian 退出后管道 EOF 会终止 pwsh |
| `'inherit'`（父进程有控制台时） | 真实控制台句柄 | **是** | pwsh 附加到父进程控制台，`IsInputRedirected=False`，完全可交互（但不产生新窗口） |

补充事实：

- `windowsHide: false` 时 libuv 不设 `CREATE_NO_WINDOW`（`wShowWindow=SW_SHOWDEFAULT`），新控制台窗口由操作系统创建——但标准句柄问题仍然存在。
- `detached: true` 在 Windows 映射为 `DETACHED_PROCESS`，会移除控制台，不可用于正式会话。
- 本会话中 `Get-Process MainWindowHandle` 对新控制台窗口始终返回 0（对照实验：`CREATE_NEW_CONSOLE` 启动 pwsh 成功创建新 conhost/OpenConsole 且子进程正常执行），因此本环境的窗口可见性无法通过该 API 确认，需真实桌面人工确认。

### 结论与当前代码状态

- **当前实现**：正式会话使用 `spawn(verifiedPwsh, ['-WorkingDirectory', vaultPath], { cwd: vaultPath, stdio: 'inherit', windowsHide: false, detached: false, shell: false })`。这是不违反“只直接创建 `pwsh.exe`”约束下的最优选择：
  - Obsidian 从终端启动（开发场景）：pwsh 附加到同一控制台，**完全可交互**（已实测）。
  - Obsidian 从资源管理器启动（常规场景）：pwsh 标准句柄不可用，**会立即退出**；这是直接进程创建 + GUI 父进程的平台行为限制。
- **失败原因**：Node.js/libuv 的 `spawn` 总是显式传递标准句柄（管道/NUL/INVALID），不存在“让操作系统自动附加新控制台句柄”的模式；而 `powershell.exe`、`wt.exe`、`conhost.exe`、`start`、`shell: true` 等被项目硬性禁止。
- **约束与平台行为之间的冲突**：规范要求“新的、可见的、可交互的 PowerShell 窗口”，而仅直接创建 `pwsh.exe`（无控制台 GUI 父进程 + Node spawn）无法让 pwsh 获得可交互的标准句柄。插件没有用任何被禁止的程序绕过，如实报告。
- 若未来放宽约束（例如允许显式 `CREATE_NEW_CONSOLE` 或 ShellExecute 语义），可在不改变插件其余设计的前提下替换 `launcher.ts`。

## 记录格式

完成某项后，把状态改为 `通过` 并注明日期与机器信息；新增发现追加到“平台行为发现”。所有条目完成前，项目状态保持：

`Implementation completed; manual Windows verification pending`
