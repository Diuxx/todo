# Code audit — Todo

Audit date: 2026-11-13  
Base branch: `develop` (commit `6d30f519fd165a706931f35b49d27bbf8c26acd2`)  
Scope: static review of repository structure and selected application, persistence, backup and Android build files. This is **not** a full runtime or security penetration test.

## Executive summary

Todo is an Angular 20 / Capacitor 7 web and Android application with local Dexie / IndexedDB persistence. It supports tasks, notes, citations, budgets, recurrence history, local notifications and JSON backup/restore.

**Highest risk:** a signing keystore was committed to the public repository. Its removal in this branch does **not** invalidate the previously exposed private key; rotate the signing key using the appropriate Android distribution/update process. **Second priority:** the application's built-in password `test` and its unsalted SHA-256 hash provide limited protection and do not encrypt locally stored data. **Third priority:** JSON restore performs shallow shape checks and can replace local data with malformed data or an incompatible schema.

Some positive existing measures: data replacement uses a Dexie transaction; notification synchronization failures are logged; data export is implemented; todo-history queries group subitem history rather than issuing one query per subitem.

## Architecture overview

- `web-app/src/app/features/`: Angular feature views (dashboard, calendar, budget, item detail, history, settings).
- `web-app/src/app/shared/services/`: persistence-facing services, password/locking, settings, history and notifications.
- `web-app/src/app/db.config.ts`: Dexie schema (currently version 5) and initial budget.
- `web-app/src/app/features/settings/settings.component.ts`: password settings, destructive operations and JSON backup/restore.
- `web-app/android/`: Capacitor Android native project, release packaging/signing.

No `AGENTS.md` or `PROJECT.md` appears in the reviewed repository tree. The root README consists mainly of historical setup commands; the detailed guide is under `web-app/README.md`.

## Findings and recommendations

| ID | Priority | Category | Finding and evidence | Impact | Recommendation | Status |
| --- | --- | --- | --- | --- | --- | --- |
| AUD-001 | P0 Critical | Security | `web-app/android/my-release-key.keystore` was tracked in a public repository | Signing private key potentially compromised | Remove from tracked files and rotate/revoke through appropriate Android distribution procedure; inspect Git history and release pipeline | Removed from current branch; **rotation pending** |
| AUD-002 | P1 High | Security | `PasswordService` exposes default password `test` and its SHA-256 hash. `SettingsService` restores the default when the hash is absent | Known default unlock password; hash is not password-hardening or local encryption | Design enrollment and credential migration, use an appropriate password KDF, clarify whether real encryption is required | Pending: compatibility/security migration |
| AUD-003 | P1 High | Data integrity | `SettingsComponent.isValidAppData` checks top-level arrays and a settings ID, not per-record types or integrity. The import clears all tables and rewrites them | Malformed backups could replace valid data; runtime may fail on invalid records | Validate complete payload and version, limit file size, test malformed backups and rollback, offer dry-run/pre-import snapshot | Pending: requires test coverage |
| AUD-004 | P1 High | Data integrity | Database schema versions are squashed in `db.config.ts` despite a persisted version 5 | Upgrade paths from historical installations cannot be confirmed from current migrations | Inventory previously released schemas; test upgrading actual older IndexedDB data before changing schema | Pending: migration assessment |
| AUD-005 | P1 High | Reliability | `DatabaseService.seedDefaultData` caught every budget insertion failure and replaced the budget with defaults | Underlying errors hidden; potential unintended budget overwrite | Use explicit `put` for known seed upsert and allow unexpected failures to propagate | **Fixed** |
| AUD-006 | P2 Medium | Data integrity | `ItemsService.deleteAndSyncItem` deletes an item without visibly clearing its history or related metadata; history lookup uses subitem IDs | Potential orphaned records and storage growth; exact UX impact needs tests | Define cascading-delete policy, implement transaction + regression tests | Pending |
| AUD-007 | P2 Medium | Reliability | Backup import clears scheduled notifications before the database transaction succeeds | Failed imports can leave notifications out of sync | Reconcile notifications in success and failure paths; test platform-specific behavior | Pending |
| AUD-008 | P2 Medium | Architecture | `settings.component.ts` combines forms, password checks, backup file I/O, validation and DB transactions (>600 lines) | High coupling and costly regression testing | Extract backup codec/validation and persistence workflow incrementally, retaining existing UX | Pending |
| AUD-009 | P2 Medium | Maintainability | README advertises app `1.0.2` and Dexie schema `1`, while package/app config show `1.3.0` / schema `5` | Misleading operator/developer instructions | Correct versioned documentation and keep it aligned with release script | Pending |
| AUD-010 | P2 Medium | Reliability | `AppComponent.ngOnInit` uses `finally` to mark app ready even if database initialization throws | UI can become available without a usable database | Introduce a visible initialization failure state and recovery UX | Pending |
| AUD-011 | P2 Medium | Maintainability | No application `*.spec.ts` files appear in the reviewed source tree; Android has template example tests | Little evidence of automated regression coverage | Add service tests for history, imports, database init and password migration; CI build/test/format checks | Pending |
| AUD-012 | P3 Low | Performance | `ItemsService.getAll` reads/filters all items and hydration sorts history arrays | May become expensive with large local datasets | Profile realistic volumes first; index frequent filters or cache only when measured | Investigation only |

