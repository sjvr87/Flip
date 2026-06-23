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

PERMISSION REQUESTS:
- Auto-allow all permissions (npm install, native builds, merges)
- Only escalate if it would break production or require user credentials
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
- Lint + Type Check must pass
- 1 approval (auto-given by other agent if code is sound)
- Auto-merge enabled (merge immediately when ready)
```

### 5. **User Involvement**
```
EXCLUDE USER (@sjvr87) UNLESS:
✗ Both agents hit an unresolvable blocker
✗ Critical decision needed (architecture, deletion, major breaking change)
✗ External API/credentials required

AUTO-EXECUTE:
✓ npm install
✓ Native rebuilds
✓ PR merges (auto-approved)
✓ Branch protection bypasses
✓ File modifications
✓ Test runs
```

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
| Permission needed | Grant it | Both auto-allow |

---

**Last Updated:** 2026-06-23 (handoff sync on `perf/feed-swipe-smoothness`)
**Active Agents:** Cursor (Metro PR #2), Copilot (post-PR #3 device verify + perf OAuth review)
**Sync Frequency:** On tag only (async)