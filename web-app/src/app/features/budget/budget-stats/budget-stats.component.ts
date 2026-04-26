import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { DecimalPipe, CommonModule } from '@angular/common';
import { Budget, ExpenseItem, IncomeItem, Period, resolveExpenseIncomeId } from '../../../shared/models/budget/budget.model';
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
  monthKey: string;
  monthLabel: string;
  incomePlanned: number;
  incomeReal: number;
  expensePlanned: number;
  expenseReal: number;
  savingPlanned: number;
  savingReal: number;
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

  public savingsHistogramMode: 'planned' | 'real' = 'planned';
  public monthlyLineMode: 'planned' | 'real' = 'planned';

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
    this.refreshSavingsColumnChart();
  }

  public goToNextYear(): void {
    this.selectedYear += 1;
    this.refreshMonthlyLineChart();
    this.refreshSavingsColumnChart();
  }

  public setSavingsHistogramMode(evt: any): void {
    const mode: 'planned' | 'real' = (evt.target as HTMLSelectElement).value as 'planned' | 'real';
    if (this.savingsHistogramMode === mode) {
      return;
    }

    this.savingsHistogramMode = mode;
    this.refreshSavingsColumnChart();
  }

  public setMonthlyLineMode(evt: any): void {
    const mode: 'planned' | 'real' = (evt.target as HTMLSelectElement).value as 'planned' | 'real';
    if (this.monthlyLineMode === mode) {
      return;
    }

    this.monthlyLineMode = mode;
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

      if (!period || !this.budget) {
        return {
          monthKey: key,
          monthLabel: new Date(this.selectedYear, index, 1).toLocaleDateString('fr-FR', { month: 'long' }),
          incomePlanned: 0,
          incomeReal: 0,
          expensePlanned: 0,
          expenseReal: 0,
          savingPlanned: 0,
          savingReal: 0,
        };
      }

      let incomePlanned = 0;
      let incomeReal = 0;
      let savingPlanned = 0;
      let savingReal = 0;

      for (const income of period.incomes) {
        incomePlanned += income.plannedAmount;
        incomeReal += income.realAmount;

        const incomeType = this.budget.incomeTypes.find((t) => t.id === income.typeId);
        if (incomeType?.saving) {
          savingPlanned += income.plannedAmount;
          savingReal += income.realAmount;
        }
      }

      const expensePlanned = period.expenses.reduce((sum, expense) => sum + expense.plannedAmount, 0);
      const expenseReal = period.expenses.reduce((sum, expense) => sum + expense.realAmount, 0);

      return {
        monthKey: key,
        monthLabel: new Date(this.selectedYear, index, 1).toLocaleDateString('fr-FR', { month: 'long' }),
        incomePlanned,
        incomeReal,
        expensePlanned,
        expenseReal,
        savingPlanned,
        savingReal,
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
        const aggregateId = this.getExpenseAggregateId(period, expense);
        const current = byAccount.get(aggregateId) ?? {
          id: aggregateId,
          name: this.getExpenseAggregateName(period, expense),
          planned: 0,
          real: 0,
        };

        current.planned += expense.plannedAmount;
        current.real += expense.realAmount;
        byAccount.set(aggregateId, current);
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
        this.refreshMonthlyLineChart();
        this.refreshSavingsColumnChart();
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  private refreshMonthlyLineChart(): void {
    if (!this.monthlyLineChartCanvas) {
      return;
    }

    this.monthlyLineChart?.destroy();
    this.monthlyLineChart = null;

    const labels = this.monthlyExpenseStats.map((month) => month.monthLabel);
    const plannedIncomeData = this.monthlyExpenseStats.map((month) => month.incomePlanned);
    const realIncomeData = this.monthlyExpenseStats.map((month) => month.incomeReal);
    const plannedExpenseData = this.monthlyExpenseStats.map((month) => month.expensePlanned);
    const realExpenseData = this.monthlyExpenseStats.map((month) => month.expenseReal);

    // AJOUT pour l’épargne
    const plannedSavingData = this.monthlyExpenseStats.map((month) => month.savingPlanned);
    const realSavingData = this.monthlyExpenseStats.map((month) => month.savingReal);

    const plannedSavingPlusExpenseData = this.monthlyExpenseStats.map(
      (month) => month.savingPlanned + month.expensePlanned
    );
    const realSavingPlusExpenseData = this.monthlyExpenseStats.map(
      (month) => month.savingReal + month.expenseReal
    );

    const datasets =
      this.monthlyLineMode === 'planned'
        ? [
            {
              label: 'Dépenses planifiées',
              data: plannedExpenseData,
              borderColor: '#ef8f6b',
              backgroundColor: 'rgba(239, 143, 107, 0.18)',
              pointBackgroundColor: '#ef8f6b',
              pointRadius: 3,
              pointHoverRadius: 5,
              borderWidth: 2,
              tension: 0.3,
            },
            {
              label: 'Revenus planifiés',
              data: plannedIncomeData,
              borderColor: '#5a8dee',
              backgroundColor: 'rgba(90, 141, 238, 0.18)',
              pointBackgroundColor: '#5a8dee',
              pointRadius: 3,
              pointHoverRadius: 5,
              borderWidth: 2,
              tension: 0.3,
            },
            {
              label: 'Épargne',
              data: plannedSavingData,
              borderColor: '#6ab076',
              backgroundColor: 'rgba(106, 176, 118, 0.18)',
              pointBackgroundColor: '#6ab076',
              pointRadius: 3,
              pointHoverRadius: 5,
              borderWidth: 2,
              tension: 0.3,
            },
            {
              label: 'Épargne + dépenses planifiées',
              data: plannedSavingPlusExpenseData,
              borderColor: '#2f6fe4',
              backgroundColor: 'rgba(47, 111, 228, 0.12)',
              pointBackgroundColor: '#2f6fe4',
              pointRadius: 3,
              pointHoverRadius: 5,
              borderWidth: 2,
              tension: 0.3,
            },
          ]
        : [
            {
              label: 'Dépenses réelles',
              data: realExpenseData,
              borderColor: '#d6577f',
              backgroundColor: 'rgba(214, 87, 127, 0.12)',
              pointBackgroundColor: '#d6577f',
              pointRadius: 3,
              pointHoverRadius: 5,
              borderWidth: 2,
              tension: 0.3,
            },
            {
              label: 'Revenus réels',
              data: realIncomeData,
              borderColor: '#2f6fe4',
              backgroundColor: 'rgba(47, 111, 228, 0.12)',
              pointBackgroundColor: '#2f6fe4',
              pointRadius: 3,
              pointHoverRadius: 5,
              borderWidth: 2,
              tension: 0.3,
            },
            {
              label: 'Épargne',
              data: realSavingData,
              borderColor: '#6ab076',
              backgroundColor: 'rgba(106, 176, 118, 0.18)',
              pointBackgroundColor: '#6ab076',
              pointRadius: 3,
              pointHoverRadius: 5,
              borderWidth: 2,
              tension: 0.3,
            },
            {
              label: 'Épargne + dépenses réels',
              data: realSavingPlusExpenseData,
              borderColor: '#5a8dee',
              backgroundColor: 'rgba(90, 141, 238, 0.18)',
              pointBackgroundColor: '#5a8dee',
              pointRadius: 3,
              pointHoverRadius: 5,
              borderWidth: 2,
              tension: 0.3,
            },
          ];

    this.monthlyLineChart = new Chart(this.monthlyLineChartCanvas, {
      type: 'line',
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              boxWidth: 10,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => `${value} EUR`,
            },
          },
        },
      },
    });
  }

  private refreshSavingsColumnChart(): void {
    if (!this.savingsColumnChartCanvas) {
      return;
    }

    this.savingsColumnChart?.destroy();
    this.savingsColumnChart = null;

    const labels = this.savingIncomeYearProgress.map((entry) => entry.name);

    const plannedData = this.savingIncomeYearProgress.map((entry) => entry.planned);
    const realData = this.savingIncomeYearProgress.map((entry) => entry.real);

    const data =
      this.savingsHistogramMode === 'planned'
        ? plannedData
        : realData;

    const label =
      this.savingsHistogramMode === 'planned'
        ? 'Épargne planifiée'
        : 'Épargne réelle';

    const backgroundColor =
      this.savingsHistogramMode === 'planned'
        ? 'rgba(106, 176, 118, 0.7)'
        : 'rgba(54, 162, 235, 0.7)';

    const borderColor =
      this.savingsHistogramMode === 'planned'
        ? '#6ab076'
        : '#36a2eb';

    this.savingsColumnChart = new Chart(this.savingsColumnChartCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label,
            data,
            backgroundColor,
            borderColor,
            borderWidth: 1,
            borderRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              boxWidth: 10,
            },
          },
        },
        scales: {
          x: {
            ticks: {
              maxRotation: 0,
              minRotation: 0,
            },
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => `${value} EUR`,
            },
          },
        },
      },
    });
  }

  private getExpenseAggregateId(period: Period, expense: ExpenseItem): string {
    const linkedIncomeId = resolveExpenseIncomeId(expense, period.incomes);

    if (linkedIncomeId) {
      return `income:${linkedIncomeId}`;
    }

    return `account:${expense.accountId}`;
  }

  private getExpenseAggregateName(period: Period, expense: ExpenseItem): string {
    const linkedIncome = this.getExpenseLinkedIncome(period, expense);
    const accountName =
      this.budget?.accounts.find((account) => account.id === expense.accountId)?.name ?? 'Compte inconnu';

    if (!linkedIncome) {
      return accountName;
    }

    return `${linkedIncome.name} (${accountName})`;
  }

  private getExpenseLinkedIncome(period: Period, expense: ExpenseItem): IncomeItem | undefined {
    const linkedIncomeId = resolveExpenseIncomeId(expense, period.incomes);

    if (!linkedIncomeId) {
      return undefined;
    }

    return period.incomes.find((income) => income.id === linkedIncomeId);
  }
}
