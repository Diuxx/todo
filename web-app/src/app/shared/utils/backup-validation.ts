import { AppData } from '../models/app-data.model';
import { AppItem } from '../models/app-item.model';
import { TodoHistoryEntry } from '../models/todo-history.model';
import { Budget } from '../models/budget/budget.model';
import { environment } from '../../../env/env';

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasIdentity(value: unknown): value is JsonObject {
  return isObject(value) && isNonEmptyString(value['id']);
}

function isDateString(value: unknown): boolean {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function hasBaseEntity(value: unknown): value is JsonObject {
  return hasIdentity(value) &&
    isDateString(value['createdAt']) &&
    isDateString(value['updatedAt']);
}

function hasUniqueIds(entries: JsonObject[]): boolean {
  const ids = entries.map((entry) => entry['id']);
  return new Set(ids).size === ids.length;
}

function isTodoSubItem(value: unknown): boolean {
  return hasBaseEntity(value) &&
    (value['title'] === undefined || typeof value['title'] === 'string') &&
    (value['config'] === undefined || isObject(value['config']));
}

function isItem(value: unknown): value is AppItem {
  if (!hasBaseEntity(value) ||
      !['todo', 'note', 'citation', 'image'].includes(String(value['type'])) ||
      !Array.isArray(value['tags']) ||
      !value['tags'].every((tag: unknown) => typeof tag === 'string') ||
      !['private', 'public'].includes(String(value['visibility'])) ||
      !['default', 'blue', 'green', 'yellow', 'orange', 'red', 'purple', 'pink', 'gray']
        .includes(String(value['color']))) {
    return false;
  }

  for (const flag of ['isArchived', 'isFavorite', 'isLocked', 'isAffirmation']) {
    if (typeof value[flag] !== 'boolean') {
      return false;
    }
  }

  return (value['todoContent'] === undefined ||
    (Array.isArray(value['todoContent']) && value['todoContent'].every(isTodoSubItem)));
}

function isHistory(value: unknown): value is TodoHistoryEntry {
  return hasBaseEntity(value) &&
    isNonEmptyString(value['todoItemId']) &&
    ['pending', 'done'].includes(String(value['status'])) &&
    (value['completedAt'] === undefined || isDateString(value['completedAt']));
}

function isCitationMeta(value: unknown): boolean {
  return hasIdentity(value) && isNonEmptyString(value['itemId']) &&
    (value['author'] === undefined || typeof value['author'] === 'string') &&
    (value['source'] === undefined || typeof value['source'] === 'string');
}

function isImageMeta(value: unknown): boolean {
  return hasIdentity(value) && isNonEmptyString(value['itemId']) &&
    typeof value['imageUrl'] === 'string';
}

function isBudgetEntry(value: unknown): boolean {
  return hasIdentity(value) && typeof value['name'] === 'string';
}

function isAmount(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBudgetTransaction(value: unknown): boolean {
  return isBudgetEntry(value) &&
    isAmount(value['plannedAmount']) && isAmount(value['realAmount']) &&
    isNonEmptyString(value['accountId']);
}

function isBudget(value: unknown): value is Budget {
  if (!isObject(value) ||
      !Array.isArray(value['periods']) ||
      !Array.isArray(value['accounts']) ||
      !Array.isArray(value['expenseCategories']) ||
      (value['incomeTypes'] !== undefined && !Array.isArray(value['incomeTypes']))) {
    return false;
  }

  const periodValid = value['periods'].every((period: unknown) =>
    isObject(period) &&
    typeof period['date'] === 'string' &&
    Array.isArray(period['incomes']) &&
    period['incomes'].every(isBudgetTransaction) &&
    Array.isArray(period['expenses']) &&
    period['expenses'].every(isBudgetTransaction)
  );

  return periodValid &&
    value['accounts'].every(isBudgetEntry) &&
    value['expenseCategories'].every(isBudgetEntry) &&
    (value['incomeTypes'] === undefined || value['incomeTypes'].every(isBudgetEntry));
}

function isSupportedPasswordHash(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  if (!value) {
    return true;
  }

  if (/^[a-f0-9]{64}$/i.test(value)) {
    return true;
  }

  const [scheme, iterations, salt, digest, extra] = value.split('
  return hasIdentity(value) && value['id'] === 'app-settings' &&
    ['light', 'dark', 'system'].includes(String(value['theme'])) &&
    ['fr', 'en'].includes(String(value['language'])) &&
    typeof value['dailyAffirmationEnabled'] === 'boolean' &&
    typeof value['showArchivedItems'] === 'boolean' &&
    isSupportedPasswordHash(value['passwordHash']) &&
    isNonEmptyString(value['userId']) &&
    typeof value['userName'] === 'string' &&
    (value['version'] === undefined ||
      (Number.isInteger(value['version']) &&
        Number(value['version']) >= 1 &&
        Number(value['version']) <= environment.dbVersion));
}

export function isValidBackup(value: unknown): value is AppData {
  if (!isObject(value) || value['id'] !== 'app-data' ||
      !isSettings(value['settings']) ||
      !Array.isArray(value['items']) ||
      !Array.isArray(value['todoHistory']) ||
      !Array.isArray(value['citationsMeta']) ||
      !Array.isArray(value['imagesMeta']) ||
      (value['budget'] !== undefined && !isBudget(value['budget']))) {
    return false;
  }

  const collections: Array<{ entries: unknown[]; validate: (entry: unknown) => boolean }> = [
    { entries: value['items'], validate: isItem },
    { entries: value['todoHistory'], validate: isHistory },
    { entries: value['citationsMeta'], validate: isCitationMeta },
    { entries: value['imagesMeta'], validate: isImageMeta },
  ];

  return collections.every(({ entries, validate }) =>
    entries.every(validate) && hasUniqueIds(entries as JsonObject[]));
}
);
  return extra === undefined &&
    scheme === 'pbkdf2-sha256' &&
    Number.isInteger(Number(iterations)) &&
    Number(iterations) >= 100_000 &&
    Number(iterations) <= 1_000_000 &&
    /^[a-f0-9]{32}$/i.test(salt ?? '') &&
    /^[a-f0-9]{64}$/i.test(digest ?? '');
}

function isSettings(value: unknown): boolean {
  return hasIdentity(value) &&
    ['light', 'dark', 'system'].includes(String(value['theme'])) &&
    ['fr', 'en'].includes(String(value['language'])) &&
    typeof value['dailyAffirmationEnabled'] === 'boolean' &&
    typeof value['showArchivedItems'] === 'boolean' &&
    typeof value['passwordHash'] === 'string' &&
    isNonEmptyString(value['userId']) &&
    typeof value['userName'] === 'string' &&
    (value['version'] === undefined ||
      (Number.isInteger(value['version']) && Number(value['version']) <= environment.dbVersion));
}

export function isValidBackup(value: unknown): value is AppData {
  if (!isObject(value) || value['id'] !== 'app-data' ||
      !isSettings(value['settings']) ||
      !Array.isArray(value['items']) ||
      !Array.isArray(value['todoHistory']) ||
      !Array.isArray(value['citationsMeta']) ||
      !Array.isArray(value['imagesMeta']) ||
      (value['budget'] !== undefined && !isBudget(value['budget']))) {
    return false;
  }

  const collections: Array<{ entries: unknown[]; validate: (entry: unknown) => boolean }> = [
    { entries: value['items'], validate: isItem },
    { entries: value['todoHistory'], validate: isHistory },
    { entries: value['citationsMeta'], validate: isCitationMeta },
    { entries: value['imagesMeta'], validate: isImageMeta },
  ];

  return collections.every(({ entries, validate }) =>
    entries.every(validate) && hasUniqueIds(entries as JsonObject[]));
}
