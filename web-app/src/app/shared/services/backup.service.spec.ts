import { db } from '../../db.config';
import { MAX_BACKUP_BYTES } from '../utils/backup-validation';
import { BackupService } from './backup.service';

describe('BackupService safety', () => {
  let service: BackupService;
  let testItemId: string;

  beforeEach(async () => {
    await db.open();
    service = new BackupService();
    testItemId = 'p2-backup-' + crypto.randomUUID();

    await db.items.add({
      id: testItemId,
      type: 'note',
      title: 'Keep this item',
      color: 'default',
      visibility: 'private',
      isArchived: false,
      isFavorite: false,
      isLocked: false,
      isAffirmation: false,
      tags: [],
      createdAt: '2026-11-13T10:00:00.000Z',
      updatedAt: '2026-11-13T10:00:00.000Z',
    });
  });

  afterEach(async () => {
    await db.items.delete(testItemId);
  });

  it('preserves unlinked expenses when migrating a current-version backup', async () => {
    const exported = await service.getCurrentData();
    const detachedExpense = {
      id: 'unlinked-expense',
      name: 'Detached expense',
      type: 'variable' as const,
      note: '',
      plannedAmount: 15,
      realAmount: 10,
      categoryId: exported.budget.expenseCategories[0].id,
      accountId: exported.budget.accounts[0].id,
    };
    const backup = {
      ...exported,
      settings: { ...exported.settings, version: 5 },
      budget: {
        ...exported.budget,
        periods: [{
          date: '2098-01',
          incomes: [{
            id: 'another-income', name: 'Another', typeId: exported.budget.incomeTypes[0].id,
            plannedAmount: 50, realAmount: 50, accountId: exported.budget.accounts[0].id,
          }],
          expenses: [detachedExpense],
        }],
      },
    };

    const migrated = service['migrateBudget'](backup);

    expect(migrated.budget.periods[0].expenses[0].incomeId).toBeUndefined();
  });

  it('continues resolving income references in legacy backups', async () => {
    const exported = await service.getCurrentData();
    const income = {
      id: 'legacy-income', name: 'Salary', typeId: exported.budget.incomeTypes[0].id,
      plannedAmount: 100, realAmount: 100, accountId: exported.budget.accounts[0].id,
    };
    const expense = {
      id: 'legacy-expense', name: 'Costs', type: 'variable' as const, note: '',
      plannedAmount: 20, realAmount: 20, categoryId: exported.budget.expenseCategories[0].id,
      accountId: income.accountId,
    };
    const migrated = service['migrateBudget']({
      ...exported,
      settings: { ...exported.settings, version: 4 },
      budget: { ...exported.budget, periods: [{ date: '2098-01', incomes: [income], expenses: [expense] }] },
    });

    expect(migrated.budget.periods[0].expenses[0].incomeId).toBe(income.id);
  });

  it('rejects an invalid JSON file without deleting existing records', async () => {
    const invalidFile = new File(['not valid JSON'], 'broken.json', {
      type: 'application/json',
    });

    await expectAsync(service.restoreFromFile(invalidFile)).toBeRejected();
    expect((await db.items.get(testItemId))?.title).toBe('Keep this item');
  });

  it('rejects a structurally invalid backup before any database write', async () => {
    const invalidFile = new File([JSON.stringify({ id: 'app-data', items: [] })], 'bad.json', {
      type: 'application/json',
    });

    await expectAsync(service.restoreFromFile(invalidFile)).toBeRejectedWithError(
      'Le fichier JSON ne correspond pas au format attendu.'
    );
    expect(await db.items.get(testItemId)).toBeDefined();
  });

  it('refuses an oversized file without touching local data', async () => {
    const tooLarge = new File([new Uint8Array(MAX_BACKUP_BYTES + 1)], 'large.json', {
      type: 'application/json',
    });

    await expectAsync(service.restoreFromFile(tooLarge)).toBeRejectedWithError(
      'Le fichier dépasse la taille maximale autorisée (10 Mo).'
    );
    expect(await db.items.get(testItemId)).toBeDefined();
  });
});
