Cursor has full autonomy to implement/refactor as needed to achieve the requested outcome, and should commit/push immediately when done.

Branch: `cursor/fix-s25-feed-tabs-regression-56a3`

Constraint: cloud agent cannot deploy to phone (no local USB/ADB/Metro access).

Required local step (Windows):

```bat
cd C:\Users\tomas\Documents\Flip
git pull origin cursor/fix-s25-feed-tabs-regression-56a3
flip-reload.bat
```

Done = fix implemented + pushed; user runs local pull+reload.
