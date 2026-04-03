import Dexie, { Table } from 'dexie';
import { environment } from '../env/env';
import { AppItem } from './shared/models/app-item.model';
import { TodoConfig } from './shared/models/todo-config.model';
import { TodoHistoryEntry } from './shared/models/todo-history.model';
import { CitationMeta } from './shared/models/citation-meta.model';
import { ImageMeta } from './shared/models/image-meta.model';
import { AppSettings } from './shared/models/app-settings.model';
import { AppData } from './shared/models/app-data.model';

/*
table items
table todoConfigs
table todoHistory
table citationsMeta
table imagesMeta
table settings
*/

export class AppDb extends Dexie {
  items!: Table<AppItem, string>;
  todoConfigs!: Table<TodoConfig, string>;
  todoHistory!: Table<TodoHistoryEntry, string>;
  citationsMeta!: Table<CitationMeta, string>;
  imagesMeta!: Table<ImageMeta, string>;
  settings!: Table<AppSettings, string>;

  constructor(dbName: string, dbVersion: number) {
    super(dbName);
    this.version(dbVersion).stores({
      items: 'id, type, createdAt, updatedAt',
      todoConfigs: 'id, itemId, recurrenceType',
      todoHistory: 'id, todoItemId, status, completedAt',
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
    todoConfigs,
    todoHistory,
    citationsMeta,
    imagesMeta,
    settingsList
  ] = await Promise.all([
    db.items.toArray(),
    db.todoConfigs.toArray(),
    db.todoHistory.toArray(),
    db.citationsMeta.toArray(),
    db.imagesMeta.toArray(),
    db.settings.toArray()
  ]);

  return {
    id: 'app-data',
    items,
    todoConfigs,
    todoHistory,
    citationsMeta,
    imagesMeta,
    settings: settingsList[0]
  };
}

export const db = new AppDb(environment.dbName, environment.dbVersion);