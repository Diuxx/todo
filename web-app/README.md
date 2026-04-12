# Todo Web App

Application Todo/Notes/Citations développée avec Angular + Capacitor, avec stockage local IndexedDB (Dexie), notifications locales Android, protection par mot de passe, historique des tâches et export/import des données.

## Stack technique

- Frontend: Angular 20
- Mobile wrapper: Capacitor 7
- UI: Bootstrap 5 + Bootstrap Icons
- Graphiques: Chart.js
- Base locale: Dexie (IndexedDB)
- Cible mobile incluse: Android

## Versions du projet

- App version: `1.0.2`
- Angular core: `^20.3.18`
- Angular CLI: `^20.3.22`
- TypeScript: `~5.9.3`
- Capacitor core/android/cli: `^7.4.3`
- Dexie: `^4.4.2`
- Chart.js: `^4.5.0`

## Prérequis logiciels

- Node.js LTS (recommandé: 20.x)
- npm (fourni avec Node.js)
- Git
- Android Studio (pour build/run Android)
- Java JDK 17 (recommandé avec Android Gradle Plugin 8.x)

## Configuration Android requise

- `compileSdkVersion`: `35`
- `targetSdkVersion`: `35`
- `minSdkVersion`: `23`
- Android Gradle Plugin: `8.7.2`

Ces versions sont déjà configurées dans `android/variables.gradle` et `android/build.gradle`.

## Installation du projet (premier démarrage)

```bash
npm install
```

## Lancement en développement (web)

```bash
npm run start
```

Infos utiles:

- URL locale: `http://localhost:4973`
- Port configuré dans `angular.json`

## Build web

```bash
npm run build
```

Sortie: `dist/todo/browser`

## Tests

```bash
npm run test
```

## Scripts disponibles

- `npm run start`: lance le serveur Angular en mode dev
- `npm run build`: build de production web
- `npm run watch`: build en watch mode dev
- `npm run test`: tests unitaires (Karma)
- `npm run build:sync`: build web puis sync Capacitor
- `npm run android:assemble:release`: lance Gradle `assembleRelease`
- `npm run apk:release`: commande unique pour generer l'APK release
- `npm run android:assemble:release:signed`: assemble release signe (si signature configuree)
- `npm run apk:release:signed`: build+sync+APK release signe
- `npm run version:set -- <version> [androidVersionCode]`: met a jour la version partout

Exemples:

```bash
# Met a jour package.json + env*.ts + versionName Android,
# et incremente automatiquement versionCode Android
npm run version:set -- 1.0.2

# Meme chose avec un versionCode explicite
npm run version:set -- 1.0.3 3
```

## Android: initialisation et lancement

Utiliser ce flow la première fois sur une machine:

```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

Ensuite, au quotidien:

```bash
npm run build
npx cap sync android
npx cap open android
```

Flow court équivalent:

```bash
npm run build:sync
npx cap open android
```

## Generer un APK release (une seule commande)

```bash
npm run apk:release
```

Cette commande enchaine:

1. build web Angular
2. sync Capacitor vers Android
3. `assembleRelease` via Gradle

Sortie APK (par defaut):

- `android/app/build/outputs/apk/release/app-release-unsigned.apk`

Note:

- Avec la configuration actuelle, l'APK release genere est non signe (`unsigned`).
- Pour publier sur Play Store ou distribuer en production, il faut ajouter une `signingConfig` release dans `android/app/build.gradle` (keystore, alias, mots de passe).
- Le script `npm run apk:release` force un JDK compatible (17/21), prioritairement celui d'Android Studio (`jbr`).

## Generer un APK release signe

1. Generer un keystore (une seule fois), exemple:

```bash
keytool -genkeypair -v -keystore android/my-release-key.jks -alias todo_release -keyalg RSA -keysize 2048 -validity 10000
```

2. Creer `android/keystore.properties` a partir de `android/keystore.properties.example`.

3. Lancer la commande:

```bash
npm run apk:release:signed
```

Option sans modifier `android/keystore.properties` (credentials en parametres):

```bash
npm run apk:release:signed -- --store-file ../my-release-key.keystore --key-alias todo_release --store-password "STORE_PASSWORD" --key-password "KEY_PASSWORD"
```

Option via variables d'environnement:

```bash
# PowerShell
$env:ANDROID_SIGNING_STORE_FILE="../my-release-key.keystore"
$env:ANDROID_SIGNING_KEY_ALIAS="todo_release"
$env:ANDROID_SIGNING_STORE_PASSWORD="STORE_PASSWORD"
$env:ANDROID_SIGNING_KEY_PASSWORD="KEY_PASSWORD"
npm run apk:release:signed
```

Sortie attendue (APK signe):

- `android/app/build/outputs/apk/release/app-release.apk`

Attention securite:

- Evite de mettre les mots de passe en clair dans l'historique shell.
- Prefere `android/keystore.properties` local (non committe) ou les variables d'environnement temporaires.

## Réinstallation / resynchronisation Android

En cas de souci de projet natif Android désynchronisé:

```bash
npm install
npx cap update android
npx cap sync android
```

## Architecture fonctionnelle (résumé)

- Dashboard: liste des items + filtres (todo/note/citation)
- Détail item: édition, favoris, verrouillage
- Settings: préférences, mot de passe, sauvegarde/restauration
- Recap: historique des todos
- Notifications locales: rappels todo (plugin Capacitor)

## Routes principales

- `/`: dashboard
- `/item/:id`: détail d'un item
- `/settings`: paramètres
- `/recap`: récapitulatif historique

## Données locales

- Base IndexedDB: `todo-db`
- Version schéma DB: `1`
- Tables:
- `items`
- `todoHistory`
- `citationsMeta`
- `imagesMeta`
- `settings`

## Capacitor

- `appId`: `com.diuxx.todo`
- `appName`: `Todo`
- `webDir`: `dist/todo/browser`
- Plugin local notifications configuré (icône/couleur)

## Conseils de développement

- Toujours lancer un `npm run build` avant `npx cap sync android`
- Si des assets web changent, re-sync Android
- Vérifier les permissions notifications sur Android lors des tests

## Dépannage rapide

- Problème dépendances: supprimer `node_modules` + `package-lock.json`, puis `npm install`
- Problème Android sync: `npx cap update android` puis `npx cap sync android`
- Problème build Angular: vérifier version Node.js (20.x recommandé)
- Erreur Gradle `Unsupported class file major version 70`: vous utilisez Java 26. Relancer avec `npm run apk:release` (script avec JDK 17/21) ou configurer `JAVA17_HOME` / `JAVA21_HOME`.

## Structure de dossier (repères)

- `src/app/features`: écrans (dashboard, item-detail, settings, recap)
- `src/app/shared`: composants/services/models partagés
- `src/env`: variables d'environnement et version app
- `android/`: projet natif Android Capacitor
- `public/`: assets statiques web

## Licence

Projet privé.
