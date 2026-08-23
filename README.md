# Open Terminal Here

[简体中文](README.zh.md)

Open your computer's native terminal directly from Obsidian without typing `cd <folder>` every time.

- ⚡ **Open at Vault Root**: Click the terminal icon in the left ribbon bar.
- 📂 **Open at Any Folder or File**: Right-click any folder or note in the file explorer and click **Open Terminal here**.

---

> 💡 **Notice for Linux Users:**  
> The author actively uses and thoroughly tests the plugin with **[Ghostty](https://ghostty.org/) on Arch Linux**, and strongly recommends **Ghostty**. Other common Linux terminals (Konsole, Alacritty, Kitty, WezTerm, GNOME Terminal, etc.) are also supported.

---

## 💻 Supported Platforms & Terminals

| Operating System | Default Terminal | Notes |
| :--- | :--- | :--- |
| **Windows** | **PowerShell 7+** | Hosted in modern Windows Terminal |
| **Linux** | **Ghostty** (Recommended) / Others | Choose your preferred terminal in settings |

---

## 🚀 How to Use

### 1. Open at Vault Root (Ribbon Bar)
Click the **terminal icon** in Obsidian's left ribbon bar to open your terminal at the vault root directory.

### 2. Open at a Specific Folder (File Explorer)
In the left file tree:
- **Right-click any folder**: Click **`Open Terminal here`** to open the terminal in that folder.
- **Right-click any note/file**: Click **`Open Terminal here`** to open the terminal in the directory where that file is located.

---

## ⚙️ Optional Customization (Style Settings)

If you use the [Style Settings](https://obsidian.md/plugins?id=obsidian-style-settings) plugin, you can easily customize:

- **Hide Ribbon Button**: Hide the left ribbon icon if you only want the right-click menu.
- **Ribbon Icon Color**: Pick a custom accent color for the ribbon terminal icon.
- **Terminal Selection (Linux)**: Select your preferred terminal (Ghostty, Konsole, etc.) when multiple terminals are installed.

---

## 📦 Installation

### Option 1: Community Plugins (Recommended)
1. Open Obsidian **Settings** → **Community plugins** → **Browse**.
2. Search for **Open Terminal Here** and click **Install**, then **Enable**.

### Option 2: Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the [Releases page](https://github.com/ethanffu/open-powershell-here/releases).
2. Place the 3 files into `<vault>/.obsidian/plugins/open-powershell-here/`.
3. Reload Obsidian and enable the plugin.

---

## 📄 License

MIT License, see [LICENSE](LICENSE).
