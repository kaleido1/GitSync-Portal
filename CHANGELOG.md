# Changelog

All notable changes to Obsidian Viewer are documented in this file.

## [0.3.0] - 2026-08-09

### Added

- Private GitHub Vault synchronization with encrypted token storage.
- Commit SHA checks and incremental file synchronization.
- Startup/foreground automatic sync, Wi-Fi-only mode, progress, retry, and last-sync status.
- Custom home note, favorites, reading history, in-page search, and reader menu.
- Adjustable reader theme, font size, line height, margins, and Obsidian CSS snippets.
- Offline Mermaid, KaTeX, and Highlight.js rendering.
- Quizzable interactive quizzes with local progress and seven question types.
- Safe Dataview query subset for `LIST`, `TABLE`, `TASK`, `FROM`, `WHERE`, and `SORT`.
- Page table of contents and current-section highlighting.
- Application icon and bilingual documentation.

### Improved

- Wiki links, heading anchors, percent-encoded links, images, embeds, and Callouts.
- Obsidian emphasis compatibility, including emphasis inside quiz YAML.
- Local and remote HTTPS image rendering.
- WebView security with local resource routing and a restrictive Content Security Policy.

### Security

- GitHub tokens are encrypted using Android Keystore and are never stored in the repository.
- Android application-data cloud backup is disabled.
- DataviewJS and arbitrary note-provided JavaScript are not executed.

## [0.2.0]

- Initial local Vault browser and Markdown reader.
