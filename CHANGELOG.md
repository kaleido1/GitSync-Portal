# Changelog

## [2.0.1] - 2026-08-12

### Changed

- Renamed the plugin and repository from GitSync Port to GitSync Portal (`gitsync-portal`).
- Added migration from both earlier plugin IDs, including settings, shared state, local sync state, layouts, and SecretStorage tokens.
- Updated the release ZIP layout, documentation, and repository links for the final name.

## [2.0.0] - 2026-08-12

### Changed

- Renamed the plugin and repository to GitSync Port (`gitsync-port`).
- Rewrote the README and installation guide in English.
- Added safe migration from the legacy `obsidian-viewer` plugin data, shared state, local sync state, enabled-plugin entry, and SecretStorage token.

### Added

- Added a plugin language selector with system/Obsidian language detection and 22 selectable languages.
- Added complete English and Simplified Chinese translations, broad coverage for Traditional Chinese, Japanese, Korean, Spanish, German, and Italian, plus major-navigation translations with English fallback for additional Obsidian locales.
- Added active-file highlighting in dashboard lists.
- Preserved dashboard scroll position across refreshes so file selection and background updates no longer jump to the top.

Earlier entries retain their original release language and historical product name.

## [1.2.8] - 2026-08-12

### Fixed

- 搜索时只更新输入框下方的结果区域，不再销毁并重建输入框，连续键入时不会失去焦点或系统键入状态。
- 中文输入法组字期间暂停搜索刷新，候选字确认后再执行搜索，避免打断 IME composition。
- 搜索框不指定输入语言，继续使用操作系统当前选择的输入法。

## [1.2.7] - 2026-08-12

### Changed

- Viewer 同步默认覆盖插件本体、插件启用列表、核心插件列表和插件设置文件；仅保留工作区布局、Viewer 本机同步状态和 Obsidian Git 临时脚本为设备本地状态。
- 同步遇到远端分支刚刚变化时会自动重新拉取并重试；最后提交阶段会基于最新远端树重新提交无关路径变更，减少与其他设备/同步器同时推送时的失败。
- 同一路径内容冲突时按最近修改时间选择主文件，较旧版本保留为 conflict 副本。
- 文件浏览与搜索结果按文件名稳定排序，不再按最近修改时间打乱显示。
- 收藏/历史只保存在共享状态文件中，避免取消收藏时 `data.json` 和 `sync-state.json` 双重冲突；Viewer 自己生成的 conflict 副本不再参与后续扫描。
- 文件夹现在也可以收藏，收藏页可直接进入收藏的文件夹。
- 取消“非笔记本地变化按远端覆盖”的宽泛策略；插件设置文件按正常三方合并同步，只有工作区布局、Viewer 本机状态、conflict 副本和其他明确忽略的临时/高频文件不参与同步。
- 同步完成后会重新读取共享收藏/历史状态并等待 Viewer 面板重渲染，确保收藏页、历史页和首页列表立即反映远端变化。

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
