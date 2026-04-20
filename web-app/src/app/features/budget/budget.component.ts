import { Component, OnInit, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Account,
  Budget,
  ExpenseCategory,
  ExpenseItem,
  ExpenseType,
  IncomeItem,
  Period,
  TypeOfIncome,
} from '../../shared/models/budget/budget.model';
import { BudgetService } from '../../shared/services/budget.service';
import { ConfirmDialogService } from '../../shared/services/confirm-dialog.service';
import { generateUUID } from '../../shared/utils';

@Component({
  standalone: true,
  selector: 'todo-budget',
  templateUrl: './budget.component.html',
  styleUrls: ['./budget.component.scss'],
  imports: [FormsModule, DecimalPipe],
})
export class BudgetComponent implements OnInit {
  private readonly budgetService = inject(BudgetService);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  public budget: Budget | null = null;
  public currentPeriod: Period | null = null;
  public activeMonth = this.startOfMonth(new Date());
  public isLoading = true;
  public isSaving = false;
  public copyPreviousMonthExpenses = false;
  public isIncomeModalVisible = false;
  public editingIncomeId: string | null = null;
  public incomeDraftName = '';
  public incomeDraftTypeId = '';
  public incomeDraftAccountId = '';
  public incomeDraftPlannedAmount = 0;
  public incomeDraftPlannedDate = '';
  public incomeDraftRealAmount = 0;
  public incomeDraftRealDate = '';
  public incomeDraftDeductedFromIncomeId = '';
  public isExpenseModalVisible = false;
  public editingExpenseId: string | null = null;
  public expenseDraftName = '';
  public expenseDraftType: ExpenseType = 'variable';
  public expenseDraftNote = '';
  public expenseDraftCategoryId = '';
  public expenseDraftAccountId = '';
  public expenseDraftPlannedAmount = 0;
  public expenseDraftPlannedDate = '';
  public expenseDraftRealAmount = 0;
  public expenseDraftRealDate = '';
  public expenseBankFilter = 'all';

  public ngOnInit(): void {
    const monthParam = this.route.snapshot.queryParamMap.get('month');

    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [yearRaw, monthRaw] = monthParam.split('-');
      const year = Number(yearRaw);
      const month = Number(monthRaw);

      if (year > 0 && month >= 1 && month <= 12) {
        this.activeMonth = new Date(year, month - 1, 1);
      }
    }

