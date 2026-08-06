# Vault PowerShell

[简体中文](README.md)

Click a single button in the Obsidian left ribbon to open your local **PowerShell 7 or later** with the current vault root as the initial working directory.

> ⚠️ **Repository visibility: Private**. The GitHub repository is private; install primarily by manually copying the build artifacts (`main.js` + `manifest.json`), as described below.

## Introduction

Vault PowerShell is a lightweight Obsidian desktop plugin with exactly one entry point: a ribbon button. No embedded terminal, no command palette commands, no settings page, no automatic script execution. It finds the locally installed `pwsh.exe` (PowerShell 7+), verifies its version, launches it directly, and sets the current vault root as the working directory.

## Features

- Obsidian left ribbon button (Lucide `terminal` icon, tooltip: `Open PowerShell at vault root`).
- Starts only the version-verified `pwsh.exe`; the real session is hosted in Windows Terminal (`wt.exe`) by default (hosting only, user-authorized). It never invokes `powershell.exe`, `cmd.exe`, `conhost.exe`, Windows `start`, WSL, Git Bash, or any other shell or terminal program, and never uses `shell: true`.
- PowerShell lookup order:
  1. `pwsh.exe` (resolved by Windows against the PATH inherited by the Obsidian process)
  2. `%ProgramFiles%\PowerShell\7\pwsh.exe`
  3. `%USERPROFILE%\.dotnet\tools\pwsh.exe`
- Each candidate is probed with a hidden version check (`-NoLogo -NoProfile -NonInteractive -Command $PSVersionTable.PSVersion.Major`, windowless, 5 s timeout, exit code 0 only, output must parse to an integer >= 7). PowerShell 6 is rejected.
- After verification, the same `pwsh.exe` is started for the real session via Windows Terminal (`wt.exe`, used only as the console window host) without `-NoProfile` / `-NonInteractive` / `-Command`; the user profile loads normally and nothing is auto-executed. If `wt.exe` is missing, or the vault path contains `;`, the plugin falls back to a direct `pwsh.exe` spawn.
  > Background: when Obsidian is launched from Explorer (a GUI process without a console), a direct spawn cannot give pwsh interactive console handles and pwsh exits immediately (confirmed in real use on v0.1). Hosting the session in Windows Terminal gives pwsh real console handles and full interactivity (verified experimentally; see MANUAL_TESTS.md). This change was explicitly authorized by the user and is limited to hosting: the plugin does not proxy, listen to or record any input/output.
- The vault path is passed as its own `-WorkingDirectory` argument, and the child `cwd` is set to the vault root as a second guarantee; the path is never embedded in a command string. Spaces, Chinese characters, `&`, parentheses, single quotes and other special characters are safe.
- The verified `pwsh.exe` path and major version are cached in memory only (re-verified after restarting Obsidian); a launch-time `ENOENT` clears the cache and retries once.
- A single-flight "resolving" lock prevents parallel probe chains on double clicks; once cached, every click opens a new session with no cooldown.

## System Requirements

- **Windows desktop Obsidian only** (`isDesktopOnly: true`). On other platforms the ribbon button still shows; clicking it shows `Vault PowerShell only supports Obsidian Desktop on Windows.`
- **PowerShell 7 or later (`pwsh`) only**. Windows PowerShell 5.1 is not supported, and the plugin never downloads or installs PowerShell.
- PowerShell 7+ must already be installed locally (Microsoft Store, MSI, or `dotnet tool install` — any install that leaves a findable `pwsh.exe`).

## Usage

1. Install the plugin (see below).
2. Restart Obsidian or reload the plugin.
3. Click the terminal icon in the left ribbon.
4. The plugin finds and verifies `pwsh.exe`, then opens a PowerShell session rooted at the vault.

On failure, a short, actionable English notice is shown and details go to the Obsidian developer console (`Ctrl+Shift+I`). On success, no notice is shown.

## Manual Installation

The private repository is not published to the Obsidian community marketplace; install manually:

1. Run `npm run build` in the project root (or use the committed `main.js`).
2. Open your vault folder and go to `.obsidian/plugins/` (create it if missing).
3. Create a folder named `vault-powershell/` and copy `main.js` and `manifest.json` into it (also `styles.css` if present).
4. In Obsidian settings → Community plugins, enable **Vault PowerShell**.

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
5. The verified path and major version are cached; the real session uses that exact `pwsh.exe`.

## Privacy & Security

- The plugin **never goes online**, **collects no telemetry**, and **uploads no data**.
- The plugin **does not read note content**, **does not modify vault files**, and creates **no log files**.
- The vault path is used only as a standalone process argument (`-WorkingDirectory`) and as the child `cwd`; it is never written anywhere.
- The plugin **does not listen to, proxy, or record** the PowerShell session's input or output.
- The plugin **never auto-executes PowerShell commands or scripts** (no `-Command` in the real session).
- The plugin **never downloads, installs, or updates** PowerShell.
- It never executes code derived from vault file names or paths.

## Known Limitations

- The plugin has only a ribbon button: no palette commands, hotkeys, settings page, context menu, or embedded terminal.
- Windows only; PowerShell 7+ only; 5.1 is not supported.
- The real session is hosted in Windows Terminal (`wt.exe`) by default (user-authorized constraint change; the v0.1 direct-spawn build was verified to flash-close in real use). If `wt.exe` is missing, the plugin falls back to a direct `pwsh.exe` spawn (usable when Obsidian was started from a terminal). The plugin never invokes `cmd.exe`, `powershell.exe`, `conhost.exe`, Windows `start`, or `shell: true`.
- **Vault paths containing `;` are not supported** (Windows Terminal treats `;` as a command separator — verified); such paths fall back to the direct spawn. All other special characters (spaces, `&`, parentheses, single quotes, CJK) are verified safe.
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

- Automated tests cover: candidate generation and deduplication; version probing (`7`/`8`/`7\r\n`/`6`/`abc`/empty/timeout/non-zero exit/missing file); launch arguments (verified `pwsh.exe` only, `-WorkingDirectory` as a standalone argument, `cwd`, no shell, no `-NoProfile`/`-NonInteractive`/`-Command`); end-to-end flow (candidate fallback, PowerShell 6 rejection, one-shot cache invalidation retry, single-flight lock, multiple windows after caching, non-Windows notice, adapter runtime check).
- Automated tests mock the process layer and **never actually pop up PowerShell windows**.
- The real-Windows manual acceptance checklist lives in `MANUAL_TESTS.md`. Automated tests are not a substitute for real window interaction verification.

## Current Project Status

`MVP completed and manually verified (core items); extended checklist pending`

- Code, build and automated tests are complete; Windows process-creation behavior was verified with scripted experiments (MANUAL_TESTS.md "Platform behavior findings").
- Verified in real Obsidian: the v0.1 direct-spawn build flash-closed; the Windows Terminal-hosted build **opens a working interactive PowerShell window** (2026-08-08). Extended checklist items (special-character paths, profile loading, session survival after closing Obsidian, etc.) are still pending — see MANUAL_TESTS.md.

## License

MIT License, see [LICENSE](LICENSE).
