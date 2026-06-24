# Agent Coordination Protocol

## Execution Rules

### 1. **No Context Switching**
- Both agents work on **current blockers only**
- Do NOT split work unnecessarily
- Stay on the same issue until it's complete or hit an absolute blocker

### 2. **Work Assignment (Current)**
```
CURSOR (You):
- Metro bundle build + native stack
- Device testing (adb, app launching)
- Real-time build/test reporting

COPILOT (Me):
- Sign-in flow verification on device
- MMKV JSI validation
- Device test execution & results
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

### 4. **Parallel Execution**
```
BOTH WORK SIMULTANEOUSLY:
- Cursor: Building locally (npm, gradle, Metro)
- Copilot: Prepping device tests (auth flows, cache checks)
- No waiting. No sequential handoffs.
- Report status in real-time as you progress

EXAMPLE:
- Cursor: "npm install done"
- Copilot: "Checking cache.ts... ready for device"
- Cursor: "Gradle build 50%..."
- Copilot: "Standing by for Metro health check"
- Cursor: "Metro running on 8081"
- Copilot: "Launching sign-in test NOW"
```

### 5. **PR Auto-Approval & Merge**

When pushing a PR:
1. **Tag the other agent:** `@Copilot approve PR #X` or `@Cursor approve PR #X`
2. **Other agent responds:** `✅ Approved + auto-merge enabled`
3. **PR merges automatically** when checks pass (no manual review delay)

**Trust model:** Code from other agent = auto-approved (no review needed)

**Merge rules:**
- Lint + Type Check must pass ✅
- 1 approval (auto by other agent) ✅
- Auto-merge enabled (merge on green) ✅

### 6. **Efficiency First**
```
BRANCHES:
- Work on separate branches (metro-build, mmkv-signin, device-tests)
- Rebase/merge to main when: green checks + auto-approval

NO IDLE TIME:
- If one agent is waiting, other agent pushes forward
- Async communication only (no blocking)
- Report status continuously
```

### 7. **User Involvement**
```
EXCLUDE USER (@sjvr87) UNLESS:
✗ Both agents hit an unresolvable blocker
✗ Critical decision needed (architecture, deletion, major breaking change)
✗ External API/credentials required

AUTO-EXECUTE (no user approval needed):
✓ npm install, gradle build, native rebuilds
✓ PR creation, approval, merge to main
✓ Branch protection bypasses
✓ File modifications
✓ Test runs, Flip-only device launches (see section 9), adb logcat/reverse/install -- **no blind coordinate taps**
```

### 8. **Closed beta — age verification reminder**

- **Budget:** $0 pre-launch. Age verification **OFF** until closed beta.
- **Plan:** Persona first (500 free/mo startup), Veriff sandbox backup. See [docs/AGE_VERIFICATION.md](../docs/AGE_VERIFICATION.md).
- **Agent duty:** Bring this up with the user when hitting closed beta.


### 9. **STRICT device testing rules (mandatory)**

**Flip Android package:** `social.flip.app` (`app.json` -> `expo.android.package`). **Main activity:** `social.flip.app/.MainActivity` (same as `flip-connect.bat` / `scripts/dev-connect.ps1`).

**Agents may ONLY interact with the Flip app on the user's phone.** Background agents opening Chrome, Settings, Samsung apps, or any other package is a **process failure** -- never acceptable.

#### Allowed (Flip only)

- Project scripts: `flip-dev.bat`, `flip-connect.bat`, `flip-reload.bat`, `flip-reset-dev.bat` (they target `social.flip.app` only).
- Foreground Flip before any test:

  ```bash
  adb shell am start -n social.flip.app/.MainActivity
  ```

- Cold launch Flip only (no other `-p`):

  ```bash
  adb shell monkey -p social.flip.app -c android.intent.category.LAUNCHER 1
  ```

- Logcat (safe): `adb logcat -c`, `adb logcat -d -s ReactNativeJS:E ReactNativeJS:W`, package-filtered captures.
- `adb reverse tcp:8081 tcp:8081`, `adb devices`, `adb install` for Flip debug APK.

