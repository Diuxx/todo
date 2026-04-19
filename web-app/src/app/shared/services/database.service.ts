import { Injectable } from '@angular/core';
import { db } from '../../db.config';
import { generateUUID } from '../utils';
import { appDataExample } from '../models/mock-data';
import { PasswordService } from './password.service';
import { CitationMeta } from '../models/citation-meta.model';
import { ImageMeta } from '../models/image-meta.model';
import { AppSettings, BackupState } from '../models/app-settings.model';
import { environment } from '../../../env/env';
import { createDefaultBudget } from '../models/budget/budget.model';

@Injectable({
  providedIn: 'root',
})
export class DatabaseService {
  private readonly SETTINGS_ID = 'app-settings';
  private readonly passwordService = new PasswordService();

  /**
   * Initialize the database and create default settings if not exist.
   */
  public async init(): Promise<void> {
    await db.open();

    const hasSettings = await db.settings.get(this.SETTINGS_ID);
    const hasBudget = await db.budgets.get('main');

    if (!hasSettings) {
      await this.initializeDefaultDatabase();

      console.info('Database initialized with default settings and data.');
      return;
    }

    if (!hasBudget) {
      // If an example budget exists in `appDataExample`, use it; otherwise create defaults
      const budgetPayload = (appDataExample && (appDataExample as any).budget) ?? createDefaultBudget();
      await db.budgets.add({
        periods: budgetPayload.periods,
        accounts: budgetPayload.accounts,
        expenseCategories: budgetPayload.expenseCategories,
        incomeTypes: budgetPayload.incomeTypes,
        id: 'main',
      });
    }

    if (!hasSettings.passwordHash) {
      await db.settings.put({
        ...hasSettings,
        passwordHash: this.passwordService.defaultPasswordHash,
      });
    }
  }

  /**
   * Seed the database with default data for development or first-time users.
   */
  private createDefaultSettings(): AppSettings {
    const backupState: BackupState = {
      lastBackupAt: undefined,
      status: 'idle',
      lastError: undefined,
    };

    return {
      id: this.SETTINGS_ID,
      theme: 'system',
      language: 'fr',
      dailyAffirmationEnabled: false,
      showArchivedItems: false,
      passwordHash: this.passwordService.defaultPasswordHash,
      userName: 'Nouvel Utilisateur',
      userId: generateUUID(),
      backupState: backupState,
      version: environment.dbVersion,
    };
  }

  /**
   * Seed the database with default data for development or first-time users.
   */
  private async seedDefaultData(): Promise<void> {
    await db.items.bulkAdd([...appDataExample.items]);
    await db.todoHistory.bulkAdd([...appDataExample.todoHistory]);
    await db.citationsMeta.bulkAdd(this.normalizeCitationMetas(appDataExample.citationsMeta));
    await db.imagesMeta.bulkAdd(this.normalizeImageMetas(appDataExample.imagesMeta));

    // Seed budget from example data when available, otherwise use defaults
    try {
      const budgetPayload = appDataExample.budget ?? createDefaultBudget();
      await db.budgets.add({
        periods: budgetPayload.periods,
        accounts: budgetPayload.accounts,
        expenseCategories: budgetPayload.expenseCategories,
        incomeTypes: budgetPayload.incomeTypes,
        id: 'main',
      });
    } catch (err) {
      // If adding fails (already exists), fall back to ensuring default budget exists
      const defaultBudget = createDefaultBudget();
      await db.budgets.put({
        periods: defaultBudget.periods,
        accounts: defaultBudget.accounts,
        expenseCategories: defaultBudget.expenseCategories,
        incomeTypes: defaultBudget.incomeTypes,
        id: 'main',
      });
    }
  }

  private async initializeDefaultDatabase(): Promise<void> {
    await db.transaction(
      'rw',
      [db.settings, db.items, db.todoHistory, db.citationsMeta, db.imagesMeta, db.budgets],
      async () => {
        await db.settings.add(this.createDefaultSettings());
        await this.seedDefaultData();
      }
    );
  }

  private normalizeCitationMetas(items: CitationMeta[]): CitationMeta[] {
    return items.map((item, index) => ({
      ...item,
      id: item.id || `citation_meta_${index + 1}`,
    }));
  }

  private normalizeImageMetas(items: ImageMeta[]): ImageMeta[] {
    return items.map((item, index) => ({
      ...item,
      id: item.id || `image_meta_${index + 1}`,
    }));
  }

  /**
   * Clears all user content while preserving application settings.
   */
  public async clearUserContent(): Promise<void> {
    await db.transaction(
      'rw',
      [db.items, db.todoHistory, db.citationsMeta, db.imagesMeta, db.budgets],
      async () => {
        const defaultBudget = createDefaultBudget();
        await db.items.clear();
        await db.todoHistory.clear();
        await db.citationsMeta.clear();
        await db.imagesMeta.clear();
        await db.budgets.clear();
        await db.budgets.add({
          periods: defaultBudget.periods,
          accounts: defaultBudget.accounts,
          expenseCategories: defaultBudget.expenseCategories,
          incomeTypes: defaultBudget.incomeTypes,
          id: 'main',
        });
      }
    );
  }
}