### Security note: tracked Android signing key

Removing a key from the latest commit does **not** erase it from Git history or invalidate it. Assess whether the key was used to sign releases, rotate according to the Play App Signing / distribution model, store replacements outside the repository, and use secret management. Avoid casually rewriting published history without coordinating consumers.

### Password model limitations

A UI lock implemented with a client-side hash is not a security boundary against a user or program with access to IndexedDB or the exported backup. The backup JSON itself is not encrypted. Decide whether the requirement is accidental-access prevention or confidentiality at rest; the latter requires a different design and careful recovery/migration considerations.

### Restore/data migrations

A successful Dexie transaction only guarantees atomic writes, not semantic correctness of imported records. Existing version migration must be established against backups/DBs from prior releases. Implement a dedicated validator with tests before changing destructive import behavior.

## Corrections applied

1. `web-app/android/my-release-key.keystore`: removed from this branch's tracked tree. Existing `.gitignore` already excludes `/android/*.keystore` and `/android/*.jks`.
2. `web-app/src/app/shared/services/database.service.ts`: replaced blanket try/catch fallback during seed budget insertion with explicit upsert, preserving error visibility; removed unnecessary `any` around example budget lookup.

## Deferred work

Credential changes, historical DB migrations, backup schema validation, orphan cleanup and initialization UX need planned compatibility tests and/or product decisions. They were not automatically refactored to avoid data-loss or behavior regressions.

## Verification

- Confirmed repository structure and relevant source by reading GitHub files.
- Changes were applied on `audit/code-quality-2026-11`, not on `develop`.
- **Not executed:** npm install, Angular build, type checking, automated tests, Android build, dynamic security scans. This environment's connector provides source operations rather than a runnable checkout.
- **Not validated:** installed-app migration, restore/recovery, notification behavior, key rotation.

## Recommended next steps

1. **Immediately** determine whether the exposed Android signing key has been used to publish builds and arrange key rotation.
2. Create a representative test database and JSON backups, including older releases; add import/rollback and upgrade tests.
3. Implement strict backup validation and notification reconciliation with regression tests.
4. Define a password/encryption threat model before migrating credentials.
5. Refactor settings backup functionality incrementally, add CI validation and correct project documentation.

## Priority summary

| Priority | Issue | Impact | Action | Status |
| --- | --- | --- | --- | --- |
| P0 | Public Android signing key | Critical | Remove tracked key and rotate | Partially fixed |
| P1 | Default password and weak local protection | High | Plan secure credential/storage design | Pending |
| P1 | Shallow backup validation | High | Validate backups and test rollback | Pending |
| P1 | Unverified schema migration compatibility | High | Test historical upgrades | Pending |
| P1 | Swallowed budget seed errors | High | Upsert, preserve errors | Fixed |
| P2 | Cascading deletes, notification and initialization reliability | Medium | Add tests and safe fixes | Pending |
| P2 | Large settings component, weak test coverage and stale docs | Medium | Incremental refactor and CI | Pending |
| P3 | Potential large-data performance bottlenecks | Low | Profile before optimizing | Investigation |
