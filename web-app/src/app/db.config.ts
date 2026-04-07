import Dexie, { Table } from 'dexie';
import { environment } from '../env/env';
import { AppItem } from './shared/models/app-item.model';
import { TodoHistoryEntry } from './shared/models/todo-history.model';
import { CitationMeta } from './shared/models/citation-meta.model';
import { ImageMeta } from './shared/models/image-meta.model';
import { AppSettings } from './shared/models/app-settings.model';
import { AppData } from './shared/models/app-data.model';

/*
table items
table todoHistory
table citationsMeta
table imagesMeta
table settings
*/

export class AppDb extends Dexie {
  items!: Table<AppItem, string>;
  todoHistory!: Table<TodoHistoryEntry, string>;
  citationsMeta!: Table<CitationMeta, string>;
  imagesMeta!: Table<ImageMeta, string>;
  settings!: Table<AppSettings, string>;

  constructor(dbName: string, dbVersion: number) {
    super(dbName);

    // Single schema (mock reset workflow): no migration path needed.
    this.version(dbVersion).stores({
      items: 'id, type, createdAt, updatedAt',
      todoHistory: 'id, todoItemId, status, completedAt, createdAt, [todoItemId+completedAt], [todoItemId+createdAt]',
      citationsMeta: 'id, itemId, author',
      imagesMeta: 'id, itemId',
      settings: 'id'
    });
  }
}

/**
 * Exports all app data as a single object for backup or migration purposes.
 * @returns 
 */
async function exportAppData(): Promise<AppData> {
  const [
    items,
    todoHistory,
    citationsMeta,
    imagesMeta,
    settingsList
  ] = await Promise.all([
    db.items.toArray(),
    db.todoHistory.toArray(),
    db.citationsMeta.toArray(),
    db.imagesMeta.toArray(),
    db.settings.toArray()
  ]);

  return {
    id: 'app-data',
    items,
    todoHistory,
    citationsMeta,
    imagesMeta,
    settings: settingsList[0]
  };
}

export const db = new AppDb(environment.dbName, environment.dbVersion);