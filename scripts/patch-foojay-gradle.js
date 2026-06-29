/**
 * Patches React Native Gradle plugin for Windows + Gradle 9 builds.
 * - foojay-resolver-convention 0.5.0 breaks on Gradle 9 (IBM_SEMERU removed)
 * - RN gradle-plugin requires JDK 17 toolchain; register Temurin 17 path
 * @see https://github.com/facebook/react-native/issues/55781
 */
const fs = require('fs');
const path = require('path');

const isWindows = process.platform === 'win32';
const JDK17 = 'C\\:\\\\Program Files\\\\Eclipse Adoptium\\\\jdk-17.0.19.10-hotspot';
const javaBlock = isWindows
  ? `org.gradle.java.home=${JDK17}
org.gradle.java.installations.auto-download=false
org.gradle.java.installations.paths=${JDK17}
`
  : '';

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
  const next = src.replace(
    'foojay-resolver-convention").version("0.5.0")',
    'foojay-resolver-convention").version("1.0.0")',
  );
  if (next !== src) {
    fs.writeFileSync(settingsFile, next);
    console.log('[patch-foojay-gradle] Updated foojay-resolver-convention to 1.0.0');
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
if (isWindows && fs.existsSync(path.dirname(gradlePluginProps))) {
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
  // Strip Windows-only JDK paths so Linux CI uses JAVA_HOME from the runner.
  androidSrc = androidSrc.replace(
    /# Use JDK 17 \(RN gradle-plugin jvmToolchain\)\norg\.gradle\.java\.home=.*?\norg\.gradle\.java\.installations\.auto-download=.*?\norg\.gradle\.java\.installations\.paths=.*?\n\n?/s,
    '',
  );
  androidSrc = androidSrc.replace(
    /org\.gradle\.java\.home=C\\:\\\\Program Files\\\\Eclipse Adoptium\\\\jdk-.*?\n/g,
    '',
  );
  androidSrc = androidSrc.replace(
    /org\.gradle\.java\.installations\.auto-download=false\n/g,
    '',
  );
  androidSrc = androidSrc.replace(
    /org\.gradle\.java\.installations\.paths=C\\:\\\\Program Files\\\\Eclipse Adoptium\\\\jdk-.*?\n/g,
    '',
  );

  if (isWindows && javaBlock && !androidSrc.includes('org.gradle.java.installations.paths')) {
    androidSrc = androidSrc.replace(
      '# Project-wide Gradle settings.\n',
      `# Project-wide Gradle settings.\n\n# Use JDK 17 (RN gradle-plugin jvmToolchain)\n${javaBlock}`,
    );
    console.log('[patch-foojay-gradle] Set JDK 17 in android/gradle.properties');
  }

  fs.writeFileSync(androidGradleProps, androidSrc);
}
