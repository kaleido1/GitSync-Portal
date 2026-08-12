# GitSync Port for Obsidian

GitSync Port is a native Obsidian plugin that combines a multilingual vault dashboard with cross-platform two-way GitHub synchronization.

## Dashboard

- Browse Markdown files by folder.
- Search titles, paths, and note content.
- Keep favorites and reading history.
- Adjust reading width, font size, and line height.
- Generate interactive single-choice and multiple-choice quizzes from Markdown headings.
- See the currently selected file highlighted in the file tree.
- Keep the file tree at the same scroll position when selecting a file, toggling a favorite, or refreshing the dashboard.

## GitHub synchronization

1. Create a fine-grained GitHub personal access token with **Contents: Read and write** access to the target repository.
2. Open **Obsidian → Settings → GitSync Port**.
3. Save the token, repository in `owner/repository` format, and branch name.
4. Use **Test connection**, then run a synchronization from the dashboard or Command Palette.

The plugin uses Obsidian's HTTP and vault APIs, so the same synchronization engine works on desktop, Android, and iOS without requiring a local Git executable.

## Languages

Choose **System default** to follow Obsidian, or select a language explicitly in GitSync Port settings. The available choices are aligned with commonly supported Obsidian locales and include English, Chinese, Japanese, Korean, Spanish, German, Italian, French, Arabic, Bengali, Dutch, Polish, Portuguese, Romanian, Russian, Swedish, Turkish, Ukrainian, and Vietnamese. Missing strings fall back safely to English.

## Manual installation

Place the release files in:

```text
<Vault>/.obsidian/plugins/gitsync-port/
├── main.js
├── manifest.json
└── styles.css
```

Reload Obsidian and enable **GitSync Port** under **Settings → Community plugins**.

For platform-specific instructions and migration from the former plugin ID, see [INSTALL.md](INSTALL.md).
