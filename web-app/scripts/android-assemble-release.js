#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const gradleWrapper = path.join(root, 'android', 'gradlew.bat');
const signedMode = process.argv.includes('--signed');

function getArgValue(flagName) {
  const index = process.argv.indexOf(flagName);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

function existsDir(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function findSupportedJavaHome() {
  const candidates = [
    process.env.JAVA17_HOME,
    process.env.JAVA21_HOME,
    process.env.JAVA_HOME_17_X64,
    process.env.JAVA_HOME_21_X64,
    'C:\\Program Files\\Android\\Android Studio\\jbr',
    'C:\\Program Files\\Java\\jdk-21',
    'C:\\Program Files\\Java\\jdk-17',
  ].filter(Boolean);

  return candidates.find((candidate) => existsDir(candidate));
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(gradleWrapper)) {
  fail(`Missing Gradle wrapper: ${gradleWrapper}`);
}

const javaHome = findSupportedJavaHome();
if (!javaHome) {
  fail(
    'No supported JDK found (expected Java 17 or 21). Install Android Studio or define JAVA17_HOME/JAVA21_HOME.'
  );
}

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  PATH: `${path.join(javaHome, 'bin')};${process.env.PATH || ''}`,
};

console.log(`Using JAVA_HOME: ${javaHome}`);

const gradleArgs = ['assembleRelease'];

if (signedMode) {
  gradleArgs.push('-PrequireSigning=true');

  const signingStoreFile = getArgValue('--store-file') ?? process.env.ANDROID_SIGNING_STORE_FILE;
  const signingStorePassword = getArgValue('--store-password') ?? process.env.ANDROID_SIGNING_STORE_PASSWORD;
  const signingKeyAlias = getArgValue('--key-alias') ?? process.env.ANDROID_SIGNING_KEY_ALIAS;
  const signingKeyPassword = getArgValue('--key-password') ?? process.env.ANDROID_SIGNING_KEY_PASSWORD;

  if (signingStoreFile) {
    gradleArgs.push(`-PsigningStoreFile=${signingStoreFile}`);
  }
  if (signingStorePassword) {
    gradleArgs.push(`-PsigningStorePassword=${signingStorePassword}`);
  }
  if (signingKeyAlias) {
    gradleArgs.push(`-PsigningKeyAlias=${signingKeyAlias}`);
  }
  if (signingKeyPassword) {
    gradleArgs.push(`-PsigningKeyPassword=${signingKeyPassword}`);
  }
}

const result = spawnSync(
  'cmd.exe',
  ['/c', gradleWrapper, ...gradleArgs],
  {
    cwd: path.join(root, 'android'),
    stdio: 'inherit',
    env,
  }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(signedMode ? 'Signed release APK build completed.' : 'Release APK build completed.');
console.log('Output folder: android/app/build/outputs/apk/release/');
