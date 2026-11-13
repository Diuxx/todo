# Project Reference

## Purpose

Todo is a local-first personal organizer for tasks, recurring checklists, notes, quotations and budget tracking. It ships as an Angular web application and an Android app through Capacitor.

## Technology

- Angular 20 and TypeScript 5.9, standalone components and RxJS.
- SCSS, Bootstrap 5, Bootstrap Icons, Chart.js.
- Dexie 4 / IndexedDB with the application database at schema version 5.
- Capacitor 7 for Android integration, local notifications and filesystem/share APIs.
- npm and Angular CLI for development and packaging.

The Angular project lives in `web-app/`, which is the working directory for npm commands.

## Main modules

- `src/app/features/dashboard`: item navigation, filters and home view.
- `src/app/features/item-detail`: item editing and locked-item interaction.
- `src/app/features/calendar`: calendar presentation and date-based items.
- `src/app/features/budget`: budgeting views, periods and settings.
- `src/app/features/history-recap`: completion history and reports.
- `src/app/features/settings`: preferences, local password and JSON data import/export.
- `src/app/shared/services`: data access, history, local notifications and application settings.
- `src/app/shared/models`: item, budget, settings and backup contracts.
- `src/app/db.config.ts`: IndexedDB tables and historical Dexie upgrades.

## Data and compatibility constraints

- User data is local to the current browser profile or Android installation.
- Historical Dexie versions 1, 3, 4 and 5 must be maintained when schema evolves; never replace them with an untested single version.
- Do not silently overwrite budgets, items, history or settings during initialization or restore.
- Backup import accepts older payloads without a budget and migrates them to a default budget. Any other format changes require versioned compatibility tests.
- Personal password hashes use a salted PBKDF2-SHA256 representation. Legacy SHA-256 hashes can still be verified during migration, but the former shared default must not be used for new installations.
- The local password provides application-level access control, **not** encryption of IndexedDB or exported JSON.
- Android signing keys and passwords must stay outside the repository. A previously committed signing key is considered exposed until rotated.

## Conventions

- Favor existing Angular services and components; extract isolated logic when it makes testing and responsibilities clearer.
- Keep imports, UI flows and persistence compatible unless a migration is carefully planned.
- Use Dexie transactions for multi-table changes.
- Surface storage and migration errors instead of silently replacing data.
- Preserve current French UI wording where functionality has not been changed.
- Write all Markdown documentation in English.
- Treat `README.md` as a short overview; keep operational instructions in `docs/USAGE.md`.
- Add focused tests for password, backup import and schema changes before modifying destructive operations.

## Entry points

- Web: `web-app/src/main.ts` → `app/app.config.ts` / `app/app.routes.ts`.
- Local database: `web-app/src/app/db.config.ts` and `DatabaseService.init()`.
- Android packaging: `web-app/capacitor.config.ts`, `web-app/android/`.
- Verification: `npm run build`, `npm run test`, `npm run format:check` (from `web-app/`).

See [USAGE.md](USAGE.md) for developer commands and [CODE_AUDIT.md](CODE_AUDIT.md) for known risks.
