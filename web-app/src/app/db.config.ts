import Dexie, { Table } from 'dexie';
import { environment } from '../env/env';
import { AppItem } from './shared/models/app-item.model';
import { TodoHistoryEntry } from './shared/models/todo-history.model';
import { CitationMeta } from './shared/models/citation-meta.model';
import { ImageMeta } from './shared/models/image-meta.model';
import { AppSettings } from './shared/models/app-settings.model';
import { AppData } from './shared/models/app-data.model';
import { Budget, createDefaultBudget } from './shared/models/budget/budget.model';
import {
  normalizeTodoCriticality,
  normalizeTodoDueDate,
  normalizeTodoGoalCount,
} from './shared/utils/todo-config.utils';

/*
table items
table todoHistory
table citationsMeta
table imagesMeta
table budgets
table settings
*/

export class AppDb extends Dexie {
  items!: Table<AppItem, string>;
  todoHistory!: Table<TodoHistoryEntry, string>;
  citationsMeta!: Table<CitationMeta, string>;
  imagesMeta!: Table<ImageMeta, string>;
  budgets!: Table<Budget, string>;
  settings!: Table<AppSettings, string>;

  constructor(dbName: string, dbVersion: number) {
    super(dbName);

    this.version(1).stores({
      items: 'id, type, createdAt, updatedAt',
      todoHistory:
        'id, todoItemId, status, completedAt, createdAt, [todoItemId+completedAt], [todoItemId+createdAt]',
      citationsMeta: 'id, itemId, author',
      imagesMeta: 'id, itemId',
      settings: 'id',
    });

    this.version(3).stores({
      items: 'id, type, createdAt, updatedAt, date, fromCalendar',
      todoHistory:
        'id, todoItemId, status, completedAt, createdAt, [todoItemId+completedAt], [todoItemId+createdAt]',
      citationsMeta: 'id, itemId, author',
      imagesMeta: 'id, itemId',
      settings: 'id',
    }).upgrade(async (transaction) => {
      await transaction
        .table<AppItem, string>('items')
        .toCollection()
        .modify((item) => {
          item.date = normalizeTodoDueDate(item.date);
          item.fromCalendar = !!item.fromCalendar;

          if (item.type !== 'todo' || !item.todoContent?.length) {
            return;
          }

          item.todoContent = item.todoContent.map((subItem) => ({
            ...subItem,
            config: {
              criticality: normalizeTodoCriticality(subItem.config?.criticality),
              recurrenceType: subItem.config?.recurrenceType ?? 'none',
              alertEnabled: subItem.config?.alertEnabled ?? false,
              alertAt: subItem.config?.alertAt,
              recurrenceRule: subItem.config?.recurrenceRule,
              goalCount: normalizeTodoGoalCount(subItem.config?.goalCount),
              lastCompletedAt: subItem.config?.lastCompletedAt,
              nextDueAt: subItem.config?.nextDueAt,
              dueDate: normalizeTodoDueDate(subItem.config?.dueDate),
            },
          }));
        });
    });

    this.version(4).stores({
      items: 'id, type, createdAt, updatedAt, date, fromCalendar',
      todoHistory:
        'id, todoItemId, status, completedAt, createdAt, [todoItemId+completedAt], [todoItemId+createdAt]',
      citationsMeta: 'id, itemId, author',
      imagesMeta: 'id, itemId',
      budgets: 'id',
      settings: 'id',
    }).upgrade(async (transaction) => {
      const budgetsTable = transaction.table<Budget, string>('budgets');
      const existingBudget = await budgetsTable.get('main');

      if (existingBudget) {
        return;
      }

      const defaultBudget = createDefaultBudget();

      await budgetsTable.add({
        periods: defaultBudget.periods,
        accounts: defaultBudget.accounts,
        expenseCategories: defaultBudget.expenseCategories,
        incomeTypes: defaultBudget.incomeTypes,
        id: 'main',
      });
    });

    if (dbVersion > 4) {
      this.version(dbVersion).stores({
        items: 'id, type, createdAt, updatedAt, date, fromCalendar',
        todoHistory:
          'id, todoItemId, status, completedAt, createdAt, [todoItemId+completedAt], [todoItemId+createdAt]',
        citationsMeta: 'id, itemId, author',
        imagesMeta: 'id, itemId',
        budgets: 'id',
        settings: 'id',
      });
    }
  }
}

/**
 * Exports all app data as a single object for backup or migration purposes.
 * @returns
 */
async function exportAppData(): Promise<AppData> {
  const [items, todoHistory, citationsMeta, imagesMeta, budgets, settingsList] = await Promise.all([
    db.items.toArray(),
    db.todoHistory.toArray(),
    db.citationsMeta.toArray(),
    db.imagesMeta.toArray(),
    db.budgets.toArray(),
    db.settings.toArray(),
  ]);

  const budgetDocument = budgets[0];
  const budget = budgetDocument
    ? {
        periods: budgetDocument.periods,
        accounts: budgetDocument.accounts,
        expenseCategories: budgetDocument.expenseCategories,
        incomeTypes: budgetDocument.incomeTypes,
      }
    : createDefaultBudget();

  return {
    id: 'app-data',
    items,
    todoHistory,
    citationsMeta,
    imagesMeta,
    budget,
    settings: settingsList[0],
  };
}

export const db = new AppDb(environment.dbName, environment.dbVersion);
