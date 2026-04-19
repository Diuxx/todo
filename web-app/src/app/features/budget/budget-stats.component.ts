import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { DecimalPipe, CommonModule } from '@angular/common';
import { Budget, Period } from '../../shared/models/budget/budget.model';
import { BudgetService } from '../../shared/services/budget.service';
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
        this.refreshMonthlyLineChart();
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  private refreshMonthlyLineChart(): void {
    const canvas = this.monthlyLineChartCanvas;

    if (!canvas || !this.budget) {
      return;
    }

    const labels = this.monthlyExpenseStats.map((month) => month.monthLabel);
    const incomePlannedData = this.monthlyExpenseStats.map((month) => month.incomePlanned);
    const incomeRealData = this.monthlyExpenseStats.map((month) => month.incomeReal);
    const expensePlannedData = this.monthlyExpenseStats.map((month) => month.expensePlanned);
    const expenseRealData = this.monthlyExpenseStats.map((month) => month.expenseReal);

    this.monthlyLineChart?.destroy();
    this.monthlyLineChart = null;

    this.monthlyLineChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Revenus planifiés',
            data: incomePlannedData,
            borderColor: '#1d4ed8',
            backgroundColor: 'rgba(29, 78, 216, 0.12)',
            pointBackgroundColor: '#1d4ed8',
            pointRadius: 4,
            pointHoverRadius: 5,
            fill: false,
            tension: 0.35,
            borderWidth: 2,
          },
          {
            label: 'Revenus réels',
            data: incomeRealData,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.12)',
            pointBackgroundColor: '#3b82f6',
            pointRadius: 4,
            pointHoverRadius: 5,
            fill: false,
            tension: 0.35,
            borderWidth: 3,
            borderDash: [6, 4],
            pointStyle: 'triangle',
          },
          {
            label: 'Dépenses planifiées',
            data: expensePlannedData,
            borderColor: '#c2410c',
            backgroundColor: 'rgba(194, 65, 12, 0.12)',
            pointBackgroundColor: '#c2410c',
            pointRadius: 4,
            pointHoverRadius: 5,
            fill: false,
            tension: 0.35,
            borderWidth: 2,
          },
          {
            label: 'Dépenses réelles',
            data: expenseRealData,
            borderColor: '#f97316',
            backgroundColor: 'rgba(249, 115, 22, 0.12)',
            pointBackgroundColor: '#f97316',
            pointRadius: 4,
            pointHoverRadius: 5,
            fill: false,
            tension: 0.35,
            borderWidth: 3,
            borderDash: [6, 4],
            pointStyle: 'triangle',
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
              boxWidth: 12,
              usePointStyle: true,
              pointStyle: 'circle',
            },
          },
          tooltip: {
            callbacks: {
              label: (context: any) =>
                `${context.dataset.label}: ${new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                  minimumFractionDigits: 2,
                }).format(context.parsed.y ?? 0)}`,
            },
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Mois',
            },
            ticks: {
              maxRotation: 0,
              autoSkip: true,
            },
            grid: {
              display: false,
            },
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Montants (€)',
            },
            ticks: {
              callback: (value: any) => `${value}€`,
            },
          },
        },
      },
    });
  }

  private refreshSavingsColumnChart(): void {
    const canvas = this.savingsColumnChartCanvas;

    if (!canvas || !this.budget) return;

    const labels = this.savingIncomeYearProgress.map((s) => s.name);
    const plannedData = this.savingIncomeYearProgress.map((s) => s.planned);
    const realData = this.savingIncomeYearProgress.map((s) => s.real);

    this.savingsColumnChart?.destroy();
    this.savingsColumnChart = null;

    this.savingsColumnChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Planifié',
            data: plannedData,
            backgroundColor: '#60a5fa',
            borderColor: '#3b82f6',
            borderWidth: 1,
          },
          {
            label: 'Réel',
            data: realData,
            backgroundColor: '#fb7185',
            borderColor: '#f43f5e',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (context: any) =>
                `${context.dataset.label}: ${new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                  minimumFractionDigits: 2,
                }).format(context.parsed.y ?? 0)}`,
            },
          },
          // custom plugin will draw exact values on top of each bar (added via `plugins` array)
        },
        scales: {
          x: {
            title: { display: true, text: 'Type de revenu' },
            ticks: { autoSkip: false },
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Montant (€)' },
            ticks: { callback: (v: any) => `${v}€` },
          },
        },
      },
      plugins: [
        {
          id: 'drawValues',
          afterDatasetsDraw: (chart) => {
            const ctx = chart.ctx;
            const fontSize = 11;
            ctx.save();
            ctx.font = `${fontSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';

            chart.data.datasets.forEach((dataset, dsIndex) => {
              const meta = chart.getDatasetMeta(dsIndex);
              meta.data.forEach((bar, index) => {
                const value = (dataset.data as number[])[index] ?? 0;
                const x = bar.x;
                const y = bar.y - 6;
                ctx.fillStyle = '#111';
                ctx.fillText(new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + '€', x, y);
              });
            });

            ctx.restore();
          },
        },
      ],
    });
  }
}
