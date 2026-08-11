# Obsidian Viewer for Android

[中文](README.md) | [English](README_EN.md)

A read-only Obsidian Vault viewer for Android, built with Kotlin, Jetpack Compose, and Android's Storage Access Framework (SAF). It accesses only the Vault folder selected by the user and does not require broad storage permission.

> Current version: `0.3.0`. This project is still in early development and should not be treated as the only copy of a Vault.

[Download the latest Android APK](https://github.com/MorganTian886/Obsidian_Viewer/releases/latest)

## Features

- Connect a local Vault through Android's system folder picker
- Persist the user-granted Vault permission
- Browse folders and Markdown notes using their original structure
- Search file names and note contents
- Pull-to-refresh and manual refresh
- System, light, and dark themes
- Adjustable font size, line height, and page margins
- Automatic page table of contents with active-section highlighting
- In-page search with match count and previous/next navigation
- Favorite notes and persistent reading history
- Custom home note with file, favorites, history, and sync shortcuts
- Manual reader menu that does not interfere with scrolling
- Android back navigation and note navigation history

### GitHub Sync

- Read-only synchronization from a private GitHub repository
- Token encryption through Android Keystore
- Automatic sync whenever the app enters the foreground
- Optional Wi-Fi-only automatic sync
- Commit SHA checks that skip downloads when the repository has not changed
- Incremental synchronization of files changed between commits
- Full ZIP fallback when an incremental comparison is unavailable
- Safe mirror deletion: GitHub-removed tracked files move to `.sync-trash/<timestamp>/`, while local-only files are preserved
- Sync stage, changed-file count, last-sync time, errors, and retry controls

### Markdown and Obsidian Compatibility

- CommonMark and GFM tables, task lists, autolinks, and strikethrough
- Headings, emphasis, blockquotes, code blocks, and external links
- `[[Wiki Link]]`
- `[[Note|Alias]]`
- `[[Note#Heading]]`
- `![[image.png]]` and standard Markdown images
- Embedded notes through `![[Note]]`
- Local Vault images and remote HTTPS images
- YAML Frontmatter/Properties
- Structured Properties rows, tag pills, and clickable note and attachment links
- Obsidian Callouts, including custom types and `[!TYPE]+` / `[!TYPE]-`
- Mermaid 11.16.1 diagrams, bundled for offline use
- KaTeX 0.18.2 inline and display math, bundled for offline use
- Highlight.js 11.11.1 syntax highlighting, bundled for offline use
- `.obsidian/snippets/*.css` custom styles
- Safe Dataview subset: `LIST`, `TABLE`, `TASK`, `FROM`, `WHERE`, and `SORT`
- Dataview Frontmatter fields and `Field:: Value` inline fields
- Quizzable: seven question types, scoring, explanations, retry, and local progress

`dataviewjs` is intentionally not executed. Notes cannot run arbitrary JavaScript through the Dataview compatibility layer.

## Technology

- Kotlin
- Jetpack Compose and Material 3
- Android Storage Access Framework
- AndroidX DocumentFile
- CommonMark Java with GFM extensions
- Local WebView reading surface
- Gradle Kotlin DSL

Markdown and supported extensions are processed on the device. Vault images are streamed from user-authorized document URIs. Mermaid, KaTeX, Highlight.js, and js-yaml are packaged inside the APK rather than loaded from a CDN.

## Requirements

- Android Studio 2026.1 or compatible
- JDK 17 or newer; Android Studio's bundled JDK is recommended
- Android SDK 37
- Android SDK Build Tools 36.0.0
- Android 8.0 (API 26) or newer

Current project versions:

- Android Gradle Plugin 9.3.0
- Gradle 9.5.0
- Kotlin/Compose Compiler 2.3.21
- Compose BOM 2026.06.00

## Build

Clone the repository:

```bash
git clone https://github.com/MorganTian886/Obsidian_Viewer.git
cd Obsidian_Viewer
```

Windows:

```powershell
.\gradlew.bat assembleDebug
```

macOS/Linux:

```bash
./gradlew assembleDebug
```

The debug APK is generated at:

```text
app/build/outputs/apk/debug/app-debug.apk
```

With a USB-debugging-enabled device connected, you can also run:

```powershell
.\gradlew.bat installDebug
```

Alternatively, open the project in Android Studio, select a device, and click **Run**.

## Usage

1. Create or copy an Obsidian Vault on the phone, for example `Documents/Obsidian/MyVault`.
2. Open the app and tap **Select Vault**.
3. Navigate into the actual Vault folder and tap **Use this folder**.
4. Browse folders or search for a Markdown note.
5. Optionally configure private GitHub sync in **Settings**.

Android does not allow apps to select the root of shared storage. A specific subfolder must be selected.

## Project Structure

```text
app/src/main/java/com/morgan/obsidianviewer/
├── MainActivity.kt         # Compose UI, reader, navigation, settings, and state
├── MarkdownRenderer.kt     # Markdown/Obsidian preprocessing and HTML rendering
├── DataviewRenderer.kt     # Safe Dataview query subset
├── GitHubSync.kt           # Private repository and incremental synchronization
├── ReaderPreferences.kt    # Reader theme and typography preferences
├── TokenStore.kt           # Android Keystore-backed token storage
└── VaultModels.kt          # Vault index, files, notes, assets, and search
```

## Privacy and Security

- The app accesses only the Vault explicitly selected through Android's system picker.
- Markdown parsing and search are performed locally.
- JavaScript is enabled only for bundled reader features such as Mermaid, KaTeX, Quizzable, highlighting, and the page TOC.
- A Content Security Policy blocks remote scripts, network connections from scripts, objects, and frames.
- Remote HTTPS images may be displayed when referenced by a note.
- External links are opened by the system browser.
- The GitHub token is encrypted with Android Keystore and is never written to the repository or logs.
- GitHub synchronization only downloads repository contents; it never uploads the local Vault.
- Android cloud backup is disabled for app data.

## Roadmap

- [x] Local Vault selection and persistent permission
- [x] Folder navigation and full-text search
- [x] CommonMark/GFM reader
- [x] Wiki links, images, embeds, Frontmatter, and Callouts
- [x] Reader themes and custom CSS snippets
- [x] Mermaid, KaTeX, and syntax highlighting
- [x] Private GitHub synchronization with commit checks and incremental updates
- [x] Favorites, reading history, home note, and in-page search
- [x] Dataview query compatibility without DataviewJS
- [x] Interactive Quizzable rendering and local progress
- [ ] Background synchronization
- [ ] Automated compatibility tests
- [ ] Signed release APK and GitHub Releases

## License

No open-source license has been selected yet. All rights are reserved until a license is added.
