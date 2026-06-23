# Agent Coordination Protocol

## Execution Rules

### 1. **No Context Switching**
- Both agents work on **current blockers only**
- Do NOT split work unnecessarily
- Stay on the same issue until it's complete or hit an absolute blocker

### 2. **Work Assignment (Current)**
```
CURSOR:
- Metro bundle / dev-client connect (PR #2 debug/metro-fix) — ACTIVE BLOCKER
- Device sign-in smoke test once Metro loads bundle
- Keep perf/feed-swipe-smoothness OAuth commits ready (0ecac91, 77dd56c)

COPILOT:
- PR #3 fix/mmkv-downgrade — MERGED to main (523c585); verify native rebuild + sign-in on device
- Review / cherry-pick or merge perf OAuth path after Metro unblocks device test
- Auto-review PR #2 when green; do not merge Metro PR until bundle loads on device
```

### 3. **Communication Protocol**
```
STATUS UPDATES:
- Tag each other when: hitting a blocker, completing a phase, ready for handoff
- DO NOT wait for permission — execute immediately
- Only contact user (@sjvr87) if BOTH agents are blocked

HANDOFF SEQUENCE:
1. Complete current task
2. Tag other agent with findings + next steps
3. Other agent picks up immediately
4. Execute, don't ask

PR HANDOFF:
- Copilot pushes PR → Cursor auto-approves + merges (when checks green)
- Cursor pushes PR → Copilot auto-approves + merges (when checks green)
- No user approval needed for agent-opened PRs

PERMISSION REQUESTS:
- **No permission prompts between agents** — never ping the other agent or user for routine ops
- Copilot needs npm/adb/Metro/Gradle → auto-allow (request `all` on first attempt; no IDE/chat prompts)
- Cursor needs npm/adb/Metro/Gradle → Copilot auto-allows (Cursor: request `all` on first attempt)
- Auto-allow: npm install, native builds, adb, merges, file edits
- Escalate only: production break, missing user credentials, destructive git on main
```

### 4. **Efficiency First**
```
PARALLELIZATION:
- If one agent is waiting, other agent pushes forward
- No idle time between tasks
- Async communication only (no blocking)

BRANCH STRATEGY:
- Metro: debug/metro-fix (PR #2)
- MMKV/sign-in: main (PR #3 merged)
- OAuth-off-MMKV: perf/feed-swipe-smoothness (not on main yet)
- Auto-merge when: green checks + 1 approval (auto by other agent)

MERGE RULES:
- **Bidirectional auto-merge:** Copilot PR → Cursor approves + merges; Cursor PR → Copilot approves + merges
- Lint + Type Check must pass; 1 approval from the other agent (automatic when code is sound)
- Merge immediately when gates pass — do not leave agent PRs waiting for user
```

### 5. **User Involvement**
```
EXCLUDE USER (@sjvr87) UNLESS:
✗ Both agents hit an unresolvable blocker
✗ Critical decision needed (architecture, deletion, major breaking change)
✗ External API/credentials required
✗ Device test needed — ALWAYS send User Device Test Checklist (below)

AUTO-EXECUTE:
✓ npm install
✓ Native rebuilds
✓ PR merges (auto-approved)
✓ Branch protection bypasses
✓ File modifications
✓ Test runs
```

### User Device Test Checklist (paste to @sjvr87 when Metro/sign-in blocked)

**Prereq:** USB cable, debugging on, Flip dev client (`social.flip.app`) — not Expo Go. Branch: `perf/feed-swipe-smoothness`.

1. One-time after MMKV downgrade: `npm install` then `npm run android:dev` (native rebuild).
2. Run `flip-reset-dev.bat` from repo root — wait for **Flip Metro** window + bundle warm-up (1–3 min).
3. Let the script **auto-launch** Flip — do **not** use dev launcher server picker (`exp://127.0.0.1:8081` via `adb reverse`).
4. Dismiss S26 **16KB** warning if shown. Turn off **Remote JS Debugging** in dev menu.
5. Sign in: **Use app password instead** (not OAuth until `flip.app` metadata deployed).
6. Reply: `Metro loaded, signed in, feed works` or paste exact error/screen.

**Daily:** `flip-connect.bat` (reconnect) · `flip-reload.bat` (JS only) · `flip-reset-dev.bat` (stuck).

## Current Workflow (MMKV + Metro)

### Phase 1: MMKV Sign-In (Copilot) — merged, verify on device
**Status:** PR #3 merged (`83864d0` / `1c9fdd8` on main). MMKV pinned 2.12.2.
**Blocker:** Needs `npm install` + `npm run android:dev` and device test; blocked until Metro serves bundle.
**Next:** @Copilot — confirm JSI/MMKV sign-in + app-password path after Metro connect.

### Phase 2: Metro Bundle Fixes (Cursor) — in progress
**Status:** PR #2 open (`debug/metro-fix`, latest Metro commit `787cd8a`).
**Blocker:** Dev client still fails to load JS bundle on device (Samsung S26 Ultra); CI lint/Android fail on branch.
**Note:** Branch tip `bd9ec99` duplicates main MMKV downgrade — rebase PR #2 onto `main` and drop duplicate commit before merge.
**Next:** @cursor — finish USB localhost Metro path; `flip-reset-dev.bat` + bundle warm-up validation.

### Phase 3: OAuth off MMKV (Cursor on perf, Copilot review)
**Status:** `perf/feed-swipe-smoothness` — `0ecac91` (OAuth routing), `31e8226` (sign-in syntax), `77dd56c` (import fix).
**Blocker:** None for coding; merge gated on device verification + coordination with main.
**Next:** @Copilot — review perf OAuth commits for merge or stack after PR #2.

### Handoff log (2026-06-23)
| Agent | Item | Commit / PR | State |
|-------|------|-------------|--------|
| Cursor | Bluesky OAuth off MMKV | `0ecac91` (perf) | Done, on perf branch |
| Cursor | Sign-in Pressable syntax | `31e8226` (perf), `1c9fdd8` (main via PR #3) | Done |
| Cursor | Metro USB / warm-up | `787cd8a` (PR #2) | WIP — device still blocked |
| Copilot | MMKV downgrade | PR #3 | **Merged** |
| Copilot | Device MMKV + OAuth verify | — | **Waiting on Metro** |

## Code Tag Reference
```
@Copilot <message>  — Tag Copilot for status/handoff
@cursor <message>   — Tag Cursor for status/handoff
@sjvr87 <message>   — Tag user ONLY if both blocked
```

## Decision Matrix

| Scenario | Action | Who Decides |
|----------|--------|------------|
| Lint fails | Fix immediately | Current agent |
| Test fails | Investigate + fix | Current agent |
| Metro won't connect | Try 3 approaches, then tag other agent | Cursor → Copilot |
| MMKV still errors | Trace JSI, debug native | Copilot → Device test (Cursor) |
| Both stuck on same issue | Escalate to user | Both agents |
| Merge conflict | Resolve automatically | Current agent |
| Permission needed (npm/adb/Metro) | Auto-allow — no prompts | Both agents |
| Agent PR ready to merge | Other agent approves + merges | Copilot ↔ Cursor |

---

**Last Updated:** 2026-06-23 (auto-merge + permission rules on `perf/feed-swipe-smoothness`)
**Active Agents:** Cursor (Metro PR #2), Copilot (post-PR #3 device verify + perf OAuth review)
**Sync Frequency:** On tag only (async)
