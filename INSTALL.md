# 安装 Obsidian Viewer

同一个 ZIP 安装包支持 Android、iOS、Windows、macOS 和 Linux。

## 下载

[下载最新版 obsidian-viewer.zip](https://github.com/kaleido1/Obsidian_Viewer/releases/latest/download/obsidian-viewer.zip)

ZIP 内已经包含完整的插件文件夹：

```text
obsidian-viewer/
├── main.js
├── manifest.json
└── styles.css
```

## 安装位置

将 ZIP 解压到当前 Vault 的插件目录：

```text
<Vault>/.obsidian/plugins/
```

安装完成后的准确路径必须是：

```text
<Vault>/.obsidian/plugins/obsidian-viewer/main.js
<Vault>/.obsidian/plugins/obsidian-viewer/manifest.json
<Vault>/.obsidian/plugins/obsidian-viewer/styles.css
```

不要形成 `obsidian-viewer/obsidian-viewer/` 两层同名文件夹。

解压后重新加载 Obsidian，然后进入“设置 → 第三方插件”并启用 **Obsidian Viewer**。

## 各平台

### Windows

1. 打开 Vault 文件夹。
2. 在资源管理器中开启“显示隐藏的项目”。
3. 进入 `.obsidian/plugins/`；如果 `plugins` 不存在则创建它。
4. 将 ZIP 解压到这里。
5. 重新启动或重新加载 Obsidian，再启用插件。

### macOS

1. 在 Finder 中打开 Vault。
2. 按 `Command + Shift + .` 显示隐藏文件。
3. 进入 `.obsidian/plugins/`，将 ZIP 解压到这里。
4. 重新启动或重新加载 Obsidian，再启用插件。

### Android

1. 在文件管理器中开启“显示隐藏文件”。
2. 找到 Obsidian Vault，进入 `.obsidian/plugins/`。
3. 将 ZIP 解压到这里。
4. 完全关闭并重新打开 Obsidian，再启用插件。

### iPhone / iPad

iOS 的文件 App 不便直接操作以 `.` 开头的隐藏目录。推荐在共享同一个 Vault 的 Mac 或 Windows 设备上完成解压，再通过 iCloud 或当前文件同步方案把 `.obsidian/plugins/obsidian-viewer/` 同步到 iPhone/iPad。

如果使用的 iOS 文件管理器能够显示 Vault 隐藏文件，也可以直接将 ZIP 解压到 `.obsidian/plugins/`。

### Linux

将 ZIP 解压到 Vault 的 `.obsidian/plugins/`：

```bash
unzip obsidian-viewer.zip -d "/path/to/Vault/.obsidian/plugins/"
```

## 更新插件

新版 ZIP 不包含 `data.json`。更新时只覆盖下面三个程序文件，不要删除已有的 `data.json`：

```text
main.js
manifest.json
styles.css
```

这样可以保留同步仓库、设备名称、收藏、阅读历史和测验进度。更新后重新加载 Obsidian。

## 配置 GitHub 同步

1. 在 GitHub 创建仅授权知识库仓库的 fine-grained personal access token。
2. 将 Repository permissions 中的 `Contents` 设置为 `Read and write`。
3. 打开“Obsidian → 设置 → Obsidian Viewer”。
4. 填写 token、`kaleido1/Class-Notes` 和 `main`。
5. 点击“测试连接”，然后执行第一次双向同步。

Token 保存在 Obsidian SecretStorage 中，不会写入 ZIP、Vault 或 GitHub 仓库。