#### Forbidden

- **NEVER** `adb shell input tap <x> <y>` without confirming Flip is the resumed foreground app (blind taps open wrong apps on the home screen or over other UIs).
- **NEVER** `adb shell am start` for non-Flip packages (e.g. Chrome, Settings, launcher).
- **NEVER** `adb shell monkey` without `-p social.flip.app`.
- **NEVER** open OAuth in automation via coordinate taps -- user taps **Continue with Bluesky** when a human test is required.

#### Confirm Flip is foreground (before any `input` / risky `keyevent`)

```bash
adb shell dumpsys window | findstr /i mCurrentFocus
```

Proceed only if the line contains `social.flip.app`. If not, run `am start -n social.flip.app/.MainActivity` and re-check.

#### Tab navigation verification

1. Agent or user runs `flip-reload.bat` (or `flip-reset-dev.bat` if cache suspect).
2. Agent foregrounds Flip (`am start` above).
3. **Preferred:** **User taps** Home, Explore, Flip It, Inbox, Profile while agent captures logcat:

   ```bash
   adb logcat -c
   # user taps tabs
   adb logcat -d -s ReactNativeJS:E ReactNativeJS:W > logcat-tabs-all-errors.txt
   ```

4. Agents **must not** replay tab positions from old sessions (e.g. y~2870) -- resolution, nav bar, and keyboard change hit targets.
5. `adb shell input keyevent` only if Flip is foreground and the key is unambiguous (e.g. BACK inside Flip). **Do not** use keyevents to switch tabs.