    this.loadBudgetAndPeriod();
  }

  public goToPreviousMonth(): void {
    this.activeMonth = new Date(this.activeMonth.getFullYear(), this.activeMonth.getMonth() - 1, 1);
    this.loadCurrentPeriod();
  }

  public goToNextMonth(): void {
    this.activeMonth = new Date(this.activeMonth.getFullYear(), this.activeMonth.getMonth() + 1, 1);
    this.loadCurrentPeriod();
  }

  public goToBudgetStats(): void {
    this.router.navigate(['/budget-stats']);
  }

  public goToBudgetSettings(): void {
    this.router.navigate(['/budget-settings']);
  }

  public confirmDeleteCurrentMonth(): void {
    if (this.isSaving || !this.currentPeriod) {
      return;
    }

    this.confirmDialogService
      .confirm({
        title: 'Supprimer ce mois ?',
        message: `Cette action supprimera toutes les données budget de ${this.activeMonthLabel}.`,
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
        variant: 'danger',
      })
      .subscribe((confirmed) => {
        if (!confirmed || this.isSaving) {
          return;
        }

        this.isSaving = true;
        this.budgetService.deletePeriod(this.activeMonthKey).subscribe({
          next: (budget) => {
            this.budget = budget;
            this.currentPeriod = this.findPeriodForActiveMonth(budget);
            this.isIncomeModalVisible = false;
            this.isExpenseModalVisible = false;
            this.editingIncomeId = null;
            this.editingExpenseId = null;
            this.isSaving = false;
          },
          error: () => {
            this.isSaving = false;
          },
        });
      });
  }

  public createFirstEntry(): void {
    if (this.isSaving || this.currentPeriod) {
      return;
    }

    const previousPeriod = this.previousPeriod;

    if (this.copyPreviousMonthExpenses && previousPeriod?.expenses.length) {
      this.createPeriodWithCopiedExpenses(previousPeriod.expenses);
      return;
    }

    const accountId = this.budget?.accounts[0]?.id;
    const defaultIncomeType = this.budget?.incomeTypes[0];

    if (!accountId || !defaultIncomeType) {
      return;
    }

    this.isSaving = true;

    this.budgetService
      .upsertIncome(this.activeMonthKey, {
        name: 'Nouveau revenu',
        typeId: defaultIncomeType.id,
        plannedAmount: 0,
        realAmount: 0,
        accountId,
      })
      .subscribe({
        next: (budget) => {
          this.budget = budget;
          this.currentPeriod = this.findPeriodForActiveMonth(budget);
          this.isSaving = false;
        },
        error: () => {
          this.isSaving = false;
        },
      });
  }

  public get previousPeriodHasExpenses(): boolean {
    return !!this.previousPeriod?.expenses.length;
  }

  public get activeMonthLabel(): string {
    return this.activeMonth.toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    });
  }

  public get activeMonthKey(): string {
    const year = this.activeMonth.getFullYear();
    const month = String(this.activeMonth.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  public get createButtonLabel(): string {
    if (this.copyPreviousMonthExpenses && this.previousPeriodHasExpenses) {
      return 'Créer en copiant les données du mois précédent';
    }

    return 'Créer une première entrée';
  }

  public get totalIncomePlanned(): number {
    if (!this.currentPeriod) {
      return 0;
    }

    return this.currentPeriod.incomes.reduce((sum, income) => sum + income.plannedAmount, 0);
  }

  public get totalIncomeReal(): number {
    if (!this.currentPeriod) {
      return 0;
    }

    return this.currentPeriod.incomes.reduce((sum, income) => sum + income.realAmount, 0);
  }

  public get totalExpensePlanned(): number {
    if (!this.currentPeriod) {
      return 0;
    }

    return this.currentPeriod.expenses.reduce((sum, expense) => sum + expense.plannedAmount, 0);
  }

  public get totalExpenseReal(): number {
    if (!this.currentPeriod) {
      return 0;
    }

    return this.currentPeriod.expenses.reduce((sum, expense) => sum + expense.realAmount, 0);
  }

  public get incomeRealVsPlannedPercent(): number {
    return this.computePercentage(this.totalIncomeReal, this.totalIncomePlanned);
  }

  public get plannedExpenseVsIncomePercent(): number {
    return this.computePercentage(this.totalExpensePlanned, this.totalIncomePlanned);
  }

  public get realExpenseVsIncomePercent(): number {
    return this.computePercentage(this.totalExpenseReal, this.totalIncomeReal);
  }

  public get expenseModalAccounts(): Account[] {
    if (!this.budget) {
      return [];
    }

    const monthlyAccounts = this.periodAccounts;

    if (!this.expenseDraftAccountId) {
      return [...monthlyAccounts].sort((a, b) => a.name.localeCompare(b.name, 'fr-FR', { sensitivity: 'base' }));
    }

    if (monthlyAccounts.some((account) => account.id === this.expenseDraftAccountId)) {
      return [...monthlyAccounts].sort((a, b) => a.name.localeCompare(b.name, 'fr-FR', { sensitivity: 'base' }));
    }

    const selectedAccount = this.budget.accounts.find((account) => account.id === this.expenseDraftAccountId);
    const merged = selectedAccount ? [...monthlyAccounts, selectedAccount] : monthlyAccounts;
    return merged.sort((a, b) => a.name.localeCompare(b.name, 'fr-FR', { sensitivity: 'base' }));
  }

  public get sortedBudgetAccounts(): Account[] {
    if (!this.budget) {
      return [];
    }

    return [...this.budget.accounts]
        // .filter(a => this.currentPeriod?.incomes.some(i => i.accountId === a.id))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr-FR', { sensitivity: 'base' }));
  }

  public get sortedExpenseCategories(): ExpenseCategory[] {
    if (!this.budget) {
      return [];
    }

    return [...this.budget.expenseCategories].sort((a, b) =>
      a.name.localeCompare(b.name, 'fr-FR', { sensitivity: 'base' })
    );
  }

  public get sortedIncomeTypes(): TypeOfIncome[] {
    if (!this.budget) {
      return [];
    }

    return [...this.budget.incomeTypes].sort((a, b) => a.name.localeCompare(b.name, 'fr-FR', { sensitivity: 'base' }));
  }

  public get savingIncomeYearProgress(): Array<{
    typeId: string;
    typeName: string;
    planned: number;
    real: number;
  }> {
    if (!this.budget) {
      return [];
    }

    const yearPrefix = `${this.activeMonth.getFullYear()}-`;
    const totalsByType = new Map<string, { typeId: string; typeName: string; planned: number; real: number }>();

    for (const period of this.budget.periods.filter((entry) => entry.date.startsWith(yearPrefix))) {
      for (const income of period.incomes) {
        const incomeType = this.budget!.incomeTypes.find((t) => t.id === income.typeId);
        if (!incomeType || !incomeType.saving) continue;

        const current = totalsByType.get(incomeType.id) ?? {
          typeId: incomeType.id,
          typeName: incomeType.name,
          planned: 0,
          real: 0,
        };

        current.planned += income.plannedAmount;
        current.real += income.realAmount;
        totalsByType.set(incomeType.id, current);
      }
    }

    return Array.from(totalsByType.values())
      .filter((entry) => entry.planned > 0 || entry.real > 0)
      .sort((a, b) => b.real + b.planned - (a.real + a.planned));
  }

  public get hasSavingIncomeYearProgress(): boolean {
    return this.savingIncomeYearProgress.length > 0;
  }

  public get savingIncomeYearMaxTotal(): number {
    return this.savingIncomeYearProgress.reduce((max, entry) => Math.max(max, entry.planned + entry.real), 0);
  }

  public getRingBackground(percent: number, color: string): string {
    const boundedPercent = Math.max(0, Math.min(percent, 100));
    return `conic-gradient(${color} 0 ${boundedPercent}%, #e4e8f0 ${boundedPercent}% 100%)`;
  }

  public openIncomeModal(income?: IncomeItem): void {
    if (!this.currentPeriod || !this.budget?.accounts.length) {
      return;
    }

    const deductedPlanned = income ? this.getIncomeDeductedPlanned(income.id) : 0;
    const deductedReal = income ? this.getIncomeDeductedReal(income.id) : 0;

    this.editingIncomeId = income?.id ?? null;
    this.incomeDraftName = income?.name ?? '';
    this.incomeDraftTypeId = income?.typeId ?? this.budget.incomeTypes[0]?.id ?? '';
    this.incomeDraftAccountId = income?.accountId || this.budget.accounts[0].id;
    this.incomeDraftPlannedAmount = (income?.plannedAmount ?? 0) + deductedPlanned;
    this.incomeDraftPlannedDate = income?.plannedDate ?? '';
    this.incomeDraftRealAmount = (income?.realAmount ?? 0) + deductedReal;
    this.incomeDraftRealDate = income?.realDate ?? '';
    this.incomeDraftDeductedFromIncomeId = income?.deductedFromIncomeId ?? '';
    this.isIncomeModalVisible = true;
  }

  public closeIncomeModal(): void {
    if (this.isSaving) {
      return;
    }

    this.editingIncomeId = null;
    this.incomeDraftName = '';
    this.incomeDraftTypeId = '';
    this.incomeDraftPlannedDate = '';
    this.incomeDraftRealDate = '';
    this.incomeDraftDeductedFromIncomeId = '';
    this.isIncomeModalVisible = false;
  }

  public saveIncomeEntry(): void {
    if (this.isSaving || !this.currentPeriod || !this.incomeDraftAccountId || !this.budget) {
      return;
    }

    const selectedAccount = this.budget.accounts.find((account) => account.id === this.incomeDraftAccountId);
    const defaultIncomeType = this.budget.incomeTypes[0];
    const selectedIncomeType = this.budget.incomeTypes.find((incomeType) => incomeType.id === this.incomeDraftTypeId);

    if (!selectedAccount || !defaultIncomeType) {
      return;
    }

    const currentDeductedPlanned = this.editingIncomeId ? this.getIncomeDeductedPlanned(this.editingIncomeId) : 0;
    const currentDeductedReal = this.editingIncomeId ? this.getIncomeDeductedReal(this.editingIncomeId) : 0;
    const nextPlannedAmount = Math.max(0, (Number(this.incomeDraftPlannedAmount) || 0) - currentDeductedPlanned);
    const nextPlannedDate = this.incomeDraftPlannedDate || undefined;
    const nextRealAmount = Math.max(0, (Number(this.incomeDraftRealAmount) || 0) - currentDeductedReal);
    const nextRealDate = this.incomeDraftRealDate || undefined;
    const nextDeductedFromIncomeId = this.incomeDraftDeductedFromIncomeId || undefined;
    const nextIncomeName = this.incomeDraftName.trim() || `Revenu - ${selectedAccount.name}`;
    const currentPeriodDate = this.currentPeriod.date;

    this.isSaving = true;

    const nextBudget: Budget = {
      ...this.budget,
      periods: this.budget.periods.map((period) => {
        if (period.date !== currentPeriodDate) {
          return period;
        }

        let incomes = [...period.incomes];
        const existingIncome = this.editingIncomeId
          ? incomes.find((income) => income.id === this.editingIncomeId)
          : undefined;

        if (existingIncome?.deductedFromIncomeId) {
          const previousTargetIncome = incomes.find((income) => income.id === existingIncome.deductedFromIncomeId);

          if (previousTargetIncome) {
            incomes = this.upsertIncomeInCollection(incomes, {
              ...previousTargetIncome,
              plannedAmount: previousTargetIncome.plannedAmount + existingIncome.plannedAmount,
              realAmount: previousTargetIncome.realAmount + existingIncome.realAmount,
            });
          }
        }

        const nextIncome: IncomeItem = {
          id: this.editingIncomeId || generateUUID(),
          name: nextIncomeName,
          typeId: selectedIncomeType?.id ?? existingIncome?.typeId ?? defaultIncomeType.id,
          accountId: selectedAccount.id,
          plannedAmount: nextPlannedAmount,
          plannedDate: nextPlannedDate,
          realAmount: nextRealAmount,
          realDate: nextRealDate,
          deductedFromIncomeId: nextDeductedFromIncomeId,
        };

        incomes = this.upsertIncomeInCollection(incomes, nextIncome);

        if (nextDeductedFromIncomeId && nextDeductedFromIncomeId !== nextIncome.id) {
          const targetIncome = incomes.find((income) => income.id === nextDeductedFromIncomeId);

          if (targetIncome) {
            incomes = this.upsertIncomeInCollection(incomes, {
              ...targetIncome,
              plannedAmount: Math.max(0, targetIncome.plannedAmount - nextIncome.plannedAmount),
              realAmount: Math.max(0, targetIncome.realAmount - nextIncome.realAmount),
            });
          }
        }

        return {
          ...period,
          incomes,
        };
      }),
    };

    this.budgetService.update(nextBudget).subscribe({
      next: (budget) => {
        this.budget = budget;
        this.currentPeriod = this.findPeriodForActiveMonth(budget);
        this.isSaving = false;
        this.editingIncomeId = null;
        this.incomeDraftName = '';
        this.incomeDraftTypeId = '';
        this.incomeDraftPlannedDate = '';
        this.incomeDraftRealDate = '';
        this.incomeDraftDeductedFromIncomeId = '';
        this.isIncomeModalVisible = false;
      },
      error: () => {
        this.isSaving = false;
      },
    });
  }

  public deleteIncomeEntry(): void {
    if (this.isSaving || !this.currentPeriod || !this.budget || !this.editingIncomeId) {
      return;
    }

    const currentPeriodDate = this.currentPeriod.date;
    const incomeIdToDelete = this.editingIncomeId;

    this.isSaving = true;

    const nextBudget: Budget = {
      ...this.budget,
      periods: this.budget.periods.map((period) => {
        if (period.date !== currentPeriodDate) {
          return period;
        }

        const incomeToDelete = period.incomes.find((income) => income.id === incomeIdToDelete);

        if (!incomeToDelete) {
          return period;
        }

        let incomes = [...period.incomes];

        if (incomeToDelete.deductedFromIncomeId) {
          const sourceIncome = incomes.find((income) => income.id === incomeToDelete.deductedFromIncomeId);

          if (sourceIncome) {
            incomes = this.upsertIncomeInCollection(incomes, {
              ...sourceIncome,
              plannedAmount: sourceIncome.plannedAmount + incomeToDelete.plannedAmount,
              realAmount: sourceIncome.realAmount + incomeToDelete.realAmount,
            });
          }
        }

        incomes = incomes
          .filter((income) => income.id !== incomeIdToDelete)
          .map((income) =>
            income.deductedFromIncomeId === incomeIdToDelete
              ? { ...income, deductedFromIncomeId: undefined }
              : income
          );

        return {
          ...period,
          incomes,
        };
      }),
    };

    this.budgetService.update(nextBudget).subscribe({
      next: (budget) => {
        this.budget = budget;
        this.currentPeriod = this.findPeriodForActiveMonth(budget);
        this.isSaving = false;
        this.editingIncomeId = null;
        this.incomeDraftName = '';
        this.incomeDraftTypeId = '';
        this.incomeDraftPlannedDate = '';
        this.incomeDraftRealDate = '';
        this.incomeDraftDeductedFromIncomeId = '';
        this.isIncomeModalVisible = false;
      },
      error: () => {
        this.isSaving = false;
      },
    });
  }

  public get incomeDeductionOptions(): IncomeItem[] {
    if (!this.currentPeriod) {
      return [];
    }

    return this.currentPeriod.incomes
      .filter((income) => income.id !== this.editingIncomeId)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr-FR', { sensitivity: 'base' }));
  }

  public getIncomeDeductedPlanned(incomeId: string): number {
    if (!this.currentPeriod) {
      return 0;
    }

    return this.currentPeriod.incomes
      .filter((income) => income.deductedFromIncomeId === incomeId)
      .reduce((sum, income) => sum + income.plannedAmount, 0);
  }

  public getIncomeDeductedReal(incomeId: string): number {
    if (!this.currentPeriod) {
      return 0;
    }

    return this.currentPeriod.incomes
      .filter((income) => income.deductedFromIncomeId === incomeId)
      .reduce((sum, income) => sum + income.realAmount, 0);
  }

  public getIncomeGrossPlanned(income: IncomeItem): number {
    return income.plannedAmount + this.getIncomeDeductedPlanned(income.id);
  }

  public getIncomeGrossReal(income: IncomeItem): number {
    return income.realAmount + this.getIncomeDeductedReal(income.id);
  }

  /**
   * Calculate the income amount after deductions, ensuring it doesn't go below zero
   */
  public getIncomeWithAllDeductionsPlanned(income: IncomeItem): number {
    const gross = this.getIncomeGrossPlanned(income);
    const incomeDeductions = this.getIncomeDeductedPlanned(income.id);
    const accountExpenses = this.getExpensePlannedByAccount(income.accountId);
    return Math.max(0, gross - incomeDeductions - accountExpenses);
  }

  public getIncomeWithAllDeductionsReal(income: IncomeItem): number {
    const gross = this.getIncomeGrossReal(income);
    const incomeDeductions = this.getIncomeDeductedReal(income.id);
    const accountExpenses = this.getExpenseRealByAccount(income.accountId);
    return Math.max(0, gross - incomeDeductions - accountExpenses);
  }

  public hasIncomeDeductions(income: IncomeItem): boolean {
    return this.getIncomeDeductedPlanned(income.id) > 0 || this.getIncomeDeductedReal(income.id) > 0;
  }

  public hasAccountExpenseDeductions(accountId: string): boolean {
    return this.getExpensePlannedByAccount(accountId) > 0 || this.getExpenseRealByAccount(accountId) > 0;
  }

  public getIncomeDeductionSourceName(income: IncomeItem): string {
    if (!this.currentPeriod || !income.deductedFromIncomeId) {
      return '';
    }

    return this.currentPeriod.incomes.find((entry) => entry.id === income.deductedFromIncomeId)?.name || '';
  }

  public getIncomeDeductionPercent(income: IncomeItem): number | null {
    if (!this.currentPeriod || !income.deductedFromIncomeId) return null;
    const source = this.currentPeriod.incomes.find((entry) => entry.id === income.deductedFromIncomeId);
    if (!source) return null;
    const sourceGross = this.getIncomeGrossPlanned(source);
    if (sourceGross === 0) return null;
    return Math.round((income.plannedAmount / sourceGross) * 100);
  }

  public get periodAccounts(): Account[] {
    if (!this.currentPeriod || !this.budget) return [];
    const usedIds = new Set(this.currentPeriod.incomes.map((i) => i.accountId));
    return this.budget.accounts
      .filter((a) => usedIds.has(a.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr-FR', { sensitivity: 'base' }));
  }

  public get incomeModalTitle(): string {
    return this.editingIncomeId ? "Modifier l'entrée d'argent" : "Ajouter une entrée d'argent";
  }

  public get incomeSubmitLabel(): string {
    if (this.isSaving) {
      return 'Enregistrement...';
    }

    return this.editingIncomeId ? 'Mettre à jour' : 'Valider';
  }

  public openExpenseModal(expense?: ExpenseItem): void {
    if (!this.currentPeriod || !this.budget?.expenseCategories.length) {
      return;
    }

    const defaultAccountId = this.periodAccounts[0]?.id ?? this.budget.accounts[0]?.id ?? '';
    const defaultCategoryId = this.budget.expenseCategories[0].id;

    if (!expense && !defaultAccountId) {
      return;
    }

    this.editingExpenseId = expense?.id ?? null;
    this.expenseDraftName = expense?.name ?? '';
    this.expenseDraftType = expense?.type ?? 'variable';
    this.expenseDraftNote = expense?.note ?? '';
    this.expenseDraftCategoryId = expense?.categoryId ?? defaultCategoryId;
    this.expenseDraftAccountId = expense?.accountId ?? defaultAccountId;
    this.expenseDraftPlannedAmount = expense?.plannedAmount ?? 0;
    this.expenseDraftPlannedDate = expense?.plannedDate ?? '';
    this.expenseDraftRealAmount = expense?.realAmount ?? 0;
    this.expenseDraftRealDate = expense?.realDate ?? '';
    this.isExpenseModalVisible = true;
  }

  public closeExpenseModal(): void {
    if (this.isSaving) {
      return;
    }

    this.editingExpenseId = null;
    this.expenseDraftPlannedDate = '';
    this.expenseDraftRealDate = '';
    this.isExpenseModalVisible = false;
  }

  public saveExpenseEntry(): void {
    if (
      this.isSaving ||
      !this.currentPeriod ||
      !this.expenseDraftName.trim() ||
      !this.expenseDraftCategoryId ||
      !this.expenseDraftAccountId
    ) {
      return;
    }

    this.isSaving = true;

    this.budgetService
      .upsertExpense(this.currentPeriod.date, {
        id: this.editingExpenseId || undefined,
        name: this.expenseDraftName.trim(),
        type: this.expenseDraftType,
        note: this.expenseDraftNote.trim(),
        categoryId: this.expenseDraftCategoryId,
        accountId: this.expenseDraftAccountId,
        plannedAmount: Number(this.expenseDraftPlannedAmount) || 0,
        plannedDate: this.expenseDraftPlannedDate || undefined,
        realAmount: Number(this.expenseDraftRealAmount) || 0,
        realDate: this.expenseDraftRealDate || undefined,
      })
      .subscribe({
        next: (budget) => {
          this.budget = budget;
          this.currentPeriod = this.findPeriodForActiveMonth(budget);
          this.isSaving = false;
          this.editingExpenseId = null;
          this.expenseDraftPlannedDate = '';
          this.expenseDraftRealDate = '';
          this.isExpenseModalVisible = false;
        },
        error: () => {
          this.isSaving = false;
        },
      });
  }

  public deleteExpenseEntry(): void {
    if (this.isSaving || !this.currentPeriod || !this.editingExpenseId) {
      return;
    }

    this.isSaving = true;

    this.budgetService.deleteExpense(this.currentPeriod.date, this.editingExpenseId).subscribe({
      next: (budget) => {
        this.budget = budget;
        this.currentPeriod = this.findPeriodForActiveMonth(budget);
        this.isSaving = false;
        this.editingExpenseId = null;
        this.expenseDraftPlannedDate = '';
        this.expenseDraftRealDate = '';
        this.isExpenseModalVisible = false;
      },
      error: () => {
        this.isSaving = false;
      },
    });
  }

  public copyPlannedExpenseAmountToReal(): void {
    this.expenseDraftRealAmount = Number(this.expenseDraftPlannedAmount) || 0;
  }

  public copyPlannedExpenseDateToReal(): void {
    this.expenseDraftRealDate = this.expenseDraftPlannedDate || '';
  }

  public copyPlannedIncomeAmountToReal(): void {
    this.incomeDraftRealAmount = Number(this.incomeDraftPlannedAmount) || 0;
  }

  public copyPlannedIncomeDateToReal(): void {
    this.incomeDraftRealDate = this.incomeDraftPlannedDate || '';
  }

  public get expenseModalTitle(): string {
    return this.editingExpenseId ? 'Modifier une dépense' : 'Ajouter une dépense';
  }

  public get expenseFilterAccounts(): Account[] {
    if (!this.currentPeriod || !this.budget) {
      return [];
    }

    const accountIds = new Set(this.currentPeriod.expenses.map((expense) => expense.accountId));

    return this.budget.accounts
      .filter((account) => accountIds.has(account.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr-FR', { sensitivity: 'base' }));
  }

  public get filteredExpenses(): ExpenseItem[] {
    if (!this.currentPeriod) {
      return [];
    }

    if (this.expenseBankFilter === 'all') {
      return this.currentPeriod.expenses;
    }

    return this.currentPeriod.expenses.filter((expense) => expense.accountId === this.expenseBankFilter);
  }

  public get groupedExpensesByBank(): Array<{ accountId: string; accountName: string; expenses: ExpenseItem[] }> {
    if (!this.currentPeriod) {
      return [];
    }

    const groups = new Map<string, ExpenseItem[]>();

    for (const expense of this.currentPeriod.expenses) {
      const existing = groups.get(expense.accountId);

      if (existing) {
        existing.push(expense);
      } else {
        groups.set(expense.accountId, [expense]);
      }
    }

    return Array.from(groups.entries())
      .map(([accountId, expenses]) => ({
        accountId,
        accountName: this.getExpenseAccountName(accountId),
        expenses,
      }))
      .sort((a, b) => a.accountName.localeCompare(b.accountName, 'fr-FR', { sensitivity: 'base' }));
  }

  public get hasFilteredExpenses(): boolean {
    return this.filteredExpenses.length > 0;
  }

  public get expenseSubmitLabel(): string {
    if (this.isSaving) {
      return 'Enregistrement...';
    }

    return this.editingExpenseId ? 'Mettre à jour' : 'Valider';
  }

  public getIncomeAccountName(accountId: string): string {
    return this.findAccountById(accountId)?.name || 'Compte inconnu';
  }

  public getIncomeTypeName(income: IncomeItem): string {
    if (!this.budget) return 'Sans type';
    const t = this.budget.incomeTypes.find((it) => it.id === income.typeId);
    return t?.name || 'Sans type';
  }

  public getIncomeAccountIcon(accountId: string): string | undefined {
    return this.findAccountById(accountId)?.icon;
  }

  public getExpenseAccountName(accountId: string): string {
    return this.findAccountById(accountId)?.name || 'Compte inconnu';
  }

  public getExpenseCategoryIcon(categoryId: string): string | undefined {
    return this.findCategoryById(categoryId)?.icon;
  }

  public getExpenseCategoryName(categoryId: string): string {
    return this.findCategoryById(categoryId)?.name || 'Non catégorisé';
  }

  public getIncomeDisplayedAmount(income: IncomeItem): number {
    return income.realAmount > 0 ? income.realAmount : income.plannedAmount;
  }

  public isImageIcon(icon?: string): boolean {
    if (!icon) {
      return false;
    }

    return icon.includes('/') || icon.startsWith('http');
  }

  private loadBudgetAndPeriod(): void {
    this.isLoading = true;

    this.budgetService.get().subscribe({
      next: (budget) => {
        this.budget = budget;
        this.currentPeriod = this.findPeriodForActiveMonth(budget);
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  private loadCurrentPeriod(): void {
    this.isLoading = true;

    this.budgetService.getPeriod(this.activeMonthKey).subscribe({
      next: (period) => {
        this.currentPeriod = period ?? null;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  private findPeriodForActiveMonth(budget: Budget): Period | null {
    return budget.periods.find((period) => period.date === this.activeMonthKey) ?? null;
  }

  private get previousPeriod(): Period | null {
    if (!this.budget) {
      return null;
    }

    return this.budget.periods.find((period) => period.date === this.previousMonthKey) ?? null;
  }

  private get previousMonthKey(): string {
    const previousMonthDate = new Date(this.activeMonth.getFullYear(), this.activeMonth.getMonth() - 1, 1);
    const year = previousMonthDate.getFullYear();
    const month = String(previousMonthDate.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private createPeriodWithCopiedExpenses(previousExpenses: ExpenseItem[]): void {
    const previousPeriod = this.previousPeriod;
    const copiedExpenses = previousExpenses.map((expense) => ({
      ...expense,
      id: generateUUID(),
    }));

    // Copier aussi les revenus du mois précédent
    const copiedIncomes = (previousPeriod?.incomes ?? []).map((income) => ({
      ...income,
      id: generateUUID(),
    }));

    this.isSaving = true;

    this.budgetService
      .upsertPeriod({
        date: this.activeMonthKey,
        incomes: copiedIncomes,
        expenses: copiedExpenses,
      })
      .subscribe({
        next: (budget) => {
          this.budget = budget;
          this.currentPeriod = this.findPeriodForActiveMonth(budget);
          this.isSaving = false;
        },
        error: () => {
          this.isSaving = false;
        },
      });
  }

  private findAccountById(accountId: string): Account | undefined {
    return this.budget?.accounts.find((account) => account.id === accountId);
  }

  private findCategoryById(categoryId: string): ExpenseCategory | undefined {
    return this.budget?.expenseCategories.find((category) => category.id === categoryId);
  }

  private getExpensePlannedByAccount(accountId: string): number {
    if (!this.currentPeriod) {
      return 0;
    }

    return this.currentPeriod.expenses
      .filter((expense) => expense.accountId === accountId)
      .reduce((sum, expense) => sum + expense.plannedAmount, 0);
  }

  private getExpenseRealByAccount(accountId: string): number {
    if (!this.currentPeriod) {
      return 0;
    }

    return this.currentPeriod.expenses
      .filter((expense) => expense.accountId === accountId)
      .reduce((sum, expense) => sum + expense.realAmount, 0);
  }

  private upsertIncomeInCollection(incomes: IncomeItem[], nextIncome: IncomeItem): IncomeItem[] {
    const index = incomes.findIndex((income) => income.id === nextIncome.id);

    if (index === -1) {
      return [...incomes, nextIncome];
    }

    return incomes.map((income, currentIndex) => (currentIndex === index ? nextIncome : income));
  }

  private computePercentage(value: number, total: number): number {
    if (total <= 0) {
      return 0;
    }

    return (value / total) * 100;
  }

  public getSavingIncomeStackPercent(value: number): number {
    if (this.savingIncomeYearMaxTotal <= 0) {
      return 0;
    }

    return (value / this.savingIncomeYearMaxTotal) * 100;
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }
}
