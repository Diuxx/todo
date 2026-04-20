import Dexie, { Table, Transaction } from 'dexie';
import { environment } from '../env/env';
import { AppItem } from './shared/models/app-item.model';
import { TodoHistoryEntry } from './shared/models/todo-history.model';
import { CitationMeta } from './shared/models/citation-meta.model';
import { ImageMeta } from './shared/models/image-meta.model';
import { AppSettings } from './shared/models/app-settings.model';
import { AppData } from './shared/models/app-data.model';
import { Budget, createDefaultBudget } from './shared/models/budget/budget.model';

const APP_DB_SCHEMA = {
  items: 'id, type, createdAt, updatedAt, date, fromCalendar',
  todoHistory:
    'id, todoItemId, status, completedAt, createdAt, [todoItemId+completedAt], [todoItemId+createdAt]',
  citationsMeta: 'id, itemId, author',
  imagesMeta: 'id, itemId',
  budgets: 'id',
  settings: 'id',
} as const;

const MAIN_BUDGET_ID = 'main';

export class AppDb extends Dexie {
  items!: Table<AppItem, string>;
  todoHistory!: Table<TodoHistoryEntry, string>;
  citationsMeta!: Table<CitationMeta, string>;
  imagesMeta!: Table<ImageMeta, string>;
  budgets!: Table<Budget, string>;
  settings!: Table<AppSettings, string>;

  constructor(dbName: string, dbVersion: number) {
    super(dbName);

    // Historical Dexie migrations are intentionally squashed.
    this.version(dbVersion).stores(APP_DB_SCHEMA);

    this.on('populate', (transaction) => this.populateDefaults(transaction));
  }

  private async populateDefaults(transaction: Transaction): Promise<void> {
    const budgetsTable = transaction.table<Budget, string>('budgets');
    const defaultBudget = createDefaultBudget();

    await budgetsTable.add({
      id: MAIN_BUDGET_ID,
      periods: defaultBudget.periods,
      accounts: defaultBudget.accounts,
      expenseCategories: defaultBudget.expenseCategories,
      incomeTypes: defaultBudget.incomeTypes,
    });
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
