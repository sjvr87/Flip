Cursor has full autonomy to implement/refactor as needed to achieve the requested outcome, and should commit/push immediately when done.

Branch: `cursor/fix-s25-feed-tabs-regression-56a3` (fixes **not on `main`** until PR #64 merges)

Constraint: cloud agent cannot deploy to phone (no local USB/ADB/Metro access).

Required local step (Windows):

```bat
cd C:\Users\tomas\Documents\Flip
git checkout cursor/fix-s25-feed-tabs-regression-56a3
flip-reset-dev.bat
```

`flip-reset-dev.bat` now **pulls the current branch** before Metro reset (was skipping pull).

Fast reload only (no pull): `flip-reload.bat` — use after `git pull` or `flip-pull-fix-branch.bat`.

Done = fix implemented + pushed; user runs checkout + reset (or pull-fix-branch script).
