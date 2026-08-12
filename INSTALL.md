# Install GitSync Portal

The same plugin package supports Android, iOS, Windows, macOS, and Linux.

## Download

Download [gitsync-portal-2.1.5.zip](https://github.com/kaleido1/GitSync-Portal/releases/download/2.1.5/gitsync-portal-2.1.5.zip). The archive contains:

```text
gitsync-portal/
├── main.js
├── manifest.json
└── styles.css
```

Extract it directly into `<Vault>/.obsidian/plugins/`. Do not create a nested `gitsync-portal/gitsync-portal/` directory.

## Desktop

On Windows, enable **Hidden items** in File Explorer. On macOS, press `Command + Shift + .` in Finder to show hidden files. Open the vault, navigate to `.obsidian/plugins/`, extract the package, reload Obsidian, and enable **GitSync Portal** under Community plugins.

On Linux:

```bash
unzip gitsync-portal-2.1.5.zip -d "/path/to/Vault/.obsidian/plugins/"
```

## Android

Enable hidden files in your file manager, open the vault's `.obsidian/plugins/` directory, extract the package, fully close Obsidian, reopen it, and enable GitSync Portal.

## iPhone and iPad

The iOS Files app does not make hidden directories convenient to manage. The recommended path is to install the plugin from a Mac or Windows device that shares the same vault through iCloud or your existing file synchronization method. A capable iOS file manager can also extract the package directly into `.obsidian/plugins/`.

## Upgrade from an earlier name

Do not overwrite `.obsidian/plugins/gitsync-port/` or `.obsidian/plugins/obsidian-viewer/`, because GitSync Portal has a new plugin ID.

1. Disable the earlier plugin.
2. Install GitSync Portal into `.obsidian/plugins/gitsync-portal/`.
3. Leave the old directory in place for the first GitSync Portal launch.
4. Enable GitSync Portal and reload Obsidian.
5. Verify settings, favorites, history, and GitHub connectivity.
6. Remove the old directory only after the migration is confirmed.

GitSync Portal reads `gitsync-port` and `obsidian-viewer` data and SecretStorage tokens when its own state has not yet been created.

## Updating GitSync Portal

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
3. Open **Obsidian → Settings → GitSync Portal**.
4. Enter the token, `owner/repository`, and branch.
5. Test the connection and run the first two-way sync manually.

The token is stored through Obsidian SecretStorage and is not included in the vault or plugin package.
