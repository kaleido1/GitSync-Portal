# Install GitSync Port

The same plugin package supports Android, iOS, Windows, macOS, and Linux.

## Download

Download [gitsync-port-2.0.0.zip](https://github.com/kaleido1/GitSync-Port/releases/download/2.0.0/gitsync-port-2.0.0.zip). The archive contains:

```text
gitsync-port/
├── main.js
├── manifest.json
└── styles.css
```

Extract it directly into `<Vault>/.obsidian/plugins/`. Do not create a nested `gitsync-port/gitsync-port/` directory.

## Desktop

On Windows, enable **Hidden items** in File Explorer. On macOS, press `Command + Shift + .` in Finder to show hidden files. Open the vault, navigate to `.obsidian/plugins/`, extract the package, reload Obsidian, and enable **GitSync Port** under Community plugins.

On Linux:

```bash
unzip gitsync-port-2.0.0.zip -d "/path/to/Vault/.obsidian/plugins/"
```

## Android

Enable hidden files in your file manager, open the vault's `.obsidian/plugins/` directory, extract the package, fully close Obsidian, reopen it, and enable GitSync Port.

## iPhone and iPad

The iOS Files app does not make hidden directories convenient to manage. The recommended path is to install the plugin from a Mac or Windows device that shares the same vault through iCloud or your existing file synchronization method. A capable iOS file manager can also extract the package directly into `.obsidian/plugins/`.

## Upgrade from Obsidian Viewer

Do not overwrite `.obsidian/plugins/obsidian-viewer/`, because GitSync Port has a new plugin ID.

1. Disable Obsidian Viewer.
2. Install GitSync Port into `.obsidian/plugins/gitsync-port/`.
3. Leave the old directory in place for the first GitSync Port launch.
4. Enable GitSync Port and reload Obsidian.
5. Verify settings, favorites, history, and GitHub connectivity.
6. Remove the old directory only after the migration is confirmed.

GitSync Port reads the old plugin's data and SecretStorage token when its own state has not yet been created.

## Updating GitSync Port

Release archives do not contain `data.json`. Update only these program files:

```text
main.js
manifest.json
styles.css
```

This preserves synchronization settings, favorites, reading history, and quiz progress.

## Configure synchronization

1. Create a fine-grained GitHub token for the target vault repository.
2. Grant `Contents: Read and write`.
3. Open **Obsidian → Settings → GitSync Port**.
4. Enter the token, `owner/repository`, and branch.
5. Test the connection and run the first two-way sync manually.

The token is stored through Obsidian SecretStorage and is not included in the vault or plugin package.
