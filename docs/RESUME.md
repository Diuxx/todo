# Development Resume

## What this project does

Todo is an Angular/Capacitor local-first personal organization application for tasks, notes, citations, calendars, recurring-task history and personal budgets. It runs in a browser and in an Android WebView.

## Architecture at a glance

- `web-app/src/app/features/`: page-level Angular components.
- `web-app/src/app/shared/`: reusable UI, types, services and utilities.
- `web-app/src/app/db.config.ts`: Dexie / IndexedDB schema, historical upgrades.
- `web-app/src/app/shared/services/database.service.ts`: first-run initialization.
- `web-app/src/app/features/settings/settings.component.ts`: settings forms, password controls and confirmation dialogs.
- `web-app/src/app/shared/services/backup.service.ts`: backup data validation, migration, import transactions and storage statistics.
- `web-app/src/app/shared/services/backup-file.service.ts`: browser downloads and Android backup sharing.
- `web-app/src/app/shared/services/items.service.ts`: item persistence, transactional cleanup of related history and metadata, notification synchronization.
- `web-app/src/app/features/item-detail/item-detail.component.ts`: serialized autosave writes with pending changes preserved.
- `web-app/src/app/shared/services/budget.service.ts`: atomic period mutations and expense/income reference normalization.
- `web-app/src/app/shared/services/local-notification.service.ts`: recurring reminders and supported custom weekday schedules.
- `web-app/src/app/shared/utils/backup-validation.ts`: imported JSON structure validation.
- `web-app/src/app/shared/services/password.service.ts`: PBKDF2 hashing and legacy SHA-256 verification.
- `web-app/src/app/shared/services/item-lock.service.ts`: in-memory item unlock state.

## Runtime data flow

Angular pages call injectable services. Services read/write Dexie tables for items, todo history, citation/image metadata, budgets and settings. Todo completion status is derived from history by recurrence window. Capacitor plugins synchronize local notifications and support Android backup sharing.

## Decisions and constraints

- Local-only data; no verified live backend synchronization.
- Multi-table restore uses a Dexie transaction; deleting items or subtasks also removes their related records transactionally.
- Schema migrations from Dexie 1 → 3 → 4 → 5 have been restored from Git history and require testing against actual historical databases.
- New passwords use salted PBKDF2; older SHA-256 hashes remain verifiable while migrating.
- App-level password is not encryption at rest. JSON backups are unencrypted.
- Never commit Android signing credentials.

## Next engineering priorities

1. Execute Angular and Android validation on a checkout with dependencies.
2. Test real database upgrades from previously distributed versions.
3. Test imports using exported backups and corrupted/oversized inputs.
4. Strengthen security and recovery UX, particularly legacy default-password installations.
5. Validate recurring reminders and startup recovery on Android and real browsers; extend support for additional custom cron patterns deliberately.

Read [PROJECT.md](PROJECT.md) for project conventions and [CODE_AUDIT.md](CODE_AUDIT.md) for audit findings.
