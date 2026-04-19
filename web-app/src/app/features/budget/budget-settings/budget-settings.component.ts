import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BudgetService } from '../../../shared/services/budget.service';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import {
  Account,
  Budget,
  ExpenseCategory,
  Period,
  TypeOfIncome,
} from '../../../shared/models/budget/budget.model';
import { generateUUID } from '../../../shared/utils';

@Component({
  standalone: true,
  selector: 'todo-budget-settings',
  templateUrl: './budget-settings.component.html',
  styleUrls: ['./budget-settings.component.scss'],
  imports: [FormsModule],
})
export class BudgetSettingsComponent implements OnInit {
  private readonly budgetService = inject(BudgetService);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly router = inject(Router);

  public budget: Budget | null = null;
  public isLoading = true;
  public isSaving = false;

  public calendarYear = new Date().getFullYear();
  public newPeriodDate = '';
  public copyPeriodData = false;
  public copyFromPeriodDate = '';
  public selectedAccountId = '';
  public accountFormName = '';
  public selectedIncomeTypeId = '';
  public incomeTypeFormName = '';
  public incomeTypeFormSaving = false;
  public selectedExpenseCategoryId = '';
  public expenseCategoryFormName = '';
  public expenseCategoryFormIcon = '';

  public ngOnInit(): void {
    this.loadBudget();
  }

  public goToBudget(): void {
    this.router.navigate(['/budget']);
  }

  public get sortedPeriods(): Period[] {
    if (!this.budget) {
      return [];
    }

    return [...this.budget.periods].sort((a, b) => b.date.localeCompare(a.date));
  }

