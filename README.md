# Obsidian Viewer

Obsidian Viewer 是一个可在 Android、iOS、Windows、macOS 和 Linux 上使用的原生 Obsidian 插件。它提供阅读工作台、全文搜索、收藏、阅读历史、阅读显示控制、互动测验，以及基于 GitHub API 的跨平台 Vault 双向同步。

当前版本：`1.2.8`

## 项目维护

本仓库由 [kaleido1](https://github.com/kaleido1) 独立维护，产品路线聚焦于跨平台原生 Obsidian 插件，不再跟随上游 Android 应用的开发方向。

项目最初基于 `MorganTian886/Obsidian_Viewer`，现有 Git 历史会继续保留早期作者与贡献记录；自分叉后的重构、跨平台插件和后续版本由本仓库独立演进。

## 下载 ZIP 安装（全平台）

同一个安装包支持 Android、iOS、Windows、macOS 和 Linux：

[下载 obsidian-viewer-1.2.8.zip](https://github.com/kaleido1/Obsidian_Viewer/releases/download/1.2.8/obsidian-viewer-1.2.8.zip)

将 ZIP 解压到 `<Vault>/.obsidian/plugins/`。安装后应得到 `<Vault>/.obsidian/plugins/obsidian-viewer/`，其中直接包含 `main.js`、`manifest.json` 和 `styles.css`。重新加载 Obsidian，再到“设置 → 第三方插件”启用插件。各平台的具体位置和更新方法见 [INSTALL.md](INSTALL.md)。

## 功能

- 首页、文件、收藏和阅读历史工作台
- 文件页按当前目录按文件名浏览文件与文件夹，支持进入文件夹、上一级、后退和前进
- 文件名与 Markdown 正文全文搜索，支持中文输入法组字和连续键入，搜索条保持圆角外框聚焦样式
- 笔记和文件夹均可收藏，收藏页可直接打开笔记或进入文件夹
- 当前笔记目录与标题跳转
- 字号、行距、正文宽度、段落间距和专注阅读模式
- Quizzable 七种题型、评分、解析、重试和本地进度
- Android、iOS、Windows、macOS 和 Linux 双向 GitHub 同步
- 自动识别当前平台并标记同步提交，也可为同平台多台设备设置自定义名称
- 同步普通文件、`.obsidian/`、`.gitignore`、插件本体、插件启用列表和所有插件设置
- 收藏和阅读历史通过共享状态文件跨平台同步，同步完成后立即刷新工作台界面
- 自动排除工作区布局、Viewer 本机同步状态、conflict 副本和其他临时/高频运行文件
- 三方差异判断、删除同步、冲突副本、远端变化自动重试、启动同步、保存后同步和定时同步
- GitHub token 通过 Obsidian `SecretStorage` 保存，不写入 Vault 或插件配置
- 直接使用 Obsidian 的 Markdown、Wiki Link、嵌入、Properties、Callout、Mermaid、KaTeX、代码高亮、CSS snippets 和 Dataview 能力

## 安装

### 手动安装

1. 下载 [obsidian-viewer-1.2.8.zip](https://github.com/kaleido1/Obsidian_Viewer/releases/download/1.2.8/obsidian-viewer-1.2.8.zip)，或自行构建 `manifest.json`、`main.js` 和 `styles.css`。
2. 将 `obsidian-viewer` 文件夹放入：

   ```text
   <Vault>/.obsidian/plugins/
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

同步器会同步 Vault 内的笔记、主题、CSS、社区插件、核心插件启用列表、插件程序文件和插件 `data.json` 设置文件。Viewer 的收藏和历史保存在 `.obsidian/plugins/obsidian-viewer/sync-state.json`，会随同步传递到其他设备；Viewer 的本机同步基线保存在 `local-sync-state.json`，默认不参与同步。

它只会永久忽略 Vault 内的 `.git/` 数据库和 `.trash/` 回收站；默认额外忽略工作区布局、Viewer 本机同步状态、Viewer conflict 副本和 Obsidian Git 临时脚本。Token 位于 Obsidian SecretStorage，不属于 Vault 文件。

同一路径两端都变化时，Viewer 会比较本地修改时间与远端该路径最近 commit 时间，较新的版本作为主文件，较旧版本保存为 `.conflict-…` 副本。若同步提交期间远端分支刚好变化，Viewer 会重新读取最新远端并重试提交。

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
- Viewer 自己生成的 conflict 副本默认不再参与后续同步扫描。

## License

目前尚未选择开源许可证。原始代码与后续贡献分别保留其作者的权利；在明确许可证发布前，不应将本仓库内容视为已获开源授权。
