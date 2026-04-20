import { Injectable } from '@angular/core';
import { BehaviorSubject, from, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { db } from '../../db.config';
import {
  Account,
  Budget,
  TypeOfIncome,
  defaultIncomeTypes,
  ExpenseCategory,
  ExpenseItem,
  IncomeItem,
  Period,
  createDefaultBudget,
  resolveExpenseIncomeId,
} from '../models/budget/budget.model';
import { generateUUID } from '../utils';

const BUDGET_ID = 'main';

@Injectable({ providedIn: 'root' })
export class BudgetService {
  private readonly budgetSubject = new BehaviorSubject<Budget | null>(null);

  public readonly budget$ = this.budgetSubject.asObservable();

  /**
   * Loads the persisted budget, creating a default one when absent.
   */
  public get(): Observable<Budget> {
    return from(this.loadBudget()).pipe(tap((budget) => this.budgetSubject.next(budget)));
  }

  /**
   * Replaces the full budget payload.
   */
  public update(budget: Budget): Observable<Budget> {
    return from(this.saveBudget(budget)).pipe(tap((saved) => this.budgetSubject.next(saved)));
  }

  /**
   * Resets the persisted budget to its default state.
   */
  public reset(): Observable<Budget> {
    return this.update(createDefaultBudget());
  }

  /**
   * Returns one budget period by its YYYY-MM key.
   */
  public getPeriod(date: string): Observable<Period | undefined> {
    return from(this.loadBudget().then((budget) => budget.periods.find((period) => period.date === date)));
  }

  public upsertAccount(account: Account): Observable<Budget> {
    return from(
      this.mutateBudget((budget) => ({
        ...budget,
        accounts: this.upsertById(budget.accounts, {
          ...account,
          id: account.id || generateUUID(),
        }),
      }))
    ).pipe(tap((saved) => this.budgetSubject.next(saved)));
  }

  public deleteAccount(accountId: string): Observable<Budget> {
    return from(
      this.mutateBudget((budget) => ({
        ...budget,
        accounts: budget.accounts.filter((account) => account.id !== accountId),
        periods: budget.periods.map((period) => ({
          ...period,
          incomes: period.incomes.filter((income) => income.accountId !== accountId),
          expenses: period.expenses.filter((expense) => expense.accountId !== accountId),
        })),
      }))
    ).pipe(tap((saved) => this.budgetSubject.next(saved)));
  }

  public upsertExpenseCategory(category: ExpenseCategory): Observable<Budget> {
    return from(
      this.mutateBudget((budget) => ({
        ...budget,
        expenseCategories: this.upsertById(budget.expenseCategories, {
          ...category,
          id: category.id || generateUUID(),
        }),
      }))
    ).pipe(tap((saved) => this.budgetSubject.next(saved)));
  }

  public deleteExpenseCategory(categoryId: string): Observable<Budget> {
    return from(
      this.mutateBudget((budget) => ({
        ...budget,
        expenseCategories: budget.expenseCategories.filter((category) => category.id !== categoryId),
        periods: budget.periods.map((period) => ({
          ...period,
          expenses: period.expenses.filter((expense) => expense.categoryId !== categoryId),
        })),
      }))
    ).pipe(tap((saved) => this.budgetSubject.next(saved)));
  }

  public upsertIncomeType(incomeType: TypeOfIncome): Observable<Budget> {
    return from(
      this.mutateBudget((budget) => ({
        ...budget,
        incomeTypes: this.upsertById(budget.incomeTypes, {
          ...incomeType,
          id: incomeType.id || generateUUID(),
        }),
      }))
    ).pipe(tap((saved) => this.budgetSubject.next(saved)));
  }

  public deleteIncomeType(incomeTypeId: string): Observable<Budget> {
    return from(
      this.mutateBudget((budget) => {
        const nextIncomeTypes = budget.incomeTypes.filter((incomeType) => incomeType.id !== incomeTypeId);
        const fallbackIncomeType = nextIncomeTypes[0] ?? defaultIncomeTypes[0];

        return {
          ...budget,
          incomeTypes: nextIncomeTypes.length ? nextIncomeTypes : [{ ...fallbackIncomeType }],
          periods: budget.periods.map((period) => ({
            ...period,
            incomes: period.incomes.map((income) =>
              income.typeId === incomeTypeId
                ? { ...income, typeId: fallbackIncomeType.id, type: { ...fallbackIncomeType } }
                : income
            ),
          })),
        };
      })
    ).pipe(tap((saved) => this.budgetSubject.next(saved)));
  }

  public upsertPeriod(period: Period): Observable<Budget> {
    return from(
      this.mutateBudget((budget) => ({
        ...budget,
        periods: this.upsertByKey(
          budget.periods,
          this.normalizePeriod(period, budget.incomeTypes),
          (item) => item.date
        ),
      }))
    ).pipe(tap((saved) => this.budgetSubject.next(saved)));
  }

  public deletePeriod(date: string): Observable<Budget> {
    return from(
      this.mutateBudget((budget) => ({
        ...budget,
        periods: budget.periods.filter((period) => period.date !== date),
      }))
    ).pipe(tap((saved) => this.budgetSubject.next(saved)));
  }

  public upsertIncome(
    periodDate: string,
    income: Omit<IncomeItem, 'id' | 'typeId'> & { id?: string; type?: TypeOfIncome; typeId?: string }
  ): Observable<Budget> {
    return from(
      this.mutateBudget((budget) => {
        const resolved = this.resolveIncomeType(income.type, budget.incomeTypes);
        const nextIncome: IncomeItem = {
          ...income,
          id: income.id || generateUUID(),
          typeId: income.type?.id ?? (income as any).typeId ?? resolved.id,
          type: resolved,
        };

        return {
          ...budget,
          periods: this.upsertPeriodCollection(
            budget.periods,
            periodDate,
            budget.incomeTypes,
            (period) => ({
              ...period,
              incomes: this.upsertById(period.incomes, nextIncome),
            })
          ),
        };
      })
    ).pipe(tap((saved) => this.budgetSubject.next(saved)));
  }

  public deleteIncome(periodDate: string, incomeId: string): Observable<Budget> {
    return from(
      this.mutateBudget((budget) => ({
        ...budget,
        periods: this.upsertPeriodCollection(
          budget.periods,
          periodDate,
          budget.incomeTypes,
          (period) => ({
            ...period,
            incomes: period.incomes.filter((income) => income.id !== incomeId),
          })
        ),
      }))
    ).pipe(tap((saved) => this.budgetSubject.next(saved)));
  }

  public upsertExpense(
    periodDate: string,
    expense: Omit<ExpenseItem, 'id'> & { id?: string }
  ): Observable<Budget> {
    return from(
      this.mutateBudget((budget) => {
        const nextExpense: ExpenseItem = {
          ...expense,
          id: expense.id || generateUUID(),
        };

        return {
          ...budget,
          periods: this.upsertPeriodCollection(
            budget.periods,
            periodDate,
            budget.incomeTypes,
            (period) => ({
              ...period,
              expenses: this.upsertById(period.expenses, nextExpense),
            })
          ),
        };
      })
    ).pipe(tap((saved) => this.budgetSubject.next(saved)));
  }

  public deleteExpense(periodDate: string, expenseId: string): Observable<Budget> {
    return from(
      this.mutateBudget((budget) => ({
        ...budget,
        periods: this.upsertPeriodCollection(
          budget.periods,
          periodDate,
          budget.incomeTypes,
          (period) => ({
            ...period,
            expenses: period.expenses.filter((expense) => expense.id !== expenseId),
          })
        ),
      }))
    ).pipe(tap((saved) => this.budgetSubject.next(saved)));
  }

  private async mutateBudget(project: (budget: Budget) => Budget): Promise<Budget> {
    const current = await this.loadBudget();
    return this.saveBudget(project(current));
  }

  private async loadBudget(): Promise<Budget> {
    const existing = await db.budgets.get(BUDGET_ID);

    if (!existing) {
      return this.saveBudget(createDefaultBudget());
    }

    return this.normalizeBudget(existing);
  }

  private async saveBudget(budget: Budget): Promise<Budget> {
    const normalized = this.normalizeBudget(budget);

    await db.budgets.put({
      ...normalized,
      id: BUDGET_ID,
    });

    return normalized;
  }

  private normalizeBudget(budget: Budget): Budget {
    const incomeTypes = (budget.incomeTypes ?? defaultIncomeTypes).map((incomeType) => ({ ...incomeType }));

    return {
      periods: (budget.periods ?? [])
        .map((period) => this.normalizePeriod(period, incomeTypes))
        .filter((period) => period.incomes.length > 0 || period.expenses.length > 0),
      accounts: (budget.accounts ?? []).map((account) => ({ ...account })),
      expenseCategories: (budget.expenseCategories ?? []).map((category) => ({ ...category })),
      incomeTypes,
    };
  }

  private normalizePeriod(period: Period, incomeTypes: TypeOfIncome[]): Period {
    return {
      date: period.date,
      incomes: (period.incomes ?? []).map((income) => {
        const candidate = income.typeId ? ({ id: income.typeId } as TypeOfIncome) : income.type;
        const resolved = this.resolveIncomeType(candidate, incomeTypes);
        const typeId = (income as any).typeId ?? resolved.id;

        return {
          ...income,
          typeId,
          type: resolved,
          plannedDate: income.plannedDate || undefined,
          realDate: income.realDate || undefined,
          deductedFromIncomeId: income.deductedFromIncomeId || undefined,
        };
      }),
      expenses: (period.expenses ?? []).map((expense) => ({
        ...expense,
        note: expense.note ?? '',
        plannedDate: expense.plannedDate || undefined,
        realDate: expense.realDate || undefined,
        incomeId: resolveExpenseIncomeId(expense, period.incomes ?? []),
      })),
    };
  }

  private upsertPeriodCollection(
    periods: Period[],
    periodDate: string,
    incomeTypes: TypeOfIncome[],
    updatePeriod: (period: Period) => Period
  ): Period[] {
    const existing = periods.find((period) => period.date === periodDate) ?? {
      date: periodDate,
      incomes: [],
      expenses: [],
    };

    const updated = this.normalizePeriod(updatePeriod(existing), incomeTypes);
    return this.upsertByKey(periods, updated, (period) => period.date);
  }

  private resolveIncomeType(
    candidate: TypeOfIncome | undefined,
    availableIncomeTypes: TypeOfIncome[]
  ): TypeOfIncome {
    if (candidate?.id) {
      const matched = availableIncomeTypes.find((incomeType) => incomeType.id === candidate.id);

      if (matched) {
        return { ...matched };
      }

      return {
        id: candidate.id,
        name: candidate.name || candidate.id,
        saving: !!candidate.saving,
      };
    }

    return { ...(availableIncomeTypes[0] ?? defaultIncomeTypes[0]) };
  }

  private upsertById<T extends { id: string }>(collection: T[], item: T): T[] {
    const index = collection.findIndex((entry) => entry.id === item.id);

    if (index === -1) {
      return [...collection, item];
    }

    return collection.map((entry, currentIndex) => (currentIndex === index ? item : entry));
  }

  private upsertByKey<T>(collection: T[], item: T, getKey: (value: T) => string): T[] {
    const itemKey = getKey(item);
    const index = collection.findIndex((entry) => getKey(entry) === itemKey);

    if (index === -1) {
      return [...collection, item];
    }

    return collection.map((entry, currentIndex) => (currentIndex === index ? item : entry));
  }
}
