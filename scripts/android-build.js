/**
 * Build Flip debug APK with Gradle (no expo run:android).
 * Patches Node paths, runs :app:assembleDebug, installs via adb.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const androidDir = path.join(root, 'android');
const apkPath = path.join(
  androidDir,
  'app',
  'build',
  'outputs',
  'apk',
  'debug',
  'app-debug.apk',
);
const isWin = process.platform === 'win32';
const gradlew = path.join(androidDir, isWin ? 'gradlew.bat' : 'gradlew');

function resolveAdb() {
  if (process.env.ADB) {
    return process.env.ADB;
  }
  const sdkRoot =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    (process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk')
      : null);
  if (sdkRoot) {
    const sdkAdb = path.join(sdkRoot, 'platform-tools', isWin ? 'adb.exe' : 'adb');
    if (fs.existsSync(sdkAdb)) {
      return sdkAdb;
    }
  }
  return 'adb';
}

const adb = resolveAdb();
const launchApp = !process.argv.includes('--no-launch');

function run(label, command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: options.cwd ?? root,
    shell: isWin,
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(`[android:build] ${label} failed (exit ${result.status ?? 1})`);
    process.exit(result.status || 1);
  }
}

console.log('[android:build] Patching Android Node/Gradle paths…');
run('patch-android-node', 'node', ['./scripts/patch-android-node.js']);

if (!fs.existsSync(gradlew)) {
  console.error(
    '[android:build] android/ not found. Run first: npm run android:prebuild',
  );
  process.exit(1);
}

console.log('[android:build] Gradle :app:assembleDebug…');
run('gradle', gradlew, [':app:assembleDebug'], { cwd: androidDir });

if (!fs.existsSync(apkPath)) {
  console.error(`[android:build] APK missing at ${apkPath}`);
  process.exit(1);
}

console.log('[android:build] Installing on device…');
run('adb install', adb, ['install', '-r', apkPath]);

if (launchApp) {
  spawnSync(adb, ['shell', 'am', 'start', '-n', 'social.flip.app/.MainActivity'], {
    stdio: 'inherit',
    shell: isWin,
  });
}

console.log(
  '[android:build] Done. Daily dev: npm.cmd start → adb reverse tcp:8081 tcp:8081 → open Flip app.',
);
