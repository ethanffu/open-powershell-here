# Vault PowerShell

[简体中文](README.md)

Open your local **PowerShell 7 or later** from Obsidian: click the left ribbon button to open it at the vault root, or right-click a single folder in the file explorer and choose **Open PowerShell here** to open it in that folder.

> ⚠️ **Repository visibility: Private**. The GitHub repository is private; install primarily by manually copying the build artifacts (`main.js` + `manifest.json`), as described below.

## Introduction

Vault PowerShell is a lightweight Obsidian desktop plugin with two entry points: a ribbon button (opens at the vault root) and a single-folder context-menu item (opens in the right-clicked folder). No embedded terminal, no command palette commands, no hotkeys, no settings page, no batch context menu, no automatic script execution. It finds the locally installed `pwsh.exe` (PowerShell 7+), verifies its version, launches it directly, and sets the target directory (vault root or right-clicked folder) as the working directory.

## Features

- **Ribbon button** (Lucide `terminal` icon, tooltip: `Open PowerShell at vault root`): opens PowerShell at the current vault root.
- **Optional Style Settings integration**: with the [Style Settings](https://github.com/mgmeyers/obsidian-style-settings) plugin installed, go to Settings → Style Settings → Vault PowerShell and enable **Hide the ribbon button** to hide the left ribbon button (hides the button only; the feature stays; the single-folder context-menu entry is unaffected).
- **Single-folder context menu**: right-click a **single folder** in the Obsidian file explorer and choose **`Open PowerShell here`** (Lucide `terminal` icon) to open PowerShell in that folder's real Windows absolute path. The vault root folder is supported too. The item does not appear for plain files or multi-selection.
- Starts only the version-verified `pwsh.exe`; the real session is hosted in Windows Terminal (`wt.exe`) by default (hosting only, user-authorized). It never invokes `powershell.exe`, `cmd.exe`, `conhost.exe`, Windows `start`, WSL, Git Bash, or any other shell or terminal program, and never uses `shell: true`.
- PowerShell lookup order:
  1. `pwsh.exe` (resolved by Windows against the PATH inherited by the Obsidian process)
  2. `%ProgramFiles%\PowerShell\7\pwsh.exe`
  3. `%USERPROFILE%\.dotnet\tools\pwsh.exe`
- Each candidate is probed with a hidden version check (`-NoLogo -NoProfile -NonInteractive -Command $PSVersionTable.PSVersion.Major`, windowless, 5 s timeout, exit code 0 only, output must parse to an integer >= 7). PowerShell 6 is rejected.
- After verification, the same `pwsh.exe` is started for the real session via Windows Terminal (`wt.exe`, used only as the console window host) without `-NoProfile` / `-NonInteractive` / `-Command`; the user profile loads normally and nothing is auto-executed. If `wt.exe` is missing, the plugin falls back to a direct `pwsh.exe` spawn.
  > Background: when Obsidian is launched from Explorer (a GUI process without a console), a direct spawn cannot give pwsh interactive console handles and pwsh exits immediately (confirmed in real use on v0.1). Hosting the session in Windows Terminal gives pwsh real console handles and full interactivity (verified experimentally; see MANUAL_TESTS.md). This change was explicitly authorized by the user and is limited to hosting: the plugin does not proxy, listen to or record any input/output.
- The target directory is passed as its own `-WorkingDirectory` argument, and the child `cwd` is set to that directory as a second guarantee; the path is never embedded in a command string. Spaces, Chinese characters, `&`, parentheses, single quotes and other special characters are safe.
- The verified `pwsh.exe` path and major version are cached in memory only (re-verified after restarting Obsidian; the ribbon and the context menu share the same cache); a launch-time `ENOENT` clears the cache and retries once.
- A single-flight "resolving" lock prevents parallel probe chains on double clicks or simultaneous triggers from both entries; once cached, every click on either entry opens a new session with no cooldown.

## System Requirements

- **Windows desktop Obsidian only** (`isDesktopOnly: true`). On other platforms the ribbon button still shows; clicking it shows `Vault PowerShell only supports Obsidian Desktop on Windows.` The folder context-menu item is not shown on non-Windows platforms.
- **PowerShell 7 or later (`pwsh`) only**. Windows PowerShell 5.1 is not supported, and the plugin never downloads or installs PowerShell.
- PowerShell 7+ must already be installed locally (Microsoft Store, MSI, or `dotnet tool install` — any install that leaves a findable `pwsh.exe`).
- The vault must be on a local file system (`FileSystemAdapter`); the folder context-menu item is not shown for remote/non-local vaults.
- Optional: hiding the ribbon button requires the third-party [Style Settings](https://github.com/mgmeyers/obsidian-style-settings) plugin.

## Usage

1. Install the plugin (see below).
2. Restart Obsidian or reload the plugin.
3. Option A: click the terminal icon in the left ribbon to open PowerShell at the vault root.
4. Option B: right-click a **single folder** in the left file explorer (the vault root folder works too) and click **Open PowerShell here** to open PowerShell in that folder.
5. Optional: to hide the ribbon button, install [Style Settings](https://github.com/mgmeyers/obsidian-style-settings) and enable **Hide the ribbon button** under its Vault PowerShell section.

On failure, a short, actionable English notice is shown and details go to the Obsidian developer console (`Ctrl+Shift+I`). On success, no notice is shown.

## Manual Installation

The private repository is not published to the Obsidian community marketplace; install via either option:

**Option A: Download the zip from GitHub Releases (recommended, no CLI needed)**

1. In a browser (GitHub login required), open the repository's Releases page: `https://github.com/ethanffu/vault-powershell/releases` (or go directly to the v0.3.0 assets page).
2. Download `vault-powershell-0.3.0.zip` and unzip it — you get a `vault-powershell/` folder.
3. Open your vault folder and go to `.obsidian/plugins/` (create it if missing).
4. Copy the whole unzipped `vault-powershell/` folder into it.
5. In Obsidian settings → Community plugins, enable **Vault PowerShell** (turn off Restricted Mode first if prompted).

> Because the repository is Private, downloading requires a GitHub login; the zip itself can be freely forwarded to whoever needs it (unzip and install — no GitHub account required).

**Option B: Build from source**

1. Run `npm run build` in the project root (or use the committed `main.js`).
2. Same as Option A steps 3–5: copy `main.js`, `manifest.json` and `styles.css` (the Style Settings toggle depends on it — **do not skip it**) into `.obsidian/plugins/vault-powershell/` and enable the plugin.

## Building from Source

```bash
npm ci          # reproducible install (lockfile)
npm run dev     # watch and rebuild
npm run build   # production main.js
npm run verify  # lint + typecheck + test + build
```

## PowerShell Lookup and Version Verification

1. Build the candidate list: `pwsh.exe` (PATH first) → `%ProgramFiles%\PowerShell\7\pwsh.exe` → `%USERPROFILE%\.dotnet\tools\pwsh.exe`; deduplicate case-insensitively; skip candidates whose environment variables are missing.
2. Probe candidates one by one with a hidden check (argument array, `shell: false`, `windowsHide: true`, 5 s timeout, exit code 0 only).
3. Output must trim to a plain integer with major version >= 7; PowerShell 6 and below are rejected; on failure the next candidate is tried.
4. If all candidates fail, a notice suggests installing PowerShell.
5. The verified path and major version are cached (shared by the ribbon and the context menu); the real session uses that exact `pwsh.exe`.

## Privacy & Security

- The plugin **never goes online**, **collects no telemetry**, and **uploads no data**.
- The plugin **does not read note content**, **does not modify vault files**, and creates **no log files**.
- Vault and folder paths are used only as standalone process arguments (`-WorkingDirectory`) and as the child `cwd`; they are never written anywhere.
- The plugin **does not listen to, proxy, or record** the PowerShell session's input or output.
- The plugin **never auto-executes PowerShell commands or scripts** (no `-Command` in the real session).
- The plugin **never downloads, installs, or updates** PowerShell.
- It never executes code derived from vault file names or paths.

## Known Limitations

- Entry points are limited to the ribbon and the single-folder context menu: no palette commands, hotkeys, settings page, batch (multi-select) context menu, file context menu, or embedded terminal.
- Windows only; PowerShell 7+ only; 5.1 is not supported; local file system vaults only.
- The real session is hosted in Windows Terminal (`wt.exe`) by default (user-authorized constraint change; the v0.1 direct-spawn build was verified to flash-close in real use). If `wt.exe` is missing, the plugin falls back to a direct `pwsh.exe` spawn (usable when Obsidian was started from a terminal). The plugin never invokes `cmd.exe`, `powershell.exe`, `conhost.exe`, Windows `start`, or `shell: true`.
- **Target paths containing `;` are not supported** (Windows Terminal treats `;` as a command separator — verified). For such paths (vault root or right-clicked folder) **no process is started at all**; the plugin shows the notice `PowerShell cannot be opened for paths containing a semicolon (;).` All other special characters (spaces, `&`, parentheses, single quotes, CJK) are verified safe.
- The repository is currently **Private** and not published to the Obsidian community marketplace; install by manually copying the build artifacts.

## Development Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Watch and rebuild |
| `npm run build` | Production `main.js` |
| `npm run lint` | ESLint over `src` and `tests` |
| `npm run typecheck` | TypeScript type checking |
| `npm test` | Automated tests (Vitest) |
| `npm run verify` | lint + typecheck + test + build |
| `npm run install:test` | Copy artifacts into the project-local `.test-vault` (gitignored) and register the plugin in the enabled-plugins list (`community-plugins.json`) so it loads automatically when the test vault is opened |

## Testing

- Automated tests cover: candidate generation and deduplication; version probing (`7`/`8`/`7\r\n`/`6`/`abc`/empty/timeout/non-zero exit/missing file); launch arguments (verified `pwsh.exe` only, `-WorkingDirectory` as a standalone argument, `cwd`, no shell, no `-NoProfile`/`-NonInteractive`/`-Command`, wt-missing direct fallback); end-to-end flow (candidate fallback, PowerShell 6 rejection, one-shot cache invalidation retry, single-flight lock, multiple windows after caching, non-Windows notice, adapter runtime check); and the folder context menu (exactly one `Open PowerShell here` item for a single folder, `terminal` icon, nested/root folder paths, no item for files or multi-select, hidden on non-Windows and non-local adapters, `registerEvent` lifecycle without duplicate handlers, the ribbon element carrying a stable CSS class (Style Settings hook), shared cache and single-flight between ribbon and menu, semicolon-path notice with zero process creation).
- Automated tests mock the process layer and **never actually pop up PowerShell windows**.
- The real-Windows manual acceptance checklist lives in `MANUAL_TESTS.md`. Automated tests are not a substitute for real window interaction verification.

## Current Project Status

`context-menu entry manually verified (core items); edge items pending`

- Code, build and automated tests are complete; Windows process-creation behavior was verified with scripted experiments (MANUAL_TESTS.md "Platform behavior findings").
- Verified in real Obsidian (2026-08-08): the Windows Terminal-hosted build's ribbon entry opens a working interactive PowerShell window; `Get-Location` equals the vault root, version >= 7, the session survives closing Obsidian, and the plugin auto-loads after restart.
- Verified in real Obsidian (2026-08-09): the folder context-menu entry works — right-clicking a single folder shows `Open PowerShell here` (terminal icon), and clicking it opens an interactive PowerShell in that folder's real absolute path (`Get-Location` correct).
- Edge items — semicolon-folder notice, vault root folder right-click, no item for files, no duplicates after plugin reload — have **not been individually verified on the real machine yet** (see MANUAL_TESTS.md #28–#33); remaining low-priority items (special-character paths on the real machine, wt-missing fallback, UNC, missing-install scenarios) are likewise unverified individually, several already covered by scripted experiments or automated tests.
- The plan to remove the ribbon entry was reversed (2026-08-10): the ribbon button stays, and the plugin ships a `styles.css` Style Settings block with a single **Hide the ribbon button** toggle. The first attempts (published as v0.3.0/v0.3.1 and both revoked) did not hide the button in the user's environment. **Actual root cause:** for `class-toggle`, Style Settings applies the **setting `id`** (not `addClass`, which is ignored) to `<body>`; the previous CSS selector never matched the body class. Fix: the setting id IS the class name; the CSS uses two selectors (custom class + tooltip `aria-label`) with `!important`; and `main.ts` additionally enforces the hide via inline style through a MutationObserver on the body class, so hiding does not depend on any CSS/DOM assumption. **Release is pending the user's real-machine confirmation (per user instruction: release only after approval; version 0.3.0).**

## License

MIT License, see [LICENSE](LICENSE).
