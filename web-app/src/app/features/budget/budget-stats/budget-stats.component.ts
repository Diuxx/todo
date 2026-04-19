import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { DecimalPipe, CommonModule } from '@angular/common';
import { Budget, Period } from '../../../shared/models/budget/budget.model';
import { BudgetService } from '../../../shared/services/budget.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface AggregateStat {
  id: string;
  name: string;
  planned: number;
  real: number;
}

interface MonthlyExpenseStat {
  monthLabel: string;
  incomePlanned: number;
  incomeReal: number;
  expensePlanned: number;
  expenseReal: number;
}

@Component({
  standalone: true,
  selector: 'todo-budget-stats',
  templateUrl: './budget-stats.component.html',
  styleUrls: ['./budget-stats.component.scss'],
  imports: [DecimalPipe, CommonModule],
})
export class BudgetStatsComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly budgetService = inject(BudgetService);
  private monthlyLineChart: Chart<'line'> | null = null;
  private savingsColumnChart: Chart | null = null;
  private monthlyLineChartCanvas?: HTMLCanvasElement;

  @ViewChild('monthlyLineCanvas')
  private set monthlyLineCanvasRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    const canvas = ref?.nativeElement;

    if (!canvas) {
      this.monthlyLineChartCanvas = undefined;
      this.monthlyLineChart?.destroy();
      this.monthlyLineChart = null;
      return;
    }

    this.monthlyLineChartCanvas = canvas;
    this.refreshMonthlyLineChart();
  }

  @ViewChild('savingsColumnCanvas')
  private set savingsColumnCanvasRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    const canvas = ref?.nativeElement;

    if (!canvas) {
      this.savingsColumnChartCanvas = undefined;
      this.savingsColumnChart?.destroy();
      this.savingsColumnChart = null;
      return;
    }

    this.savingsColumnChartCanvas = canvas;
    this.refreshSavingsColumnChart();
  }

  private savingsColumnChartCanvas?: HTMLCanvasElement;

  public budget: Budget | null = null;
  public selectedYear = new Date().getFullYear();
  public isLoading = true;

  public ngOnInit(): void {
    this.loadBudget();
  }

  public ngAfterViewInit(): void {
    this.refreshMonthlyLineChart();
    this.refreshSavingsColumnChart();
  }

  public ngOnDestroy(): void {
    this.monthlyLineChart?.destroy();
    this.monthlyLineChart = null;
    this.savingsColumnChart?.destroy();
    this.savingsColumnChart = null;
  }

  public goToPreviousYear(): void {
    this.selectedYear -= 1;
    this.refreshMonthlyLineChart();
  }

  public goToNextYear(): void {
    this.selectedYear += 1;
    this.refreshMonthlyLineChart();
  }

  public get totalExpensePlannedYear(): number {
    return this.yearPeriods.reduce(
      (sum, period) => sum + period.expenses.reduce((innerSum, expense) => innerSum + expense.plannedAmount, 0),
      0
    );
  }

  public get totalExpenseRealYear(): number {
    return this.yearPeriods.reduce(
      (sum, period) => sum + period.expenses.reduce((innerSum, expense) => innerSum + expense.realAmount, 0),
      0
    );
  }
  public get monthlyExpenseStats(): MonthlyExpenseStat[] {
    return Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, '0');
      const key = `${this.selectedYear}-${month}`;
      const period = this.yearPeriods.find((entry) => entry.date === key);
      const incomePlanned = period?.incomes.reduce((sum, income) => sum + income.plannedAmount, 0) ?? 0;
      const incomeReal = period?.incomes.reduce((sum, income) => sum + income.realAmount, 0) ?? 0;
      const expensePlanned = period?.expenses.reduce((sum, expense) => sum + expense.plannedAmount, 0) ?? 0;
      const expenseReal = period?.expenses.reduce((sum, expense) => sum + expense.realAmount, 0) ?? 0;

      return {
        monthKey: key,
        monthLabel: new Date(this.selectedYear, index, 1).toLocaleDateString('fr-FR', { month: 'long' }),
        incomePlanned,
        incomeReal,
        expensePlanned,
        expenseReal,
      };
    });
  }

  public get annualRealVsPlannedPercent(): number {
    if (this.totalExpensePlannedYear <= 0) {
      return 0;
    }

    return Math.max(0, Math.min((this.totalExpenseRealYear / this.totalExpensePlannedYear) * 100, 100));
  }

  public get maxMonthlyExpenseValue(): number {
    return this.monthlyExpenseStats.reduce(
      (max, month) =>
        Math.max(max, month.incomePlanned, month.incomeReal, month.expensePlanned, month.expenseReal),
      0
    );
  }

  public get maxCategoryRealValue(): number {
    return this.categoryExpenseStats.reduce((max, item) => Math.max(max, item.real), 0);
  }

  public get maxAccountRealValue(): number {
    return this.accountExpenseStats.reduce((max, item) => Math.max(max, item.real), 0);
  }

  public getMonthlyBarPercent(value: number): number {
    if (this.maxMonthlyExpenseValue <= 0) {
      return 0;
    }

    return (value / this.maxMonthlyExpenseValue) * 100;
  }

  public getCategoryBarPercent(value: number): number {
    if (this.maxCategoryRealValue <= 0) {
      return 0;
    }

    return (value / this.maxCategoryRealValue) * 100;
  }

  public getAccountBarPercent(value: number): number {
    if (this.maxAccountRealValue <= 0) {
      return 0;
    }

    return (value / this.maxAccountRealValue) * 100;
  }

  public getAnnualRingBackground(): string {
    const percent = this.annualRealVsPlannedPercent;
    return `conic-gradient(#dd7ea8 0 ${percent}%, #dbe4f3 ${percent}% 100%)`;
  }

  public get categoryExpenseStats(): AggregateStat[] {
    if (!this.budget) {
      return [];
    }

    const byCategory = new Map<string, AggregateStat>();

    for (const period of this.yearPeriods) {
      for (const expense of period.expenses) {
        const current = byCategory.get(expense.categoryId) ?? {
          id: expense.categoryId,
          name: this.budget.expenseCategories.find((category) => category.id === expense.categoryId)?.name ??
            'Non catégorisé',
          planned: 0,
          real: 0,
        };

        current.planned += expense.plannedAmount;
        current.real += expense.realAmount;
        byCategory.set(expense.categoryId, current);
      }
    }

    return Array.from(byCategory.values()).sort((a, b) => b.real - a.real);
  }

  public get accountExpenseStats(): AggregateStat[] {
    if (!this.budget) {
      return [];
    }

    const byAccount = new Map<string, AggregateStat>();

    for (const period of this.yearPeriods) {
      for (const expense of period.expenses) {
        const current = byAccount.get(expense.accountId) ?? {
          id: expense.accountId,
          name: this.budget.accounts.find((account) => account.id === expense.accountId)?.name ?? 'Compte inconnu',
          planned: 0,
          real: 0,
        };

        current.planned += expense.plannedAmount;
        current.real += expense.realAmount;
        byAccount.set(expense.accountId, current);
      }
    }

    return Array.from(byAccount.values()).sort((a, b) => b.real - a.real);
  }

  public get savingIncomeYearProgress(): AggregateStat[] {
    if (!this.budget) return [];

    const yearPrefix = `${this.selectedYear}-`;
    const totals = new Map<string, AggregateStat>();

    for (const period of this.budget.periods.filter((p) => p.date.startsWith(yearPrefix))) {
      for (const income of period.incomes) {
        // income.type may be undefined; prefer typeId
        const typeId = (income as any).typeId ?? income.type?.id;
        if (!typeId) continue;
        const incomeType = this.budget.incomeTypes.find((t) => t.id === typeId);
        if (!incomeType || !incomeType.saving) continue;

        const current = totals.get(typeId) ?? { id: typeId, name: incomeType.name, planned: 0, real: 0 };
        current.planned += income.plannedAmount;
        current.real += income.realAmount;
        totals.set(typeId, current);
      }
    }

    return Array.from(totals.values()).filter((e) => e.planned > 0 || e.real > 0).sort((a, b) => b.real + b.planned - (a.real + a.planned));
  }

  public get hasSavingIncomeYearProgress(): boolean {
    return this.savingIncomeYearProgress.length > 0;
  }

  public get savingIncomeYearMaxTotal(): number {
    return this.savingIncomeYearProgress.reduce((max, entry) => Math.max(max, entry.planned + entry.real), 0);
  }

  public get savingPlannedTotal(): number {
    return this.savingIncomeYearProgress.reduce((sum, s) => sum + s.planned, 0);
  }

  public get savingRealTotal(): number {
    return this.savingIncomeYearProgress.reduce((sum, s) => sum + s.real, 0);
  }

  public get hasAnyExpenseForYear(): boolean {
    return this.monthlyExpenseStats.some(
      (month) =>
        month.incomePlanned > 0 ||
        month.incomeReal > 0 ||
        month.expensePlanned > 0 ||
        month.expenseReal > 0
    );
  }

  public get yearPeriods(): Period[] {
    if (!this.budget) {
      return [];
    }

    const yearPrefix = `${this.selectedYear}-`;
    return this.budget.periods.filter((period) => period.date.startsWith(yearPrefix));
  }

  private loadBudget(): void {
    this.isLoading = true;
    this.budgetService.get().subscribe({
      next: (budget) => {
        this.budget = budget;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  private refreshMonthlyLineChart(): void {
    // ...existing code for chart rendering...
  }

  private refreshSavingsColumnChart(): void {
    // ...existing code for chart rendering...
  }
}
