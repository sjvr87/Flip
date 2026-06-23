/**
 * Patches React Native Gradle plugin for Windows + Gradle 9 builds.
 * - foojay-resolver-convention 0.5.0 breaks on Gradle 9 (IBM_SEMERU removed)
 * - RN gradle-plugin requires JDK 17 toolchain; register Temurin 17 path
 * @see https://github.com/facebook/react-native/issues/55781
 */
const fs = require('fs');
const path = require('path');

const WINDOWS_JDK17 = 'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.19.10-hotspot';
const localJavaHome =
  process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)
    ? process.env.JAVA_HOME
    : WINDOWS_JDK17;
const JDK17 = process.platform === 'win32' ? localJavaHome.replace(':', '\\:').replaceAll('\\', '\\\\') : localJavaHome;
const javaBlock = `org.gradle.java.home=${JDK17}
org.gradle.java.installations.auto-download=false
org.gradle.java.installations.paths=${JDK17}
`;

const settingsFile = path.join(
  __dirname,
  '..',
  'node_modules',
  '@react-native',
  'gradle-plugin',
  'settings.gradle.kts',
);

if (fs.existsSync(settingsFile)) {
  const src = fs.readFileSync(settingsFile, 'utf8');
  const next = src
    .replace(
      'plugins { id("org.gradle.toolchains.foojay-resolver-convention").version("0.5.0") }',
      '',
    )
    .replace(
      'plugins { id("org.gradle.toolchains.foojay-resolver-convention").version("1.0.0") }',
      '',
    );
  if (next !== src) {
    fs.writeFileSync(settingsFile, next);
    console.log('[patch-foojay-gradle] Removed foojay-resolver-convention plugin block');
  }
}

const gradlePluginBuildFile = path.join(
  __dirname,
  '..',
  'node_modules',
  '@react-native',
  'gradle-plugin',
  'build.gradle.kts',
);
if (fs.existsSync(gradlePluginBuildFile)) {
  const src = fs.readFileSync(gradlePluginBuildFile, 'utf8');
  const next = src
    .replace('  alias(libs.plugins.ktfmt).apply(true)\n', '')
    .replace(/\ntasks\.named\("ktfmtCheck"\) \{[\s\S]*?\n\}\n/, '\n')
    .replace(/\ntasks\.named\("ktfmtFormat"\) \{[\s\S]*?\n\}\n/, '\n')
    .replace(
      /\n\/\/ We intentionally disable the `ktfmtCheck` tasks[\s\S]*?allprojects \{ tasks\.withType<com\.ncorti\.ktfmt\.gradle\.tasks\.KtfmtCheckTask>\(\) \{ enabled = false \} \}\n/,
      '\n',
    );
  if (next !== src) {
    fs.writeFileSync(gradlePluginBuildFile, next);
    console.log('[patch-foojay-gradle] Removed ktfmt plugin usage from react-native gradle-plugin build');
  }
}

const ktfmtBuildFiles = [
  path.join(__dirname, '..', 'node_modules', '@react-native', 'gradle-plugin', 'react-native-gradle-plugin', 'build.gradle.kts'),
  path.join(__dirname, '..', 'node_modules', '@react-native', 'gradle-plugin', 'settings-plugin', 'build.gradle.kts'),
  path.join(__dirname, '..', 'node_modules', '@react-native', 'gradle-plugin', 'shared', 'build.gradle.kts'),
  path.join(__dirname, '..', 'node_modules', '@react-native', 'gradle-plugin', 'shared-testutil', 'build.gradle.kts'),
];

for (const file of ktfmtBuildFiles) {
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  const next = src.replace('  alias(libs.plugins.ktfmt)\n', '');
  if (next !== src) {
    fs.writeFileSync(file, next);
    console.log(`[patch-foojay-gradle] Removed ktfmt plugin alias from ${path.relative(path.join(__dirname, '..'), file)}`);
  }
}

const gradlePluginProps = path.join(
  __dirname,
  '..',
  'node_modules',
  '@react-native',
  'gradle-plugin',
  'gradle.properties',
);
if (fs.existsSync(path.dirname(gradlePluginProps))) {
  fs.writeFileSync(gradlePluginProps, javaBlock);
}

const androidGradleProps = path.join(__dirname, '..', 'android', 'gradle.properties');
if (fs.existsSync(androidGradleProps)) {
  let androidSrc = fs.readFileSync(androidGradleProps, 'utf8');
  androidSrc = androidSrc.replace(
    /# Use JDK 17.*?\norg\.gradle\.java\.installations\.paths=.*?\n/s,
    '',
  );
  androidSrc = androidSrc.replace(
    /# Use Android Studio.*?\norg\.gradle\.java\.home=.*?\n/s,
    '',
  );
  if (!androidSrc.includes('org.gradle.java.installations.paths')) {
    androidSrc = androidSrc.replace(
      '# Project-wide Gradle settings.\n',
      `# Project-wide Gradle settings.\n\n# Use JDK 17 (RN gradle-plugin jvmToolchain)\n${javaBlock}`,
    );
    fs.writeFileSync(androidGradleProps, androidSrc);
    console.log('[patch-foojay-gradle] Set JDK 17 in android/gradle.properties');
  }
}
