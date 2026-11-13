import { Injectable } from '@angular/core';
import { db } from '../../db.config';
import { AppData } from '../models/app-data.model';
import { Budget, createDefaultBudget, resolveExpenseIncomeId } from '../models/budget/budget.model';
import { MAX_BACKUP_BYTES, isValidBackup } from '../utils/backup-validation';

export interface StorageStats {
  historyRowsCount: number;
  databaseSizeKb: number;
}

@Injectable({ providedIn: 'root' })
export class BackupService {
  public async getCurrentData(): Promise<AppData> {
    const [items, todoHistory, citationsMeta, imagesMeta, budget, settings] = await Promise.all([
      db.items.toArray(),
      db.todoHistory.toArray(),
      db.citationsMeta.toArray(),
      db.imagesMeta.toArray(),
      db.budgets.get('main'),
      db.settings.get('app-settings'),
    ]);

    if (!settings) {
      throw new Error('Application settings are not available for backup.');
    }

    return {
      id: 'app-data',
      items,
      todoHistory,
      citationsMeta,
      imagesMeta,
      budget: budget
        ? {
            periods: budget.periods,
            accounts: budget.accounts,
            expenseCategories: budget.expenseCategories,
            incomeTypes: budget.incomeTypes,
          }
        : createDefaultBudget(),
      settings,
    };
  }

  public async getStorageStats(): Promise<StorageStats> {
    const [historyRowsCount, payload] = await Promise.all([
      db.todoHistory.count(),
      this.getCurrentData(),
    ]);

    return {
      historyRowsCount,
      databaseSizeKb: Math.round(new Blob([JSON.stringify(payload)]).size / 1024),
    };
  }

  public async restoreFromFile(file: File): Promise<AppData> {
    if (file.size > MAX_BACKUP_BYTES) {
      throw new Error('Le fichier dépasse la taille maximale autorisée (10 Mo).');
    }

    const rawBackup: unknown = JSON.parse(await file.text());
    if (!isValidBackup(rawBackup)) {
      throw new Error('Le fichier JSON ne correspond pas au format attendu.');
    }

    const backup = this.migrateBudget(rawBackup);

    // All local records are replaced atomically. Validation happens before this transaction.
    await db.transaction(
      'rw',
      [db.items, db.todoHistory, db.citationsMeta, db.imagesMeta, db.budgets, db.settings],
      async () => {
        await db.items.clear();
        await db.todoHistory.clear();
        await db.citationsMeta.clear();
        await db.imagesMeta.clear();
        await db.budgets.clear();
        await db.settings.clear();

        if (backup.items.length) {
          await db.items.bulkAdd(backup.items);
        }
        if (backup.todoHistory.length) {
          await db.todoHistory.bulkAdd(backup.todoHistory);
        }
        if (backup.citationsMeta.length) {
          await db.citationsMeta.bulkAdd(backup.citationsMeta);
        }
        if (backup.imagesMeta.length) {
          await db.imagesMeta.bulkAdd(backup.imagesMeta);
        }

        await db.budgets.add({ id: 'main', ...backup.budget });
        await db.settings.add(backup.settings);
      }
    );

    return backup;
  }

  private migrateBudget(payload: AppData): AppData {
    const importedBudget = (payload as AppData & { budget?: Budget }).budget;
    if (!importedBudget) {
      return { ...payload, budget: createDefaultBudget() };
    }

    const defaults = createDefaultBudget();
    return {
      ...payload,
      budget: {
        periods: importedBudget.periods.map((period) => ({
          ...period,
          expenses: period.expenses.map((expense) => ({
            ...expense,
            incomeId: resolveExpenseIncomeId(expense, period.incomes),
          })),
        })),
        accounts: importedBudget.accounts,
        expenseCategories: importedBudget.expenseCategories,
        incomeTypes: importedBudget.incomeTypes ?? defaults.incomeTypes,
      },
    };
  }
}
