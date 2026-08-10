# Changelog

Obsidian Viewer 的重要变更记录在此文件中。

## [1.2.6] - 2026-08-11

### Fixed

- 设备名称默认按当前运行平台自动识别，不再把从其他设备遗留的 `macOS` 名称继续用于 Android、iOS 或 Windows 的同步提交。
- 增加“自动识别设备”开关；需要区分同系统多台设备时仍可关闭开关并填写自定义名称。

## [1.2.5] - 2026-08-11

### Fixed

- 排除 `workspace.json`、`workspace-mobile.json` 及其冲突副本，避免标签页、最近文件和侧栏状态在不同平台间反复同步。
- 将社区插件与核心插件启用列表按设备保留，避免移动端禁用桌面插件后影响其他设备。
- 排除 Viewer 自身数据和 Obsidian Git 运行文件，避免同步结果再次触发同步。
- Viewer 仍会在本机启用列表中保护自身，但不再把设备特定启用列表上传远端。
- 自动迁移旧版默认忽略配置，同时保留用户自定义忽略规则。

## [1.2.4] - 2026-08-11

### Changed

- 移除 BRAT 安装流程，以直接下载 ZIP 作为唯一推荐方式。
- ZIP 现在包含顶层 `obsidian-viewer` 文件夹，可直接解压到 Vault 的 `.obsidian/plugins/`。
- 增加 Windows、macOS、Android、iOS 和 Linux 的逐平台安装说明。
- 安装包不包含 `data.json`，更新插件时保留用户设置与本地进度。

## [1.2.3] - 2026-08-11

### Added

- Android、iOS、Windows、macOS 和 Linux 共用的 BRAT 一键安装链接。
- 自动构建、测试并发布 GitHub Release 的工作流。
- 固定名称的 `obsidian-viewer.zip` 通用安装包。
- 独立安装指南和各平台 URI 唤起说明。

## [1.2.2] - 2026-08-10

### Added

- Android、iOS、Windows、macOS 和 Linux 共用的 GitHub REST API 双向同步。
- Fine-grained personal access token 与 Obsidian SecretStorage 集成。
- Vault 隐藏文件同步，包括 `.obsidian/` 和 `.gitignore`。
- 基于共同 commit 的三方差异判断、删除同步和冲突副本。
- 启动时、保存后和定时同步选项。
- 阅读工作台、全文搜索、收藏、阅读历史和当前笔记目录。
- Quizzable 七种题型与持久化答题进度。

### Improved

- 修复移动端操作按钮中图标越界的问题。
- 增加文件卡片高度与内部留白，改善移动端布局。
- 防止同步过程覆盖或禁用 Obsidian Viewer 自身。
- 将默认同步仓库设置为 `kaleido1/Class-Notes`。

### Security

- GitHub token 不写入 Vault、插件 `data.json` 或仓库。
- `.git/` 和 `.trash/` 始终排除在同步范围之外。
- 单文件大小超过配置上限时中止并显示错误，不静默跳过。

## [1.0.0]

- 首个原生 Obsidian 插件版本。
