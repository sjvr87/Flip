<!-- headroom:rtk-instructions -->
# RTK (Rust Token Killer) — Token-Optimized Commands

When running shell commands, **always prefix with `rtk`**. This reduces context
usage by 60–90% with zero behavior change. If rtk has no filter for a command,
it passes through unchanged — so it is always safe to use.

Install once: `pip install "headroom-ai[all]"`

## Key Commands

```bash
# Git (59-80% savings)
rtk git status          rtk git diff            rtk git log

# Files & Search (60-75% savings)
rtk ls <path>           rtk read <file>         rtk grep <pattern>
rtk find <pattern>      rtk diff <file>

# Test (90-99% savings) — shows failures only
rtk npm test            rtk npx jest            rtk cargo test

# Build & Lint (80-90% savings) — shows errors only
rtk npm run <script>    rtk tsc                 rtk lint
rtk npx tsc --noEmit    rtk prettier --check    rtk eslint

# Analysis (70-90% savings)
rtk err <cmd>           rtk log <file>          rtk json <file>
rtk summary <cmd>       rtk deps                rtk env

# GitHub (26-87% savings)
rtk gh pr view <n>      rtk gh run list         rtk gh issue list

# Android / Infrastructure (85% savings)
rtk adb logcat          rtk docker ps           rtk docker logs <c>

# Package managers (70-90% savings)
rtk npm install         rtk npm run <script>    rtk npx expo
```

## Rules

- In command chains, prefix each segment: `rtk git add . && rtk git commit -m "msg"`
- For debugging, use the raw command without the `rtk` prefix
- `rtk proxy <cmd>` runs a command without filtering but tracks usage
<!-- /headroom:rtk-instructions -->