  public get calendarMonths(): Array<{
    key: string;
    label: string;
    period: Period | null;
  }> {
    const months: Array<{ key: string; label: string; period: Period | null }> = [];

    for (let month = 1; month <= 12; month += 1) {
      const key = `${this.calendarYear}-${String(month).padStart(2, '0')}`;
      const label = new Date(this.calendarYear, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long' });
      const period = this.sortedPeriods.find((entry) => entry.date === key) ?? null;
      months.push({ key, label, period });
    }

    return months;
  }

  public get isSelectedEmptyPeriod(): boolean {
    if (!this.newPeriodDate) {
      return false;
    }

    return !this.sortedPeriods.some((period) => period.date === this.newPeriodDate);
  }

  public get sortedAccounts(): Account[] {
    if (!this.budget) {
      return [];
    }

    return [...this.budget.accounts].sort((a, b) => a.name.localeCompare(b.name, 'fr-FR', { sensitivity: 'base' }));
  }

  public get sortedIncomeTypes(): TypeOfIncome[] {
    if (!this.budget) {
      return [];
    }

    return [...this.budget.incomeTypes].sort((a, b) => a.name.localeCompare(b.name, 'fr-FR', { sensitivity: 'base' }));
  }

  public get sortedExpenseCategories(): ExpenseCategory[] {
    if (!this.budget) {
      return [];
    }

    return [...this.budget.expenseCategories].sort((a, b) =>
      a.name.localeCompare(b.name, 'fr-FR', { sensitivity: 'base' })
    );
  }

  public goToPreviousYear(): void {
    this.calendarYear -= 1;
  }

  public goToNextYear(): void {
    this.calendarYear += 1;
  }

  public onPeriodDateChange(): void {
    if (!this.newPeriodDate) {
      return;
    }

    const [yearRaw] = this.newPeriodDate.split('-');
    const year = Number(yearRaw);

    if (year > 0) {
      this.calendarYear = year;
    }
  }

  public openPeriod(periodDate: string): void {
    this.router.navigate(['/budget'], { queryParams: { month: periodDate } });
  }

  public selectOrOpenPeriod(monthKey: string): void {
    const existingPeriod = this.sortedPeriods.find((period) => period.date === monthKey);

    if (existingPeriod) {
      this.openPeriod(monthKey);
      return;
    }

    this.newPeriodDate = monthKey;
    this.onPeriodDateChange();
  }

  public addPeriod(): void {
    if (this.isSaving || !this.newPeriodDate || !this.budget) {
      return;
    }

    if (this.budget.periods.some((period) => period.date === this.newPeriodDate)) {
      return;
    }

    const sourcePeriod =
      this.copyPeriodData && this.copyFromPeriodDate
        ? this.sortedPeriods.find((period) => period.date === this.copyFromPeriodDate) ?? null
        : null;
    const copiedData = sourcePeriod ? this.clonePeriodData(sourcePeriod) : { incomes: [], expenses: [] };

    this.isSaving = true;

    this.budgetService
      .upsertPeriod({
        date: this.newPeriodDate,
        incomes: copiedData.incomes,
        expenses: copiedData.expenses,
      })
      .subscribe({
      next: (budget) => {
        this.budget = budget;
        this.copyPeriodData = false;
        this.copyFromPeriodDate = '';
        this.newPeriodDate = '';
        this.isSaving = false;
      },
      error: () => {
        this.isSaving = false;
      },
    });
  }

  public onAccountSelectionChange(): void {
    const selected = this.sortedAccounts.find((account) => account.id === this.selectedAccountId);
    this.accountFormName = selected?.name ?? '';
  }

  public addAccount(): void {
    if (this.isSaving || !this.accountFormName.trim()) {
      return;
    }

    this.isSaving = true;

    this.budgetService
      .upsertAccount({
        id: generateUUID(),
        name: this.accountFormName.trim(),
      })
      .subscribe({
        next: (budget) => {
          this.budget = budget;
          this.selectedAccountId = '';
          this.accountFormName = '';
          this.isSaving = false;
        },
        error: () => {
          this.isSaving = false;
        },
      });
  }

  public saveSelectedAccount(): void {
    const selected = this.sortedAccounts.find((account) => account.id === this.selectedAccountId);

    if (this.isSaving || !this.accountFormName.trim()) {
      return;
    }

    if (!selected) {
      this.addAccount();
      return;
    }

    this.isSaving = true;

    this.budgetService
      .upsertAccount({
        ...selected,
        name: this.accountFormName.trim(),
      })
      .subscribe({
        next: (budget) => {
          this.budget = budget;
          this.onAccountSelectionChange();
          this.isSaving = false;
        },
        error: () => {
          this.isSaving = false;
        },
      });
  }

  public deleteSelectedAccount(): void {
    const selected = this.sortedAccounts.find((account) => account.id === this.selectedAccountId);

    if (this.isSaving || !selected) {
      return;
    }

    this.confirmDialogService
      .confirm({
        title: 'Supprimer le compte ?',
        message: `Le compte ${selected.name} et ses revenus/depenses lies seront supprimes.`,
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
        variant: 'danger',
      })
      .subscribe((confirmed) => {
        if (!confirmed || this.isSaving) {
          return;
        }

        this.isSaving = true;

        this.budgetService.deleteAccount(selected.id).subscribe({
          next: (budget) => {
            this.budget = budget;
            this.selectedAccountId = '';
            this.accountFormName = '';
            this.isSaving = false;
          },
          error: () => {
            this.isSaving = false;
          },
        });
      });
  }

  public onIncomeTypeSelectionChange(): void {
    const selected = this.sortedIncomeTypes.find((incomeType) => incomeType.id === this.selectedIncomeTypeId);
    this.incomeTypeFormName = selected?.name ?? '';
    this.incomeTypeFormSaving = selected?.saving ?? false;
  }

  public addIncomeType(): void {
    if (this.isSaving || !this.incomeTypeFormName.trim()) {
      return;
    }

    this.isSaving = true;

    this.budgetService
      .upsertIncomeType({
        id: generateUUID(),
        name: this.incomeTypeFormName.trim(),
        saving: this.incomeTypeFormSaving,
      })
      .subscribe({
        next: (budget) => {
          this.budget = budget;
          this.selectedIncomeTypeId = '';
          this.incomeTypeFormName = '';
          this.incomeTypeFormSaving = false;
          this.isSaving = false;
        },
        error: () => {
          this.isSaving = false;
        },
      });
  }

  public saveSelectedIncomeType(): void {
    const selected = this.sortedIncomeTypes.find((incomeType) => incomeType.id === this.selectedIncomeTypeId);

    if (this.isSaving || !this.incomeTypeFormName.trim()) {
      return;
    }

    if (!selected) {
      this.addIncomeType();
      return;
    }

    this.isSaving = true;

    this.budgetService
      .upsertIncomeType({
        ...selected,
        name: this.incomeTypeFormName.trim(),
        saving: this.incomeTypeFormSaving,
      })
      .subscribe({
        next: (budget) => {
          this.budget = budget;
          this.onIncomeTypeSelectionChange();
          this.isSaving = false;
        },
        error: () => {
          this.isSaving = false;
        },
      });
  }

  public deleteSelectedIncomeType(): void {
    const selected = this.sortedIncomeTypes.find((incomeType) => incomeType.id === this.selectedIncomeTypeId);

    if (this.isSaving || !this.budget || this.budget.incomeTypes.length <= 1) {
      return;
    }

    if (!selected) {
      return;
    }

    this.confirmDialogService
      .confirm({
        title: 'Supprimer ce type de revenu ?',
        message: `Le type ${selected.name} sera retire de la liste.`,
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
        variant: 'danger',
      })
      .subscribe((confirmed) => {
        if (!confirmed || this.isSaving) {
          return;
        }

        this.isSaving = true;

        this.budgetService.deleteIncomeType(selected.id).subscribe({
          next: (budget) => {
            this.budget = budget;
            this.selectedIncomeTypeId = '';
            this.incomeTypeFormName = '';
            this.incomeTypeFormSaving = false;
            this.isSaving = false;
          },
          error: () => {
            this.isSaving = false;
          },
        });
      });
  }

  public onExpenseCategorySelectionChange(): void {
    const selected = this.sortedExpenseCategories.find(
      (expenseCategory) => expenseCategory.id === this.selectedExpenseCategoryId
    );
    this.expenseCategoryFormName = selected?.name ?? '';
    this.expenseCategoryFormIcon = selected?.icon ?? '';
  }

  public addExpenseCategory(): void {
    if (this.isSaving || !this.expenseCategoryFormName.trim()) {
      return;
    }

    this.isSaving = true;

    this.budgetService
      .upsertExpenseCategory({
        id: generateUUID(),
        name: this.expenseCategoryFormName.trim(),
        icon: this.expenseCategoryFormIcon.trim() || undefined,
      })
      .subscribe({
        next: (budget) => {
          this.budget = budget;
          this.selectedExpenseCategoryId = '';
          this.expenseCategoryFormName = '';
          this.expenseCategoryFormIcon = '';
          this.isSaving = false;
        },
        error: () => {
          this.isSaving = false;
        },
      });
  }

  public saveSelectedExpenseCategory(): void {
    const selected = this.sortedExpenseCategories.find(
      (expenseCategory) => expenseCategory.id === this.selectedExpenseCategoryId
    );

    if (this.isSaving || !this.expenseCategoryFormName.trim()) {
      return;
    }

    if (!selected) {
      this.addExpenseCategory();
      return;
    }

    this.isSaving = true;

    this.budgetService
      .upsertExpenseCategory({
        ...selected,
        name: this.expenseCategoryFormName.trim(),
        icon: this.expenseCategoryFormIcon.trim() || undefined,
      })
      .subscribe({
        next: (budget) => {
          this.budget = budget;
          this.onExpenseCategorySelectionChange();
          this.isSaving = false;
        },
        error: () => {
          this.isSaving = false;
        },
      });
  }

  public deleteSelectedExpenseCategory(): void {
    const selected = this.sortedExpenseCategories.find(
      (expenseCategory) => expenseCategory.id === this.selectedExpenseCategoryId
    );

    if (this.isSaving || !selected) {
      return;
    }

    this.confirmDialogService
      .confirm({
        title: 'Supprimer cette categorie ?',
        message: `La categorie ${selected.name} sera retiree et les depenses associees seront supprimees.`,
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
        variant: 'danger',
      })
      .subscribe((confirmed) => {
        if (!confirmed || this.isSaving) {
          return;
        }

        this.isSaving = true;

        this.budgetService.deleteExpenseCategory(selected.id).subscribe({
          next: (budget) => {
            this.budget = budget;
            this.selectedExpenseCategoryId = '';
            this.expenseCategoryFormName = '';
            this.expenseCategoryFormIcon = '';
            this.isSaving = false;
          },
          error: () => {
            this.isSaving = false;
          },
        });
      });
  }

  private loadBudget(): void {
    this.isLoading = true;

    this.budgetService.get().subscribe({
      next: (budget) => {
        this.budget = budget;
        this.calendarYear =
          Math.max(
            ...budget.periods.map((period) => Number(period.date.slice(0, 4))),
            new Date().getFullYear()
          ) || new Date().getFullYear();
        this.copyFromPeriodDate = budget.periods[0]?.date ?? '';
        this.selectedAccountId = budget.accounts[0]?.id ?? '';
        this.onAccountSelectionChange();
        this.selectedIncomeTypeId = budget.incomeTypes[0]?.id ?? '';
        this.onIncomeTypeSelectionChange();
        this.selectedExpenseCategoryId = budget.expenseCategories[0]?.id ?? '';
        this.onExpenseCategorySelectionChange();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  private clonePeriodData(sourcePeriod: Period): Pick<Period, 'incomes' | 'expenses'> {
    const incomeIdMap = new Map<string, string>();

    for (const income of sourcePeriod.incomes) {
      incomeIdMap.set(income.id, generateUUID());
    }

    const incomes = sourcePeriod.incomes.map((income) => ({
      ...income,
      id: incomeIdMap.get(income.id) ?? generateUUID(),
      type: { ...income.type },
      deductedFromIncomeId: income.deductedFromIncomeId
        ? incomeIdMap.get(income.deductedFromIncomeId) || undefined
        : undefined,
    }));

    const expenses = sourcePeriod.expenses.map((expense) => ({
      ...expense,
      id: generateUUID(),
    }));

    return {
      incomes,
      expenses,
    };
  }
}
