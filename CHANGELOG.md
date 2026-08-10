# Changelog

Obsidian Viewer 的重要变更记录在此文件中。

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
