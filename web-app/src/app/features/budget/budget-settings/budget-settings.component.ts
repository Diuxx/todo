import { Component, HostListener, OnInit, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { BudgetService } from '../../../shared/services/budget.service';
import { SaveStatusComponent } from '../../../shared/components/save-status/save-status.component';
import { FormSaveState } from '../../../shared/services/save-action.service';
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
  imports: [FormsModule, SaveStatusComponent],
})
export class BudgetSettingsComponent implements OnInit {
  private readonly budgetService = inject(BudgetService);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  public budget: Budget | null = null;
  public isLoading = true;
  public isSaving = false;
  public saveState: FormSaveState = 'pristine';
  public saveErrorMessage: string | null = null;

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

  public get hasUnsavedBudgetEdits(): boolean {
    if (!this.budget) {
      return false;
    }

    const account = this.budget.accounts.find((entry) => entry.id === this.selectedAccountId);
    const category = this.budget.expenseCategories.find(
      (entry) => entry.id === this.selectedExpenseCategoryId
    );
    const incomeType = this.budget.incomeTypes.find(
      (entry) => entry.id === this.selectedIncomeTypeId
    );

    return (
      this.accountFormName.trim() !== (account?.name ?? '') ||
      this.expenseCategoryFormName.trim() !== (category?.name ?? '') ||
      this.expenseCategoryFormIcon.trim() !== (category?.icon ?? '') ||
      this.incomeTypeFormName.trim() !== (incomeType?.name ?? '') ||
      this.incomeTypeFormSaving !== (incomeType?.saving ?? false) ||
      (this.isSelectedEmptyPeriod && this.copyPeriodData)
    );
  }

  public async canDeactivate(): Promise<boolean> {
    if (this.isSaving) {
      return false;
    }

    if (!this.hasUnsavedBudgetEdits) {
      return true;
    }

    return firstValueFrom(this.confirmDialogService.confirm({
      title: 'Quitter sans enregistrer ?',
      message: 'Les modifications des listes du budget seront perdues.',
      confirmText: 'Quitter sans enregistrer',
      cancelText: 'Rester',
      variant: 'danger',
    }));
  }

  @HostListener('window:beforeunload', ['$event'])
  public warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.isSaving && !this.hasUnsavedBudgetEdits) {
      return;
    }

    event.preventDefault();
    event.returnValue = '';
  }

  public retryLoadingBudget(): void {
    this.loadBudget();
  }

  public goToBudget(): void {
    const month = this.getOriginMonth();
    this.router.navigate(['/budget'], month ? { queryParams: { month } } : {});
  }

  private getOriginMonth(): string | null {
    const month = this.route.snapshot.queryParamMap.get('month');
    return month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null;
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

    this.beginSaving();

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
        this.finishSaving();
      },
      error: (error) => {
        this.failSaving(error);
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

    this.beginSaving();

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
          this.finishSaving();
        },
        error: (error) => {
          this.failSaving(error);
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

    this.beginSaving();

    this.budgetService
      .upsertAccount({
        ...selected,
        name: this.accountFormName.trim(),
      })
      .subscribe({
        next: (budget) => {
          this.budget = budget;
          this.onAccountSelectionChange();
          this.finishSaving();
        },
        error: (error) => {
          this.failSaving(error);
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

        this.beginSaving();

        this.budgetService.deleteAccount(selected.id).subscribe({
          next: (budget) => {
            this.budget = budget;
            this.selectedAccountId = '';
            this.accountFormName = '';
            this.finishSaving();
          },
          error: (error) => {
            this.failSaving(error);
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

    this.beginSaving();

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
          this.finishSaving();
        },
        error: (error) => {
          this.failSaving(error);
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

    this.beginSaving();

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
          this.finishSaving();
        },
        error: (error) => {
          this.failSaving(error);
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

        this.beginSaving();

        this.budgetService.deleteIncomeType(selected.id).subscribe({
          next: (budget) => {
            this.budget = budget;
            this.selectedIncomeTypeId = '';
            this.incomeTypeFormName = '';
            this.incomeTypeFormSaving = false;
            this.finishSaving();
          },
          error: (error) => {
            this.failSaving(error);
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

    this.beginSaving();

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
          this.finishSaving();
        },
        error: (error) => {
          this.failSaving(error);
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

    this.beginSaving();

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
          this.finishSaving();
        },
        error: (error) => {
          this.failSaving(error);
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

        this.beginSaving();

        this.budgetService.deleteExpenseCategory(selected.id).subscribe({
          next: (budget) => {
            this.budget = budget;
            this.selectedExpenseCategoryId = '';
            this.expenseCategoryFormName = '';
            this.expenseCategoryFormIcon = '';
            this.finishSaving();
          },
          error: (error) => {
            this.failSaving(error);
          },
        });
      });
  }

  private loadBudget(): void {
    this.isLoading = true;

    this.budgetService.get().subscribe({
      next: (budget) => {
        this.budget = budget;
        const originMonth = this.getOriginMonth();
        this.calendarYear = originMonth
          ? Number(originMonth.slice(0, 4))
          : Math.max(
              ...budget.periods.map((period) => Number(period.date.slice(0, 4))),
              new Date().getFullYear()
            );
        this.copyFromPeriodDate = budget.periods[0]?.date ?? '';
        this.selectedAccountId = budget.accounts[0]?.id ?? '';
        this.onAccountSelectionChange();
        this.selectedIncomeTypeId = budget.incomeTypes[0]?.id ?? '';
        this.onIncomeTypeSelectionChange();
        this.selectedExpenseCategoryId = budget.expenseCategories[0]?.id ?? '';
        this.onExpenseCategorySelectionChange();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Unable to load budget administration:', error);
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
      typeId: (income as any).typeId ?? undefined,
      type: undefined,
      deductedFromIncomeId: income.deductedFromIncomeId
        ? incomeIdMap.get(income.deductedFromIncomeId) || undefined
        : undefined,
    }));

    const expenses = sourcePeriod.expenses.map((expense) => ({
      ...expense,
      id: generateUUID(),
      incomeId: expense.incomeId ? incomeIdMap.get(expense.incomeId) : undefined,
    }));

    return {
      incomes,
      expenses,
    };
  }
  private beginSaving(): void {
    this.isSaving = true;
    this.saveErrorMessage = null;
    this.saveState = 'saving';
  }

  private finishSaving(): void {
    this.isSaving = false;
    this.saveState = 'saved';
  }

  private failSaving(error: unknown): void {
    console.error('Unable to save budget administration:', error);
    this.isSaving = false;
    this.saveErrorMessage = "L'opération a échoué. Vérifiez les données et réessayez.";
    this.saveState = 'error';
  }

}
