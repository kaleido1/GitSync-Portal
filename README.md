# GitSync Portal

GitSync Portal is a native Obsidian plugin for two-way GitHub synchronization on Android, iOS, Windows, macOS, and Linux. It also provides a multilingual vault dashboard with full-text search, favorites, reading history, reader controls, and interactive quizzes.

Current version: `2.1.9`

> GitSync Portal is an independent community project. It is not affiliated with or endorsed by Obsidian.

## Highlights

- Two-way GitHub synchronization without system Git, Node.js, Electron, or platform-specific shell commands
- One implementation for Android, iOS, Windows, macOS, and Linux
- Three-way reconciliation based on the last synchronized commit
- Two-way, pull-only, and push-only manual actions
- Mass-deletion safeguards and conflict-copy loop prevention
- Upload, download, and deletion propagation
- Newer-version conflict resolution with preserved `.conflict-…` copies
- Automatic retries when the remote branch changes during a sync
- A synchronization mutex that suppresses duplicate manual and automatic attempts while a sync is in progress
- Trailing 30-second save-triggered synchronization after the latest favorite or history change
- Startup, save-triggered, manual, and periodic sync modes
- Fine-grained GitHub token storage through Obsidian `SecretStorage`
- Vault dashboard with folders, files, search, favorites, history, and an outline
- Reader font size, line height, width, paragraph spacing, and focus mode
- Seven Quizzable question types with saved local progress
- Per-question retry, answer explanations, and reliable multi-row matching answers
- Plugin language setting with system-language detection
- Selected-file highlighting and scroll-position preservation during dashboard refreshes

## Languages

GitSync Portal can follow the language selected in Obsidian or use an explicit language from the plugin settings.

The language selector closely follows commonly supported Obsidian locales:

- English and English (UK)
- 简体中文 and 繁體中文
- 日本語 and 한국어
- Español, Deutsch, Italiano, and Français
- العربية and বাংলা
- Nederlands, Polski, Português, and Português do Brasil
- Română, Русский, Svenska, Türkçe, Українська, and Tiếng Việt

English and Simplified Chinese cover the full interface. Traditional Chinese, Japanese, Korean, Spanish, German, and Italian provide broad dashboard, settings, synchronization, and quiz coverage. Other listed locales translate navigation and the main synchronization controls. Every language falls back safely to English for text not yet localized.

Change the language under **Obsidian → Settings → GitSync Portal → Language**. The dashboard updates immediately. Command names are registered when the plugin loads, so reload Obsidian after changing language if you also want Command Palette entries to update.

## Installation

