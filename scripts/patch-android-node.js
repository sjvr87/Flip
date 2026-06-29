/**
 * Ensures Gradle can find Node on Windows when it is not on the daemon PATH.
 * Patches android/settings.gradle after expo prebuild.
 */
const fs = require('fs');
const path = require('path');

const settingsFile = path.join(__dirname, '..', 'android', 'settings.gradle');

const NODE_RESOLVER = `pluginManagement {
  def flipResolveNodeExecutable = {
    def fromEnv = System.getenv('NODE_BINARY')
    if (fromEnv != null && !fromEnv.trim().isEmpty()) {
      return fromEnv.trim()
    }
    def fromProp = providers.gradleProperty('nodeExecutable').orNull
    if (fromProp != null && !fromProp.trim().isEmpty()) {
      return fromProp.trim()
    }
    if (System.getProperty('os.name').toLowerCase().contains('windows')) {
      def candidates = [
        'C:\\\\Program Files\\\\nodejs\\\\node.exe',
        System.getenv('LOCALAPPDATA') + '\\\\fnm_multishells\\\\node.exe',
        System.getenv('APPDATA') + '\\\\nvm\\\\node.exe',
      ]
      for (def candidate : candidates) {
        if (candidate != null && new File(candidate).exists()) {
          return candidate
        }
      }
      def nvmHome = System.getenv('NVM_HOME')
      if (nvmHome != null) {
        def nvmNode = new File(nvmHome, 'nodejs\\\\node.exe')
        if (nvmNode.exists()) {
          return nvmNode.absolutePath
        }
      }
    }
    return 'node'
  }
  def flipNodeExecutable = flipResolveNodeExecutable()
`;