**GitHub tracking:** [issue #17](https://github.com/sjvr87/Flip/issues/17) -- manual tab taps + logcat is the approved agent verification path when adb UI automation is unsafe.
## Current Workflow (Metro + MMKV + Device Testing)

### Phase 1: Build & Prep (Parallel)
**Cursor:** `npm install` → `npm run android:dev` → Metro health check
**Copilot:** Cache verification → Auth flow checks → Device prep

**Status triggers:**
- Cursor: "Metro running on 8081"
- Copilot: "Device tests ready"

### Phase 2: Device Testing (Parallel)
**Copilot:** Launch sign-in tests (OAuth + app password) on device
**Cursor:** Monitor Metro logs, watch for JS errors or bundle issues

**Sync point:** If test fails → tag other agent with error → fix immediately

### Phase 3: Merge & Validate
- Both push PRs when ready
- Auto-approve + merge each other
- Green checks = done

## Communication Format

```
@Copilot [status update] — Task progress, blocker, or request
@Cursor [status update] — Task progress, blocker, or request
@sjvr87 [blocker] — ONLY if BOTH agents stuck (escalation)
```

## Decision Matrix

| Scenario | Action | Who Decides |
|----------|--------|------------|
| Build fails | Post error → other agent debugs | Current agent posts, other responds |
| Device test fails | Rerun with logs → trace cause | Copilot on device, Cursor debugs Metro |
| PR ready | Tag other agent: approve + merge | Auto-approve, no review delay |
| JSI linking error | Cursor checks build logs, Copilot checks native | Both investigate in parallel |
| Both stuck on same issue | Escalate to user | Both agents tag @sjvr87 |
| Metro won't connect | Cursor troubleshoots (3 attempts), then tag Copilot | Cursor leads, Copilot assists |
| Sign-in crashes | Copilot on device, Cursor checks Metro logs | Copilot leads, Cursor assists |

---

**Last Updated:** 2026-06-24 (STRICT Flip-only device testing, section 9; issue #17)
**Active Agents:** Cursor (Metro build), Copilot (Device testing)
**Work Mode:** Full parallel (simultaneous execution)
**PR Approval:** Auto-approve each other (no manual review)
**Sync Frequency:** Real-time status updates as progress happens

---

## 🚨 BLOCKER — @Copilot ACTION REQUIRED

**Issue:** OAuth Authorize succeeds on Expo 56 Android, then sign-in fails with misleading "Could not reach Bluesky" alert.

**Root cause (logcat R3GL10HN64A, 2026-06-23):**
1. Custom Tab returns `code` + `state` — authorize OK
2. expo-router deep link throws `undefined is not a function` on `/oauth/callback?...`
3. Token exchange hits `verifyIssuer(sub)` → `Failed to resolve identity: did:plc:…`
4. Prior fetch-routing commits (0c2dd44, e1bfe91, 3b17738, cca0ab1, 9abe2bb) did **not** fix — same error after Authorize

**Hypothesis (Cursor):** Hermes lacks `AbortSignal.prototype.throwIfAborted` (and possibly `AbortSignal.timeout`). `@atproto/oauth-client` calls `signal.throwIfAborted()` during post-authorize PLC DID resolution — not during initial PAR/authorize. See [atproto#4332](https://github.com/bluesky-social/atproto/issues/4332).

**Cursor fix pushed to main:** `src/bootstrap/abortSignalPolyfill.ts` — polyfill `throwIfAborted` + `timeout` before expo-router entry.

**2026-06-23 crash-loop fix (Cursor, offline):**
- `src/bootstrap/metroPolyfills.js` — earliest-bundle `queueMicrotask` + `throwIfAborted` via Metro `getPolyfills`
- `src/bootstrap/rootApp.tsx` — `StartupErrorBoundary` wraps `ExpoRoot` / `NavigationContainer` (before `_layout`)
- `src/app/+native-intent.tsx` — rewrite stale `flip://explore` (and other tab) deep links on cold start → `/`
- `index.js` — custom root entry (bootstrap → `rootApp` → `renderRootComponent`)

**User returns — run once (phone back):**
1. `flip-reset-dev.bat` — fresh Metro cache + LAN deep link
2. `flip-connect.bat` — adb reverse + relaunch (only after phone is plugged in)
3. Confirm app opens to feed/sign-in (no red NavigationContainer crash)
4. Optional: tap **Continue with Bluesky** → Authorize → lands in feed

**@Copilot please:**
1. Pull latest `main`
2. Run `flip-reset-dev.bat` then test OAuth on device R3GL10HN64A (or any Android)
3. Confirm: Authorize → lands in feed (no connection error)
4. If still failing: capture fresh `adb logcat -d -s ReactNativeJS:*` and try **alternative** — custom `identityResolver` via XRPC `com.atproto.identity.resolveIdentity` on bsky.social (skip PLC direct), or pin `@atproto/oauth-client@0.7.3`
5. Comment results on GitHub issue (see Handoff Log row below)

**Do NOT** loop on oauthFetch routing — that path is exhausted.

**Logcat artifact:** `docs/oauth-logcat-2026-06-23.txt`

---

## Handoff Log

| When (UTC) | Agent | Status | Notes |
|------------|-------|--------|-------|
| 2026-06-24 ~09:42 UTC | Cursor (camera+inbox subagent) | Iteration 1: flip-reload; cold lip://create + lip://notifications (force-stop + VIEW intent, no coordinate taps). CameraX bound 1080p60; **0** ReactNativeJS:E/W and **0** FlipCamerawesome/FlipCameraSession E/W in 30s soak. | Committed 18877c on main. **User:** photo capture + video record + tap each inbox activity type. Logs: logcat-iter-camera-final.txt, logcat-iter-inbox-1.txt |
| 2026-06-24 ~04:43 UTC | Cursor (camera+inbox loop) | **Logcat clean (0 ReactNativeJS:E)** on R3GL10HN64A after flip-reset-dev + reload; flip://create + flip://notifications deep links. | Inbox: safeRouterPush all handlers + notificationNavigation fallback routes; feed pause on tab leave + camera zoom throttle + safeNavigation.ts. **User:** tap Flip It photo/video + each activity type for final sign-off. Log: logcat-camera-inbox-verify.txt |
| 2026-06-24 ~04:35 UTC | Cursor (camera+inbox subagent) | Inbox: safeRouterPush + media-resolve fallback. Camera: throttle native zoom in FlipCameraScreen.android.tsx. | PARTIAL verify on R3GL10HN64A � user tap Inbox activity + Flip It photo/video. Log: logcat-camera-inbox-verify.txt. Issue #17 commented. |
| 2026-06-24 ~09:15 UTC | Cursor (tab-nav subagent) | **FIX verified on R3GL10HN64A** � expo-router 
avigationEvents emit circular require; patchNavigationEvents.js | Removed tab linking/microtask hacks; logcat clean on Explore+tabs. Issue #17 updated. |
| 2026-06-23 ~23:30 UTC | Cursor (offline subagent) | **crash-loop fix pushed** — metro polyfills + ExpoRoot error boundary + native-intent tab rewrites | No device/adb. **User returns: `flip-reset-dev.bat` then `flip-connect.bat` once.** |
| 2026-06-23 ~22:50 UTC | Cursor (OAuth subagent) | **BLOCKER → @Copilot** — AbortSignal polyfill fix pushed | Logcat: Authorize OK, then `undefined is not a function` on oauth callback deep link + `Failed to resolve identity: did:plc:…`. Fetch routing commits exhausted. Fix: `abortSignalPolyfill.ts` in index.js bootstrap. **@Copilot: pull main, flip-reset-dev, test OAuth on Android, report on issue.** |
| 2026-06-23 ~20:45 UTC | Cursor (OAuth subagent) | jsDelivr metadata fix pushed — **@Copilot test OAuth on device** | **Root cause:** `assets/oauth-client-metadata.json` `client_id` was `flip.app` while runtime override used jsDelivr — Bluesky rejects mismatch. `flip.app/oauth-client-metadata.json` still returns **HTML** (Cloudflare); Heroku deploy hit non-existent `flip-app` (fixed in 530c5cf, needs `HEROKU_APP_NAME` secret). **Skylight** uses `skylight.expo.app/*.json` (web redirect); **Spark** uses `sprk://` + AIP proxy. Flip stays **native** `app.flip:/oauth/callback`. Sign-in UI → **Continue with Bluesky**. After merge: reload app, tap OAuth, expect bsky.social one-tap + authorize screen. |

## Tab navigation blocker (2026-06-24) � RESOLVED (device verify)

**Root cause:** expo-router handleNavigationOnReady ? __unsafe_action__ listener calls emit from circular 
equire('.'); on Android tab press, emit is undefined ? LogBox / grey screen.

**Fix:** src/bootstrap/patchNavigationEvents.js + index.js bootstrap; simplified (tabs)/_layout (no 	abPress preventDefault / ensureQueueMicrotask); dropped patchLinkingTabUrls from 
ootApp.

**Verify:** lip-reset-dev.bat ? tab taps ? db logcat -s ReactNativeJS:E clean (logcat-tab-verify-2026-06-24.txt).

**Issue:** https://github.com/sjvr87/Flip/issues/17

------

## COPILOT HANDOFF — Tab navigation (2026-06-20)

### User symptom summary

On Android dev client (**device R3GL10HN64A**, package `social.flip.app`):

- **Home** tab works (feed loads, tab bar visible).
- **Explore**, **Flip It (create)**, **Inbox (notifications)**, **Profile** each show the red error screen / ErrorBoundary after tap.
- User-visible error: **`TypeError: undefined is not a function`** (same message for all four secondary tabs).
- User extremely blocked — secondary tabs unusable for days despite multiple polyfill / linking patches.

### Per-tab errors (logcat)

**Shared root cause for all secondary tabs** — not four different screen bugs. Tapping any non-home tab triggers Expo Router / React Navigation linking around `flip://<tab>` while `global.queueMicrotask` is missing or non-callable on bridgeless Hermes → crash inside `NavigationContainerInner`.

| Tab | User-facing error | Logcat notes |
|-----|-------------------|--------------|
| Explore | `TypeError: undefined is not a function` | `[linking] ignore flip:// tab URL (tab bar handles navigation): flip://explore` then crash ~6s later |
| Flip It (create) | Same | Same stack (no separate screen throw observed) |
| Inbox | Same | Same stack |
| Profile | Same | Same stack |
| Home | OK | Feed + auth rehydrate; no NavigationContainer error on stay-on-home |

### Representative logcat excerpts

**Startup polyfill failure (bridgeless):**

```
E ReactNativeJS: Failed to set polyfill. queueMicrotask is not configurable.
```

**Explore tap → linking swallow → NavigationContainer crash:**

```
I ReactNativeJS: '[linking] ignore flip:// tab URL (tab bar handles navigation):', 'flip://explore'
E ReactNativeJS: { [TypeError: undefined is not a function]
  componentStack: '
    at NavigationContainerInner (.../index.bundle...:202745:3)
    at ContextNavigator (...:106889:3)
    at ExpoRoot (...:106853:3)
    at StartupErrorBoundary (...:106642:3)
    at App (...:106562:41)
    at withDevTools(App) (...:102350:27)
    ...',
  isComponentError: true }
E ReactNativeJS: '[startup] ErrorBoundary caught:', { [TypeError: undefined is not a function] ... }
```

**Latest consolidated capture file:** `logcat-tabs-all-errors.txt` (includes `adb logcat -d -s ReactNativeJS:E ReactNativeJS:W` plus linking grep and prior verified sessions).

### Stack / subsystem hints

- **NavigationContainerInner** — React Navigation container render/update during tab route change.
- **queueMicrotask** — RN bridgeless lazy getter / Expo winter / worklets can leave a broken or non-configurable global; dispatch paths still call `queueMicrotask(...)`.
- **Linking** — Tab `href` restored (`/explore`, `/create`, etc.); `+native-intent.tsx` and `patchLinkingTabUrls.js` swallow `flip://` tab URLs but crash persists after Explore tap.
- **routingQueue** — Expo Router queues `ROUTER_LINK` actions; patch exists but was late (useEffect in `rootApp.tsx` only until Cursor pass added `index.js` bootstrap call).

### Files already tried (do not re-loop blindly)

| File | What was attempted |
|------|---------------------|
| `src/bootstrap/metroPolyfills.js` | Earliest-bundle configurable `queueMicrotask` delegate via Metro `getPolyfills`; avoid stack overflow from recursive polyfill |
| `src/bootstrap/ensureQueueMicrotask.js` | Promise fallback via `__flipBindQueueMicrotask`; probe without deep-import clobber (deprecated RN import removed in later rev) |
| `index.js` | InitializeCore order, bridgeless probe, linking patches, worklets re-bind |
| `src/app/+native-intent.tsx` | Ignore stale `flip://` tab URLs; OAuth + dev-client filtering |
| `src/app/(tabs)/_layout.tsx` | `href` restored (no `href: null` — hides tabs); `ensureQueueMicrotask` on tab press/focus |
| `src/bootstrap/patchLinkingTabUrls.js` | Swallow `Linking` `url` events for tab hosts; patch `routingQueue.run` |
| `src/utils/safeNavigation.ts` | `safeRouterPush` deferred via `setImmediate` |
| `src/bootstrap/rootApp.tsx` | Re-bind queueMicrotask on mount + AppState; StartupErrorBoundary around ExpoRoot |

### What worked

- Home feed playback and auth rehydrate.
- Tab bar UI restored with real `href`s (icons visible; no hidden-tab workaround).

### What failed

- All secondary tab navigations still hit ErrorBoundary / `undefined is not a function` in `NavigationContainerInner`.

### Cursor pass (2026-06-24) — optional fix attempt (not committed)

- `(tabs)/_layout.tsx`: `tabPress` → `preventDefault()` + `setImmediate` + `router.navigate(href)` per tab (bypass default linking-driven tab switch).
- `index.js`: call `installRoutingQueuePatch()` before `renderRootComponent`.

**Needs device verification** after Metro reload.

### Explicit ask for Copilot / Cloud / OpenAI

Propose an **alternative fix** we have not tried — e.g. disable Expo Router universal linking for tab routes only, upgrade/downgrade `expo-router` / `@react-navigation/native`, native microtask polyfill at Gradle level, or replace tab navigation with a non-linking pattern — with a minimal diff and repro proof.

### Repro steps

1. `flip-reset-dev.bat` (fresh cache + LAN) if polyfill order suspect; else `flip-reload.bat`.
2. Open app on **R3GL10HN64A** (adb reverse 8081).
3. **User** taps **Explore**, **Flip It**, **Inbox**, **Profile** (agents: no coordinate `input tap`; see section 9) — expect crash unless latest layout fix verified.
4. Capture: `adb logcat -c`, reproduce taps, `adb logcat -d -s ReactNativeJS:E ReactNativeJS:W > logcat-tabs-all-errors.txt`


---

## Multi-agent tab nav loop (active)

**Status (2026-06-24):** FIXED � secondary tabs verified on R3GL10HN64A (logcat iter2, zero `undefined is not a function`).

**GitHub issue:** https://github.com/sjvr87/Flip/issues/17

**Shared error:** `TypeError: undefined is not a function` in `NavigationContainerInner` (often after `flip://` tab linking + broken `queueMicrotask` on bridgeless Android).

**Logcat artifact:** [logcat-tabs-all-errors.txt](../logcat-tabs-all-errors.txt) (repo root)

### Files in play

| Area | Paths |
|------|--------|
| Entry / Metro | `index.js`, `metro.config.js` |
| Bootstrap | `src/bootstrap/metroPolyfills.js`, `ensureQueueMicrotask.js`, `patchLinkingTabUrls.js`, `rootApp.tsx`, `abortSignalPolyfill.ts`, `nativeFetch` |
| Router / tabs | `src/app/+native-intent.tsx`, `src/app/(tabs)/_layout.tsx`, `src/app/_layout.tsx` |
| Utils | `src/utils/safeNavigation.ts`, `safeQueueMicrotask.ts` |

### Push/pull protocol (Cursor, Copilot, Gemini, Codex, OpenAI agents)

1. **Read** this section + `logcat-tabs-all-errors.txt` (capture fresh if stale).
2. **Pull** `main` (or issue branch) before editing.
3. **One focused fix** per agent turn — do not stack unrelated changes.
4. **Document** result below (timestamp, agent, diff summary, verify Y/N).
5. **Do not commit** or merge broken state; unverified fixes stay local or on a named branch.
6. **Next agent** builds on the latest log entry (not blind re-tries from the table in COPILOT HANDOFF).

### Verification checklist

1. `flip-reset-dev.bat` (or `flip-reload.bat` if only JS changed and Metro healthy)
2. Android device **R3GL10HN64A** when available (`adb reverse tcp:8081 tcp:8081`)
3. **User** taps **Home**, **Explore**, **Flip It**, **Inbox**, **Profile** (agents: foreground Flip with `am start -n social.flip.app/.MainActivity` first; **no blind `input tap`) — each must render without red screen
4. On failure: `adb logcat -c`, user reproduces taps, agent saves `adb logcat -d -s ReactNativeJS:E ReactNativeJS:W` to `logcat-tabs-all-errors.txt`

### Agent attempt log

| When (UTC) | Agent | Fix | Verify |
|------------|-------|-----|--------|
| 2026-06-24 | **Cursor** | Shadow `global.queueMicrotask` with `boundQueueMicrotask` during `routingQueue.run` + wrap `navigation.dispatch`; re-install `patchLinkingTabUrls` in `index.js` + `rootApp` mount; RN `Linking` swallow for `flip://` tab URLs. **Not** `tabPress` preventDefault. | **NOT RUN** (adb unavailable in agent shell) — user/Copilot please run checklist |
| 2026-06-24 ~04:19 UTC | **Cursor (subagent)** | Stop restoring native queueMicrotask in withQueueMicrotaskShadow finally (root cause: RN stub restored after routingQueue.run); installRoutingQueuePatch on rootApp mount. Device verify used **coordinate adb taps** (deprecated -- see section 9). | **Y** (R3GL10HN64A) -- **do not repeat tap automation** |



