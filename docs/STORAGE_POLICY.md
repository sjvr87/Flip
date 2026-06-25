# Flip storage policy

## Goals

Keep **C:** free for Windows, Android Studio, and active Flip development. Large, disposable artifacts go to **USB archive** or are deleted and rebuilt.

## USB archive (primary offload)

| Item | Value |
|------|--------|
| **Drive letter** | `D:` |
| **Volume label** | FD (2 TB USB, disk *MS YSUYVP-2TSN*) |
| **Archive root** | `D:\FlipArchive\` |

### Layout

```
D:\FlipArchive\
  backups\          # Manual or scripted backups
  logs\             # logcat-*, metro-live-session*, large session .txt
  docs-snapshots\   # Point-in-time copies of docs
  README.txt        # Restore instructions
```

### What belongs on USB

- Old `logcat-*.txt`, `metro-live-session.txt`, and other large session logs from the repo root
- Optional zipped `.cursor` scratch (`patch-*.js`, `_write-*.js`) if kept for reference
- Doc snapshots under `docs-snapshots/`

### What stays on C:

- Full Flip git repo (`src/`, `package.json`, handoffs under `.github/handoffs/`)
- `node_modules` (reinstall with `npm install`, do not move to USB)
- Android SDK and Android Studio installs

### What we delete (rebuildable)

- `npm cache` (`npm cache clean --force`)
- `pip cache` (`pip cache purge`)
- User `~/.gradle/caches` when **> 1 GB**
- `android/app/build` and `android/build` in the repo

## Restore from USB

1. Plug USB; confirm `D:\FlipArchive\` in Explorer.
2. Copy needed files from `logs/` or `backups/` back into `C:\Users\tomas\Documents\Flip\`.
3. For app binaries, run `npm run android:dev` instead of restoring build folders.

## Last maintenance

- **2026-06-25**: Archive root created on `D:`; `metro-live-session.txt` moved to `D:\FlipArchive\logs\`; `android/app/build` removed (~4.1 GB); npm/pip caches cleaned.