function patchSettingsGradle(src) {
  if (src.includes('flipResolveNodeExecutable')) {
    return src;
  }

  if (!src.includes('pluginManagement {')) {
    return null;
  }

  let next = src.replace('pluginManagement {', NODE_RESOLVER);
  next = next.replace(/commandLine\("node",/g, 'commandLine(flipNodeExecutable,');

  return next;
}

function patchGradleProperties() {
  const propsFile = path.join(__dirname, '..', 'android', 'gradle.properties');
  if (!fs.existsSync(propsFile)) {
    return;
  }

  const nodeExe = process.platform === 'win32' ? 'C:\\\\Program Files\\\\nodejs\\\\node.exe' : '';
  if (!nodeExe || !fs.existsSync(nodeExe.replace(/\\\\/g, '\\'))) {
    return;
  }

  let src = fs.readFileSync(propsFile, 'utf8');
  const line = `nodeExecutable=${nodeExe}`;
  if (src.includes('nodeExecutable=')) {
    return;
  }

  src = src.replace(
    '# Project-wide Gradle settings.\n',
    `# Project-wide Gradle settings.\n\n# Node for Gradle autolinking (Windows PATH workaround)\n${line}\n`,
  );
  fs.writeFileSync(propsFile, src);
  console.log('[patch-android-node] Set nodeExecutable in android/gradle.properties');
}

function patchAppBuildGradle(src) {
  if (src.includes('flipNodeCmd')) {
    return src;
  }

  if (!src.includes('def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()')) {
    return null;
  }

  let next = src.replace(
    'def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()\n',
    `def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()\n\ndef flipNodeCmd() {\n    def fromProp = findProperty('nodeExecutable')\n    if (fromProp != null && !fromProp.toString().trim().isEmpty()) {\n        return fromProp.toString().trim()\n    }\n    return 'node'\n}\ndef flipNode = flipNodeCmd()\n\n`,
  );

  next = next.replace(
    'react {\n    entryFile = file(["node",',
    'react {\n    nodeExecutableAndArgs = [flipNode]\n    entryFile = file([flipNode,',
  );
  next = next.replace(/\["node",/g, '[flipNode,');

  return next;
}

function patchAppBuildGradleFile() {
  const appBuildFile = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
  if (!fs.existsSync(appBuildFile)) {
    return;
  }

  const src = fs.readFileSync(appBuildFile, 'utf8');
  const next = patchAppBuildGradle(src);
  if (next && next !== src) {
    fs.writeFileSync(appBuildFile, next);
    console.log('[patch-android-node] Patched android/app/build.gradle for Node resolution');
  }
}

function patchGradlewBat() {
  const gradlewBat = path.join(__dirname, '..', 'android', 'gradlew.bat');
  if (!fs.existsSync(gradlewBat)) {
    return;
  }

  const marker = 'Flip: ensure Node.js is on PATH';
  let src = fs.readFileSync(gradlewBat, 'utf8');
  if (src.includes(marker)) {
    return;
  }

  src = src.replace(
    'if "%OS%"=="Windows_NT" setlocal\r\n\r\nset DIRNAME=%~dp0',
    `if "%OS%"=="Windows_NT" setlocal\r\n\r\n@rem Flip: ensure Node.js is on PATH for Gradle (Windows daemon often omits it)\r\nif exist "C:\\Program Files\\nodejs\\node.exe" (\r\n  set "PATH=C:\\Program Files\\nodejs;%PATH%"\r\n)\r\nif not defined NODE_BINARY if exist "C:\\Program Files\\nodejs\\node.exe" (\r\n  set "NODE_BINARY=C:\\Program Files\\nodejs\\node.exe"\r\n)\r\n\r\nset DIRNAME=%~dp0`,
  );
  src = src.replace(
    'if "%OS%"=="Windows_NT" setlocal\n\nset DIRNAME=%~dp0',
    `if "%OS%"=="Windows_NT" setlocal\n\n@rem Flip: ensure Node.js is on PATH for Gradle (Windows daemon often omits it)\nif exist "C:\\Program Files\\nodejs\\node.exe" (\n  set "PATH=C:\\Program Files\\nodejs;%PATH%"\n)\nif not defined NODE_BINARY if exist "C:\\Program Files\\nodejs\\node.exe" (\n  set "NODE_BINARY=C:\\Program Files\\nodejs\\node.exe"\n)\n\nset DIRNAME=%~dp0`,
  );

  fs.writeFileSync(gradlewBat, src);
  console.log('[patch-android-node] Patched android/gradlew.bat for Node PATH');
}

function patchExpoAutolinkingNode() {
  const expoPluginRoot = path.join(
    __dirname,
    '..',
    'node_modules',
    'expo-modules-autolinking',
    'android',
    'expo-gradle-plugin',
  );
  if (!fs.existsSync(expoPluginRoot)) {
    return;
  }

  const osKt = path.join(
    expoPluginRoot,
    'expo-autolinking-plugin-shared',
    'src',
    'main',
    'kotlin',
    'expo',
    'modules',
    'plugin',
    'Os.kt',
  );
  if (fs.existsSync(osKt)) {
    const osSrc = fs.readFileSync(osKt, 'utf8');
    if (!osSrc.includes('resolveNodeExecutable')) {
      // Insert import and resolveNodeExecutable() after the object opening brace.
      // This avoids depending on the exact isWindows() function signature which
      // can vary across expo-modules-autolinking versions (e.g. `= expr` vs `=> expr`).
      const nextOs = osSrc.replace(
        'package expo.modules.plugin\n\nobject Os {',
        `package expo.modules.plugin\n\nimport java.io.File\n\nobject Os {\n  fun resolveNodeExecutable(): String {\n    System.getenv("NODE_BINARY")?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }\n    if (isWindows()) {\n      val candidates = listOf(\n        "C:\\\\Program Files\\\\nodejs\\\\node.exe",\n        System.getenv("LOCALAPPDATA")?.let { "$it\\\\fnm_multishells\\\\node.exe" },\n        System.getenv("APPDATA")?.let { "$it\\\\nvm\\\\node.exe" },\n        System.getenv("NVM_HOME")?.let { "$it\\\\nodejs\\\\node.exe" },\n      )\n      for (candidate in candidates) {\n        if (candidate != null && File(candidate).exists()) {\n          return candidate\n        }\n      }\n    }\n    return "node"\n  }`,
      );
      if (nextOs !== osSrc) {
        fs.writeFileSync(osKt, nextOs);
        console.log('[patch-android-node] Patched expo Os.kt for Node resolution');
      } else {
        console.warn('[patch-android-node] WARNING: Could not patch Os.kt — object header not found');
      }
    }
  }

  const replacements = [
  [
    path.join(expoPluginRoot, 'expo-autolinking-plugin-shared', 'src', 'main', 'kotlin', 'expo', 'modules', 'plugin', 'AutolinkingCommandBuilder.kt'),
    ['    "node",', '    Os.resolveNodeExecutable(),'],
  ],
  [
    path.join(expoPluginRoot, 'expo-autolinking-settings-plugin', 'src', 'main', 'kotlin', 'expo', 'modules', 'plugin', 'ExpoAutolinkingSettingsExtension.kt'),
    [
      ['env.commandLine("node",', 'env.commandLine(Os.resolveNodeExecutable(),'],
    ],
  ],
  [
    path.join(expoPluginRoot, 'expo-autolinking-settings-plugin', 'src', 'main', 'kotlin', 'expo', 'modules', 'plugin', 'ExpoAutolinkingSettingsPlugin.kt'),
    [
      ['env.commandLine("node",', 'env.commandLine(Os.resolveNodeExecutable(),'],
    ],
  ],
  [
    path.join(expoPluginRoot, 'expo-autolinking-plugin', 'src', 'main', 'kotlin', 'expo', 'modules', 'plugin', 'ExpoAutolinkingPlugin.kt'),
    [
      ['            "node",', '            Os.resolveNodeExecutable(),'],
    ],
  ],
  ];

  for (const [file, pairs] of replacements) {
    if (!fs.existsSync(file)) {
      continue;
    }
    let src = fs.readFileSync(file, 'utf8');
    let changed = false;
    for (const [from, to] of pairs) {
      if (src.includes(from) && !src.includes('Os.resolveNodeExecutable()')) {
        src = src.replace(from, to);
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(file, src);
      console.log(`[patch-android-node] Patched ${path.basename(file)}`);
    }
  }
}

function ensureLocalProperties() {
  const propsFile = path.join(__dirname, '..', 'android', 'local.properties');
  const sdkDir = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!sdkDir || !fs.existsSync(sdkDir)) {
    return;
  }

  const escaped = sdkDir.replace(/\\/g, '\\\\');
  const content = `sdk.dir=${escaped}\n`;
  if (fs.existsSync(propsFile)) {
    const existing = fs.readFileSync(propsFile, 'utf8');
    if (existing.includes('sdk.dir=')) {
      return;
    }
    fs.appendFileSync(propsFile, content);
  } else {
    fs.writeFileSync(propsFile, content);
  }
  console.log('[patch-android-node] Wrote android/local.properties sdk.dir');
}

if (!fs.existsSync(settingsFile)) {
  process.exit(0);
}

const src = fs.readFileSync(settingsFile, 'utf8');
const next = patchSettingsGradle(src);

if (next && next !== src) {
  fs.writeFileSync(settingsFile, next);
  console.log('[patch-android-node] Patched android/settings.gradle for Node resolution');
}

patchGradleProperties();
ensureLocalProperties();
patchAppBuildGradleFile();
patchGradlewBat();
patchExpoAutolinkingNode();
