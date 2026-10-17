# dsh-desktop-restart-menu

Adds two Restart entries to the DeepSeek Harness desktop app:

- **Top-left "Application" menu**: a "Restart" entry above "Exit".
- **System tray context menu**: "Restart DeepSeek Harness" above "Quit DeepSeek Harness".

[中文](README.md) | English

## Why not a plugin

Both native menus are built by the Electron main process (`lib/main.js`). Cordis plugins run in a separate Host child process and cannot reach Electron's `Menu` / `Tray` objects, and the shell exposes no menu extension point.

So this patches `lib/main.js` inside `resources/app.asar`: the patched bundle is trimmed/padded to exactly the original byte length, so the asar header and entry offsets stay valid. The Electron asar-integrity fuse is disabled in this build, so the equal-length write does not trip validation.

## Usage

Requires Node.js (built-in modules only).

```powershell
node apply.js                    # default path D:/Programs/DeepSeek Harness/resources/app.asar
node apply.js "C:/.../app.asar"  # custom install path
node apply.js --dry-run          # match and syntax-check only, no write
node restore.js                  # restore from backup/main.orig.mjs
```

After patching, **fully quit** the app (tray → "Quit DeepSeek Harness") and reopen it; the new entries appear on the next launch.

## Behavior

The patched Restart entry runs `app.relaunch()` plus a silent quit (skipping the "tasks are running" confirmation), matching the official Restart in development mode:

- The app-menu entry and the tray entry call the same `app.relaunch()` / `quitWithoutConfirmation()`.
- The tray entry uses a new `restart` option on `DesktopTray`, so it cannot re-trigger during shutdown.

## Notes

- **App updates replace `app.asar`**, so the patch disappears; re-run `apply.js` after an update.
- The script matches anchor text and only supports the shell version it was written against; if an anchor matches anything other than exactly once it aborts without writing.
- The first `apply.js` run saves the original `lib/main.js` to `backup/main.orig.mjs`; that folder and the generated `main.patched.mjs` are git-ignored and not distributed.
- Restore requires a backup from the same app version; `restore.js` refuses otherwise.

## Verification

- `lib/main.js` read back from the asar is byte-identical to the local patched file (same SHA-256);
- `node --check` passes;
- Re-running `apply.js` detects the existing patch and skips;
- The menu itself must be checked after restarting the app (main-process code cannot be hot-reloaded).
