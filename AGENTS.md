# AGENTS.md — Vault PowerShell 项目约束

本文件永久记录本项目（Obsidian 插件 `vault-powershell`）的核心约束。任何 Agent 在继续本项目前必须完整阅读并遵守本文件；如与本文件冲突，以本文件为准；如与用户最新明确指示冲突，以用户指示为准并在提交前说明。

## 项目本质

- 轻量 Windows 桌面 Obsidian 插件：点击左侧 Ribbon 按钮，打开本机 PowerShell 7+（`pwsh.exe`），初始工作目录为当前 vault 根目录。
- 唯一入口是 Ribbon 按钮。禁止添加命令面板命令、快捷键、设置页、右键菜单、内嵌终端、自动执行脚本。
- 插件 ID：`vault-powershell`；主类：`VaultPowerShellPlugin`；当前版本 `0.1.0`；仓库 Private，默认分支 `main`。

## 硬性约束（不可违反）

1. **只直接创建经过版本验证的 `pwsh.exe`**（主版本 ≥ 7，通过隐藏探测验证）。
2. **禁止调用或间接调用**：`powershell.exe`、`cmd.exe`、`wt.exe`、`conhost.exe`、Windows `start`、WSL、Git Bash、其他 Shell/终端程序；禁止 `shell: true`；禁止命令字符串、批处理文件、Shell 包装器、终端启动器绕过。
3. **禁止回退到 Windows PowerShell 5.1**；禁止自动下载/安装/更新 PowerShell；不搜索整个磁盘，不遍历 WindowsApps。
4. 正式会话：不使用 `-NoProfile`/`-NonInteractive`/`-Command`；`-NoProfile` 与 `-Command` 只允许出现在隐藏版本探测中；不自动执行任何命令；正常加载用户 Profile。
5. **安全传递 vault 路径**：作为独立参数传给 `-WorkingDirectory`，并把 `cwd` 设为 vault 根目录；不得把路径拼进命令字符串；不得手动构造 `Set-Location`/`cd`/带引号脚本。
6. 使用 `FileSystemAdapter` + `instanceof` 运行时检查 + `getBasePath()` 获取 vault 根路径；不反推、不读笔记、不改 vault。
7. **不修改真实 vault**；测试只使用项目内 `.test-vault/`（gitignore）；`npm run install:test` 只复制 `main.js`/`manifest.json`/存在的 `styles.css`。
8. **不联网、不遥测、不上传**；不写日志文件；不监听/记录 PowerShell 会话；vault 路径只作为进程参数与 `cwd` 使用。
9. 内存缓存（路径 + 主版本）只存在于内存；正式启动 `ENOENT` 时清缓存并**最多重试一次**；查找期间用单飞锁避免并行探测；缓存后每次点击开新窗口、无冷却。
10. 若“只直接创建 `pwsh.exe`”在真实环境中无法实现可靠交互窗口，必须**如实报告**（实现、表现、原因、代码状态、约束冲突），不得用被禁止的程序悄悄绕过，不得把 mock 测试说成真实窗口验证。

## 平台行为发现（2026-08-06，Windows + pwsh 7.6.4 + Node 24 实测）

- 从无控制台的 GUI 父进程（如资源管理器启动的 Obsidian）用 Node `spawn` 直接创建 `pwsh.exe`：`stdio:'ignore'` → NUL 句柄（pwsh 立即退出）；`stdio:'inherit'` → INVALID_HANDLE_VALUE（libuv `process-stdio.c`：无效 fd ≤2 时传 INVALID_HANDLE_VALUE，且 `STARTF_USESTDHANDLES` 恒置位 → pwsh 立即退出）；管道 → pwsh 挂起且不可交互。
- 父进程有控制台（终端启动的 Obsidian）时，`stdio:'inherit'` → pwsh 附加到同一控制台，完全可交互（`IsInputRedirected=False` 已实测）。
- 因此正式会话采用 `stdio:'inherit'` + `windowsHide:false` + `detached:false`（`detached:true` 在 Windows 上是 DETACHED_PROCESS，会移除控制台）。此选择已实测验证，**不得改回 `stdio:'ignore'` 或改为管道**。
- 真实 Obsidian GUI 中点击 Ribbon 的人工验收尚未执行；`MANUAL_TESTS.md` 的未执行项保持“not performed”，不得伪造。

## 质量与流程

- 每次改动后、回复用户前必须依次完成：
  1. `npm run verify`（lint → typecheck → test → build）通过；
  2. 确认 `main.js` 已重新构建且与源码一致（CI 同样检查 `git diff --exit-code -- main.js`）；
  3. 检查并同步中英文 README（`README.md` 简体中文、`README.en.md` 英文）与 GitHub About/Topics（事实变化才改，不制造无意义差异）；
  4. 检查暂存区无敏感文件（`.env`、token、凭据、`.test-vault`、node_modules、日志）；
  5. `git add -A`；有变化才提交（Conventional Commits，如 `feat:`/`fix:`/`test:`/`docs:`/`chore:`）；无变化不得空提交；
  6. 推送 `origin/main`；确认远端 HEAD 与本地一致；`git status` 干净后才回复。
- **禁止**：`git push --force` / `--force-with-lease`、改写已推送历史、删除远端分支、改仓库为 Public、覆盖/删除已有远端、跳过 Git hooks、提交凭据。
- **推送方式（重要）**：当前 GitHub 账号的 OAuth token 缺少 `workflow` scope（`gh auth status` 确认），HTTPS 推送含 `.github/workflows/` 的提交会被拒绝。仓库已配置仓库级 SSH deploy key（`~/.ssh/vault_powershell_deploy`，仅限本仓库、可写）。推送命令：
  ```bash
  GIT_SSH_COMMAND="ssh -i ~/.ssh/vault_powershell_deploy -o StrictHostKeyChecking=accept-new" git push origin-ssh main
  ```
  `origin`（HTTPS）保留用于 `gh` 读取/API 操作；不要删除 deploy key。若日后 token 获得 `workflow` scope（`gh auth refresh -s workflow`），可回归普通 `git push origin main`。
- 构建或测试失败时不得创建声称“已完成”的提交；用户要求保存进度时可提交 WIP 并明确说明。
- 版本发布（tag/Release/版本号/versions.json 更新）只在用户明确要求时进行；普通提交不创建 tag、不创建 Release、不升版本号。
- 自动化验证、构建、真实 Windows GUI 验证、Git 提交、GitHub 推送、README/About 同步必须分开如实报告，不得笼统声称“全部完成”。

## 参考文件

- `MANUAL_TESTS.md`：真实 Windows 人工验收清单与平台行为发现。
- `README.md` / `README.en.md`：中英文用户文档（必须同步）。
- `.github/workflows/ci.yml`：Windows CI（lint/typecheck/test/build/`main.js` 同步检查）。
- `src/`：`main.ts`（生命周期与 Ribbon）、`vault-path.ts`、`powershell/{candidates,version-probe,launcher,finder,types}.ts`。
- `tests/`：Vitest 测试；`tests/mocks/obsidian.ts` 是 `obsidian` 包（仅类型）的测试替身（见 `vitest.config.ts` 别名）。