Download [gitsync-portal-2.1.9.zip](https://github.com/kaleido1/GitSync-Portal/releases/download/2.1.9/gitsync-portal-2.1.9.zip) and extract it into your vault's plugin directory:

```text
<Vault>/.obsidian/plugins/
```

The final layout must be:

```text
<Vault>/.obsidian/plugins/gitsync-portal/
├── main.js
├── manifest.json
└── styles.css
```

Reload Obsidian, open **Settings → Community plugins**, and enable **GitSync Portal**. See [INSTALL.md](INSTALL.md) for platform-specific instructions.

## Upgrading from an earlier name

GitSync Portal uses the plugin ID `gitsync-portal`. Earlier releases used `gitsync-port` or `obsidian-viewer`, so install it as a renamed plugin instead of overwriting an old directory.

1. Disable the earlier plugin.
2. Install GitSync Portal into `.obsidian/plugins/gitsync-portal/`.
3. Keep `.obsidian/plugins/gitsync-port/` or `.obsidian/plugins/obsidian-viewer/` temporarily for the first launch.
4. Enable GitSync Portal and reload Obsidian.
5. Confirm that the home note, reader settings, favorites, history, sync baseline, and GitHub connection are present.
6. Remove the old plugin only after verification.

On first load, GitSync Portal reads legacy settings, shared favorites/history, local synchronization state, and SecretStorage tokens when new data does not exist. It checks `gitsync-port` first, then `obsidian-viewer`, writes future state under `gitsync-portal`, and ignores both legacy plugin directories during synchronization.

## GitHub synchronization setup

1. Create a fine-grained personal access token that can access only the target vault repository.
2. Grant `Contents: Read and write` repository permission.
3. Open **Obsidian → Settings → GitSync Portal**.
4. Enter the token, `owner/repository`, and branch.
5. Select **Test connection**, then run the first two-way sync manually.
6. Verify the result before enabling startup, save-triggered, or periodic sync.

An entirely new GitHub repository is supported: the first two-way sync creates its initial commit and configured branch from the local vault. A local vault restored without files should use **Pull only** when the remote already contains commits.

The first sync keeps files that exist on only one side. If both sides changed the same path, GitSync Portal compares the local modification time with the latest remote commit for that path. The newer version becomes the main file and the older version is preserved as a device- and timestamp-labelled conflict copy.

The dashboard keeps two-way sync as the primary action and places **Pull only** and **Push only** underneath as secondary actions. Pull-only applies remote changes without uploading and preserves displaced local content. Push-only uploads local changes without applying remote changes and preserves displaced remote content. Generated conflict copies are excluded from later synchronization passes so they cannot create a conflict loop.

Push-only always publishes locally installed community plugin files when they differ from the remote repository. This makes desktop plugin installs and upgrades available to mobile devices on their next pull-only sync. Explicitly ignored runtime and device-local files remain excluded.

If the remote branch changes during the final commit, GitSync Portal reads the new branch head and retries. If the same path changed remotely, it returns to reconciliation instead of forcing the reference.

Manual, startup, save-triggered, and periodic sync requests share one lock. A request received while another sync is still saving settings, communicating with GitHub, or applying changes is ignored instead of starting a competing attempt. The lock is released after both successful and failed syncs.

When **Sync on save** is enabled, changes to favorites or reading history restart a trailing 30-second timer. Synchronization starts only after 30 seconds without another tracked-state change; if a sync is still running at that point, the pending synchronization waits until the lock is available.

## What is synchronized

The sync engine traverses the vault through Obsidian's cross-platform Vault Adapter. It can synchronize:

- Markdown notes and attachments
- `.gitignore`
- Obsidian themes and CSS snippets
- Community plugin files and settings
- Core and community plugin enablement lists
- GitSync Portal program files
- Shared favorites and reading history in `sync-state.json`

The following stay device-local by default:

- Workspace layout files
- GitSync Portal's local synchronization baseline
- GitSync Portal conflict copies
- Obsidian Git runtime scripts
- The legacy `.obsidian/plugins/gitsync-port/` and `.obsidian/plugins/obsidian-viewer/` migration directories

The vault's `.git/` database and `.trash/` directory are always excluded. The GitHub token is stored in Obsidian SecretStorage and is not a vault file.

If Obsidian Git is installed in the same vault, enable automatic synchronization in only one plugin. Two independent engines updating the same branch can race.

## Dashboard and reading tools

The left-sidebar dashboard provides:

- Home, Files, Favorites, and History tabs
- Directory navigation with back, forward, parent, and breadcrumb controls
- Filename and Markdown-body search with IME-safe input handling
- A visible selected state for the active file
- Preserved scroll position when the dashboard refreshes
- Current-note favorite and home-note actions
- GitHub synchronization status and progress
- Current-note heading navigation
- Batched history rendering for responsive navigation even with a large history limit

GitSync Portal uses Obsidian's native Markdown rendering, Wiki Links, embeds, Properties, Callouts, Mermaid, KaTeX, syntax highlighting, CSS snippets, and installed Dataview support.

## Development

Node.js 18 or newer is required:

```bash
npm install
npm test
```

`npm test` performs a TypeScript production build, release metadata validation, synchronization-core tests, and localization tests.

Development mode:

```bash
npm run dev
```

Project structure:

```text
main.ts                 Plugin entry point, settings, migration, and lifecycle
src/i18n.ts             Language registry, translations, and locale resolution
src/viewer-view.ts      Dashboard and file navigation
src/settings.ts         Plugin settings interface
src/github-sync.ts      Cross-platform GitHub synchronization
src/quiz.ts             Quizzable parsing, rendering, and scoring
styles.css              Desktop and mobile styles
scripts/test-sync.mjs   Synchronization-core tests
scripts/test-i18n.mjs   Language and fallback tests
```

## Privacy and security

- Reading, search, favorites, history, and quizzes operate locally.
- GitHub is contacted only after synchronization is configured and triggered.
- The GitHub token is never written to `data.json`, logs, release archives, or the vault.
- Oversized files stop the sync instead of being silently skipped.
- Conflict copies preserve displaced content and are excluded from future scans by default.

## Project history

This repository was initially based on `MorganTian886/Obsidian_Viewer`. The Git history retains the original authorship and contribution record. The cross-platform native plugin rewrite and subsequent releases are independently maintained by [Kai Liu](https://github.com/kaleido1).

## License

No open-source license has been selected. Rights in the original and subsequent contributions remain with their respective authors. Do not treat the repository contents as open-source licensed until an explicit license is added.
