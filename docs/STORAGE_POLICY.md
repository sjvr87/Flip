# Flip storage policy

## Goals

Keep **C:** free for Windows, Android Studio, and active Flip development. Large, disposable artifacts go to **USB archive** or are deleted and rebuilt.

## USB archive (primary offload)

| Item | Value |
|------|--------|
| **Drive letter** | `D:` |
| **Volume label** | FD (2 TB USB, disk *MS YSUYVP-2TSN*) |
| **Archive root** | `D:\FlipArchive\` |

### USB safety (mandatory)

- **Never delete, overwrite, or modify** files that already exist on the USB drive outside new archive drops.
- Agents and scripts may **only create** missing `FlipArchive\` subfolders (`backups`, `logs`, `docs-snapshots`) and `README.txt` if absent.
- When archiving from C:, **copy or move** into `D:\FlipArchive\logs\` (or other FlipArchive subfolders). Unrelated folders on `D:\` (school, media, etc.) are **read-only** for automation.
- If a filename already exists **inside FlipArchive only**, rename the incoming file with a `yyyyMMdd-HHmmss` suffix — **do not overwrite** existing archive files.

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

- **2026-06-25**: USB archive on `D:\FlipArchive\` verified; session log archived as `metro-live-session_20260625-162037.txt` (collision-safe; prior USB copy retained); doc snapshots added; Gradle/npm/pip caches cleaned on C: only. USB root item count unchanged (10).