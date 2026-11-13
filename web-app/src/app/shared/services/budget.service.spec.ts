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

  it('does not recreate a deleted empty period', async () => {
    await firstValueFrom(service.update(createDefaultBudget()));
    await firstValueFrom(service.upsertPeriod({ date: testPeriod, incomes: [], expenses: [] }));

    const updated = await firstValueFrom(service.deletePeriod(testPeriod));

    expect(updated.periods.some((period) => period.date === testPeriod)).toBeFalse();
  });
});
