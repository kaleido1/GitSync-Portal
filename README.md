# Obsidian Viewer

Obsidian Viewer 是一个可在 Android、iOS、Windows、macOS 和 Linux 上使用的原生 Obsidian 插件。它提供阅读工作台、全文搜索、收藏、阅读历史、阅读显示控制、互动测验，以及基于 GitHub API 的跨平台 Vault 双向同步。

当前版本：`1.2.3`

## 一键安装（全平台）

支持 Android、iOS、Windows、macOS 和 Linux：

1. [安装并启用 BRAT](https://obsidian.md/plugins?id=obsidian42-brat)（只需一次）。
2. [一键安装 Obsidian Viewer](obsidian://brat?plugin=kaleido1/Obsidian_Viewer)。

安装确认窗口打开后点击 **Add Plugin**。完整说明和通用 ZIP 备用下载见 [INSTALL.md](INSTALL.md)。

## 功能

- 首页、文件、收藏和阅读历史工作台
- 文件名与 Markdown 正文全文搜索
- 当前笔记目录与标题跳转
- 字号、行距、正文宽度、段落间距和专注阅读模式
- Quizzable 七种题型、评分、解析、重试和本地进度
- Android、iOS、Windows、macOS 和 Linux 双向 GitHub 同步
- 同步普通文件、`.obsidian/`、`.gitignore` 等 Vault 内隐藏文件
- 三方差异判断、删除同步、冲突副本、启动同步、保存后同步和定时同步
- GitHub token 通过 Obsidian `SecretStorage` 保存，不写入 Vault 或插件配置
- 直接使用 Obsidian 的 Markdown、Wiki Link、嵌入、Properties、Callout、Mermaid、KaTeX、代码高亮、CSS snippets 和 Dataview 能力

## 安装

### 手动安装

1. 下载 [最新版通用安装包](https://github.com/kaleido1/Obsidian_Viewer/releases/latest/download/obsidian-viewer.zip)，或自行构建 `manifest.json`、`main.js` 和 `styles.css`。
2. 将三个文件放入：

   ```text
   <Vault>/.obsidian/plugins/obsidian-viewer/
   ```

3. 重新加载 Obsidian。
4. 在“设置 → 第三方插件”中启用 **Obsidian Viewer**。

移动端和桌面端使用相同的插件目录结构。

## GitHub 同步

1. 在 GitHub 创建只授权目标 Vault 仓库的 fine-grained personal access token。
2. 将 Repository permissions 中的 `Contents` 设置为 `Read and write`。
3. 在“Obsidian → 设置 → Obsidian Viewer”中填写 token、`owner/repository` 和分支。
4. 先点击“测试连接”，再执行第一次“立即双向同步”。
5. 验证无误后，再按需开启启动、保存后或定时同步。

同步器只会永久忽略 Vault 内的 `.git/` 数据库和 `.trash/` 回收站。本插件自己的 `data.json` 默认忽略，避免本机阅读历史、同步基线和设备设置互相覆盖。Token 位于 Obsidian SecretStorage，不属于 Vault 文件。

如果 Vault 同时安装了 Obsidian Git，请只启用一个插件的自动同步功能，避免两个同步器同时更新同一分支。

## 开发与构建

需要 Node.js 18 或更高版本：

```bash
npm install
npm test
```

`npm test` 会执行 TypeScript 检查、生成生产版 `main.js`，并运行 GitHub 同步核心测试。

开发模式：

```bash
npm run dev
```

详细的同步行为和 Quizzable 格式见 [OBSIDIAN_PLUGIN.md](OBSIDIAN_PLUGIN.md)。

## 项目结构

```text
main.ts                 插件入口、设置与生命周期
src/viewer-view.ts      阅读工作台界面
src/settings.ts         插件设置界面
src/github-sync.ts      跨平台 GitHub 双向同步
src/quiz.ts             Quizzable 解析与交互
styles.css              桌面端和移动端样式
scripts/test-sync.mjs   同步核心测试
```

## 隐私与安全

- 笔记阅读、搜索和测验在本地完成。
- GitHub 同步仅在用户配置并触发后访问 GitHub API。
- Token 不会写入 `data.json`、日志或同步仓库。
- 同步前会检查文件大小和远端分支，冲突时保留带设备名与时间的副本。

## License

目前尚未选择开源许可证。在添加许可证前，保留所有权利。
