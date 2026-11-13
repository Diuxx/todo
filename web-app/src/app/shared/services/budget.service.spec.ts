import { firstValueFrom } from 'rxjs';
import { db } from '../../db.config';
import { Budget, createDefaultBudget } from '../models/budget/budget.model';
import { BudgetService } from './budget.service';

describe('BudgetService functional behavior', () => {
  let service: BudgetService;
  let originalBudget: Budget | undefined;
  let testPeriod: string;

  beforeEach(async () => {
    await db.open();
    service = new BudgetService();
    originalBudget = await db.budgets.get('main');
    testPeriod = '2097-10';
  });

  afterEach(async () => {
    if (originalBudget) {
      await db.budgets.put(originalBudget);
    } else {
      await db.budgets.delete('main');
    }
  });

  it('keeps an explicitly created empty month', async () => {
    await firstValueFrom(service.update(createDefaultBudget()));

    const updated = await firstValueFrom(
      service.upsertPeriod({ date: testPeriod, incomes: [], expenses: [] })
    );

    expect(updated.periods.find((period) => period.date === testPeriod)).toBeDefined();
    expect((await firstValueFrom(service.get())).periods.some(
      (period) => period.date === testPeriod
    )).toBeTrue();
  });

  it('preserves empty periods when another budget change is saved', async () => {
    await firstValueFrom(service.update(createDefaultBudget()));
    await firstValueFrom(service.upsertPeriod({ date: testPeriod, incomes: [], expenses: [] }));

    await firstValueFrom(service.upsertAccount({ id: 'audit-account', name: 'Audit account' }));

    const persisted = await firstValueFrom(service.get());
    expect(persisted.periods.some((period) => period.date === testPeriod)).toBeTrue();
    expect(persisted.accounts.some((account) => account.id === 'audit-account')).toBeTrue();
  });

  it('does not lose updates from concurrent account changes', async () => {
    await firstValueFrom(service.update(createDefaultBudget()));

    await Promise.all([
      firstValueFrom(service.upsertAccount({ id: 'audit-account-a', name: 'First' })),
      firstValueFrom(service.upsertAccount({ id: 'audit-account-b', name: 'Second' })),
    ]);

    const persisted = await firstValueFrom(service.get());
    expect(persisted.accounts.some((account) => account.id === 'audit-account-a')).toBeTrue();
    expect(persisted.accounts.some((account) => account.id === 'audit-account-b')).toBeTrue();
  });

  it('keeps expenses without silently reassigning them when their income is removed', async () => {
    const initial = createDefaultBudget();
    initial.periods = [{
      date: testPeriod,
      incomes: [{
        id: 'audit-income', name: 'Salary', typeId: 'salary',
        plannedAmount: 100, realAmount: 100, accountId: 'main',
      }],
      expenses: [{
        id: 'audit-expense', name: 'Groceries', type: 'variable', note: '',
        plannedAmount: 20, realAmount: 20, accountId: 'main',
        categoryId: 'groceries', incomeId: 'audit-income',
      }],
    }];
    await firstValueFrom(service.update(initial));

    const updated = await firstValueFrom(
      service.updatePeriodEntries(testPeriod, (period) => ({
        ...period,
        incomes: [],
        expenses: period.expenses.map((expense) => ({ ...expense, incomeId: undefined })),
      }))
    );

    expect(updated.periods[0].expenses.length).toBe(1);
    expect(updated.periods[0].expenses[0].incomeId).toBeUndefined();
    expect((await firstValueFrom(service.get())).periods[0].expenses[0].incomeId).toBeUndefined();
  });

  it('preserves a concurrent account update while editing a period', async () => {
    await firstValueFrom(service.update(createDefaultBudget()));
    await firstValueFrom(service.upsertPeriod({ date: testPeriod, incomes: [], expenses: [] }));

    await Promise.all([
      firstValueFrom(service.updatePeriodEntries(testPeriod, (period) => ({
        ...period,
        incomes: [{
          id: 'audit-income', name: 'Salary', typeId: 'salary',
          plannedAmount: 100, realAmount: 100, accountId: 'main',
        }],
      }))),
      firstValueFrom(service.upsertAccount({ id: 'audit-extra', name: 'Extra account' })),
    ]);

    const persisted = await firstValueFrom(service.get());
    expect(persisted.accounts.some((account) => account.id === 'audit-extra')).toBeTrue();
    expect(persisted.periods.find((period) => period.date === testPeriod)?.incomes.length).toBe(1);
  });

  it('does not recreate a deleted empty period', async () => {
    await firstValueFrom(service.update(createDefaultBudget()));
    await firstValueFrom(service.upsertPeriod({ date: testPeriod, incomes: [], expenses: [] }));

    const updated = await firstValueFrom(service.deletePeriod(testPeriod));

    expect(updated.periods.some((period) => period.date === testPeriod)).toBeFalse();
  });
});
