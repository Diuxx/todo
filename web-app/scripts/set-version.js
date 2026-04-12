#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = process.cwd();

const packageJsonPath = path.join(root, 'package.json');
const envPaths = [
  path.join(root, 'src', 'env', 'env.ts'),
  path.join(root, 'src', 'env', 'env.dev.ts'),
  path.join(root, 'src', 'env', 'env.prd.ts'),
];
const androidGradlePath = path.join(root, 'android', 'app', 'build.gradle');

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`File not found: ${filePath}`);
  }

  return fs.readFileSync(filePath, 'utf8');
}

function writeText(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function updateEnvFile(filePath, appVersion) {
  const source = readText(filePath);
  const pattern = /(appVersion\s*:\s*')[^']*(')/;

  if (!pattern.test(source)) {
    fail(`Could not find appVersion in ${filePath}`);
  }

  const replaced = source.replace(pattern, `$1${appVersion}$2`);

  writeText(filePath, replaced);
}

function updateAndroidGradle(filePath, versionName, explicitVersionCode) {
  const source = readText(filePath);

  const versionCodeMatch = source.match(/versionCode\s+(\d+)/);
  if (!versionCodeMatch) {
    fail(`Could not find versionCode in ${filePath}`);
  }

  const currentVersionCode = Number.parseInt(versionCodeMatch[1], 10);
  if (!Number.isFinite(currentVersionCode)) {
    fail(`Invalid current versionCode in ${filePath}`);
  }

  const nextVersionCode = explicitVersionCode ?? currentVersionCode + 1;

  if (!Number.isInteger(nextVersionCode) || nextVersionCode <= 0) {
    fail('Android versionCode must be a positive integer.');
  }

  let replaced = source.replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);
  replaced = replaced.replace(/versionCode\s+\d+/, `versionCode ${nextVersionCode}`);

  writeText(filePath, replaced);
  return nextVersionCode;
}

function updatePackageVersion(filePath, version) {
  const pkg = JSON.parse(readText(filePath));
  pkg.version = version;
  writeText(filePath, `${JSON.stringify(pkg, null, 2)}\n`);
}

function main() {
  const versionArg = process.argv[2];
  const versionCodeArg = process.argv[3];

  if (!versionArg) {
    fail('Missing version. Usage: npm run version:set -- <version> [androidVersionCode]');
  }

  const semverLike = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
  if (!semverLike.test(versionArg)) {
    fail(`Invalid version format: ${versionArg}. Expected format like 1.2.3`);
  }

  let explicitVersionCode;
  if (versionCodeArg != null) {
    explicitVersionCode = Number.parseInt(versionCodeArg, 10);
    if (!Number.isInteger(explicitVersionCode) || explicitVersionCode <= 0) {
      fail('androidVersionCode must be a positive integer.');
    }
  }

  updatePackageVersion(packageJsonPath, versionArg);
  envPaths.forEach((envPath) => updateEnvFile(envPath, versionArg));
  const appliedVersionCode = updateAndroidGradle(androidGradlePath, versionArg, explicitVersionCode);

  console.log('Version update complete.');
  console.log(`- package.json: ${versionArg}`);
  console.log(`- env.ts files appVersion: ${versionArg}`);
  console.log(`- android/app/build.gradle versionName: ${versionArg}`);
  console.log(`- android/app/build.gradle versionCode: ${appliedVersionCode}`);
}

main();
