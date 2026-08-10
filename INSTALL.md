# 一键安装 Obsidian Viewer

以下入口支持 Android、iOS、Windows、macOS 和 Linux。移动端与桌面端安装的是同一个插件版本。

## 推荐：BRAT 一键安装

第一次使用时，需要先安装一次官方社区插件 **Obsidian42 - BRAT**：

[安装并启用 BRAT](https://obsidian.md/plugins?id=obsidian42-brat)

BRAT 启用后，点击下面的按钮：

[一键安装 Obsidian Viewer](obsidian://brat?plugin=kaleido1/Obsidian_Viewer)

Obsidian 打开安装确认窗口后，点击 **Add Plugin**。安装完成后，在“设置 → 第三方插件”中启用 **Obsidian Viewer**。

### 各平台

| 平台 | 打开方式 |
| --- | --- |
| Android | 在浏览器中打开本页，点击“一键安装 Obsidian Viewer” |
| iPhone / iPad | 在 Safari 中打开本页，点击安装按钮并允许打开 Obsidian |
| Windows | 安装并至少启动过一次 Obsidian，然后点击安装按钮 |
| macOS | 安装并至少启动过一次 Obsidian，然后点击安装按钮 |
| Linux | 确保系统已注册 `obsidian://` URI，然后点击安装按钮 |

## 下载通用安装包

如果 URI 没有唤起 Obsidian，可下载固定名称的通用安装包：

[下载最新版 obsidian-viewer.zip](https://github.com/kaleido1/Obsidian_Viewer/releases/latest/download/obsidian-viewer.zip)

解压后，将包含 `main.js`、`manifest.json`、`styles.css` 的文件夹放到：

```text
<Vault>/.obsidian/plugins/obsidian-viewer/
```

然后重新加载 Obsidian，并在“设置 → 第三方插件”中启用插件。

## 安装后配置同步

1. 在 GitHub 创建仅授权知识库仓库的 fine-grained personal access token。
2. 将 Repository permissions 中的 `Contents` 设置为 `Read and write`。
3. 打开“Obsidian → 设置 → Obsidian Viewer”。
4. 填写 token、`kaleido1/Class-Notes` 和 `main`。
5. 点击“测试连接”，然后执行第一次双向同步。

Token 保存在 Obsidian SecretStorage 中，不会写入 Vault 或 GitHub 仓库。
