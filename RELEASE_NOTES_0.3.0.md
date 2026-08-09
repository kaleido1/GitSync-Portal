# Obsidian Viewer v0.3.0

This release turns the initial local Markdown viewer into a practical, offline-first Obsidian companion for Android.

## Highlights

- Browse and search a Vault selected through Android's secure folder picker.
- Synchronize a private GitHub Vault automatically and incrementally.
- Read Wiki links, images, embeds, Frontmatter, Callouts, tables, tasks, Mermaid, math, and highlighted code.
- Use favorites, reading history, a custom home note, page TOC, and in-page search.
- Run compatible Quizzable quizzes and common Dataview queries without enabling arbitrary note scripts.

## Installation

Download `Obsidian-Viewer-v0.3.0.apk` from the assets below and install it on Android 8.0 or newer.

SHA-256: `D5918A4617DBC2A21F5051D2696E145A08EC39ACB96FABACDB7DB9A884231AAF`

If a debug build is already installed, Android may require it to be uninstalled first because the official release uses a different signing key. The selected Vault and app-local settings should be noted before uninstalling; uninstalling removes app-local settings and the stored GitHub token, but it does not delete the Vault folder.

## Security Notes

- The app only reads the Vault folder explicitly selected by the user.
- The GitHub token is encrypted by Android Keystore.
- GitHub synchronization is download-only.
- DataviewJS and arbitrary JavaScript in notes are not executed.

## Known Limitations

- This release is primarily a read-only viewer; it does not edit Markdown notes.
- Dataview support is intentionally limited to a safe query subset.
- Remote files removed from GitHub are not automatically deleted from the phone during incremental sync.
- Automated compatibility-test coverage is not yet included.
