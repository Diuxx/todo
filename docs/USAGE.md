# Usage and Development

## Requirements

- Node.js compatible with Angular 20 (use an officially supported version, such as Node.js 22 LTS).
- npm and Git.
- For Android builds: Android Studio, Android SDK compatible with target SDK 35 and JDK 17 or 21.
- A browser with IndexedDB support.

## Installation and local development

Run all npm commands from the Angular project directory:

```bash
cd web-app
npm install
npm run start
```

The configured development server port is **4973**, so open `http://localhost:4973`.

## Web build and checks

```bash
npm run build
npm run test
npm run format:check
```

The web build output is `web-app/dist/todo/browser`. The test command uses Angular's Karma configuration and requires a suitable browser environment.

## Android packaging

The Android native project already exists in `web-app/android/`. Do not run `npx cap add android` when using an existing checkout.

```bash
npm run build:sync
npx cap open android
```

For an unsigned release APK:

```bash
npm run apk:release
```

For a signed release APK, configure local signing credentials using `android/keystore.properties.example` and run:

```bash
npm run apk:release:signed
```

Never commit the actual signing key, passwords or `keystore.properties`. A historical release key was exposed in Git history; rotate it before relying on it for distribution.

## Data and backup

App data is stored locally in Dexie (IndexedDB): `items`, `todoHistory`, `citationsMeta`, `imagesMeta`, `budgets` and `settings`. The active schema version is **5**.

The Settings screen lets you export application data to JSON and import a JSON backup. Import replaces current local records after confirmation. Verify that you have a usable backup before importing. Imported files must pass structural validation and cannot exceed 10 MiB. Legacy backups without a `budget` are supported by inserting a default budget.

Backups are **not encrypted**. Store exported files securely. Removing browser/site data can delete the local database.

## Local password

Set a personal password of at least 12 characters in Settings before performing sensitive export, import or delete operations. New passwords use PBKDF2-SHA256 with a random salt. Older personalized SHA-256 password hashes remain accepted and are upgraded after successful item unlock.

Previously installed versions used a shared default password. Such installations should be upgraded to a personal password. The password lock is a UI protection; it does not encrypt IndexedDB or JSON backups, nor protect against a user with full local device/storage access.

## Versioning

```bash
npm run version:set -- 1.3.1
```

The version script updates project version declarations and Android version metadata. Verify the resulting diff before releasing.

## Known limitations

- No automatic synchronization of application data across devices is established by the current source.
- Offline storage still depends on the browser profile/device remaining intact.
- Native notifications need Android permission and device testing.
- Migration of existing IndexedDB databases must be tested against real older builds.
- The local password does not provide encryption at rest.
- Restoring a backup replaces current data; there is no automated cloud recovery.

## Troubleshooting

- If the development server does not launch, verify Node.js and npm versions, then reinstall dependencies.
- After updating web assets, run `npm run build:sync` before opening/building Android.
- If Android reports a Java class-file compatibility error, check the JDK selected by Android Studio or the APK build script.
- On import errors, keep the original backup file and consult the browser/Android logs rather than repeatedly retrying destructive restoration.

For architectural constraints see [PROJECT.md](PROJECT.md). For audit details see [CODE_AUDIT.md](CODE_AUDIT.md).
