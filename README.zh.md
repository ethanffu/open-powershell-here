# Native Terminal Here

[English](README.md)

在 Obsidian 中直接打开本机终端，免去每次手动 `cd` 切换目录的繁琐操作。

- ⚡ **一键在仓库根目录打开终端**：点击左侧侧边栏的终端图标即可。
- 📂 **在任意文件夹/笔记所在目录打开**：在左侧文件树中右键任意文件夹或笔记文件，点击 **`Open Terminal here`**。

---

> 💡 **Linux 用户特别提示：**  
> 作者日常在 **Arch Linux** 上主力使用 **[Ghostty](https://ghostty.org/)** 终端，并完成了深度实测，强烈推荐使用 **Ghostty**；插件同时也兼容 Konsole、Alacritty、Kitty、WezTerm 等常见终端。

---

## 💻 支持的系统与终端

| 操作系统 | 默认打开的终端 | 备注 |
| :--- | :--- | :--- |
| **Windows** | **PowerShell 7+** | 默认使用 Windows Terminal 窗口打开 |
| **Linux** | **Ghostty**（推荐）/ 其他终端 | 若安装了多个终端，可在设置中自由选择 |

---

## 🚀 使用方法

### 1. 从侧边栏打开（根目录）
点击 Obsidian 最左侧侧边栏（Ribbon）的 **终端图标**，直接在当前笔记库的根目录打开终端。

### 2. 从右键菜单打开（指定目录）
在左侧文件列表中：
- **右键文件夹**：点击 **`Open Terminal here`**，在被选中的文件夹中打开终端。
- **右键笔记文件**：点击 **`Open Terminal here`**，自动在**该文件所在的文件夹**中打开终端。

---

## ⚙️ 可选个性化设置（Style Settings）

如果你安装了 [Style Settings](https://obsidian.md/plugins?id=obsidian-style-settings) 插件，可以在其设置面板中进行个性化定制：

- **隐藏侧边栏图标**：不想看到左侧的终端图标时可一键隐藏（右键菜单功能不受影响）。
- **终端选择（Linux）**：当电脑中安装了多个终端软件时，自由指定优先打开哪一个（如 Ghostty、Konsole 等）。

---

## 📦 安装方式

### 方式一：应用内市场安装（推荐）
1. 打开 Obsidian **设置** → **第三方插件** → **浏览**。
2. 搜索 **Native Terminal Here** 并点击 **安装**，随后 **启用** 即可。

### 方式二：手动安装
1. 从 [Releases 页面](https://github.com/ethanffu/open-powershell-here/releases) 下载 `main.js`、`manifest.json` 与 `styles.css`。
2. 将这 3 个文件放入你的笔记库目录 `<vault>/.obsidian/plugins/open-powershell-here/` 中。
3. 重新加载 Obsidian 并启用插件。

---

## 📄 开源协议

MIT License，详见 [LICENSE](LICENSE)。
