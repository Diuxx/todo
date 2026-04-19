import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
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
  monthKey: string;
  monthLabel: string;
  incomePlanned: number;
  incomeReal: number;
  expensePlanned: number;
  expenseReal: number;
}

@Component({
  standalone: true,
  selector: 'todo-budget-stats',
  templateUrl: './budgetstats.component.html',
  styleUrls: ['./budgetstats.component.scss'],
  imports: [DecimalPipe],
})
export class BudgetStatsComponent implements OnInit {
  private readonly budgetService = inject(BudgetService);
  private monthlyLineChart: Chart<'line'> | null = null;
  private categoryStackedChart: Chart<'bar'> | null = null;
  private monthlyLineChartCanvas?: HTMLCanvasElement;
  private categoryStackedChartCanvas?: HTMLCanvasElement;

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

  @ViewChild('categoryStackedCanvas')
  private set categoryStackedCanvasRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    const canvas = ref?.nativeElement;

    if (!canvas) {
      this.categoryStackedChartCanvas = undefined;
      this.categoryStackedChart?.destroy();
      this.categoryStackedChart = null;
      return;
    }

    this.categoryStackedChartCanvas = canvas;
    this.refreshCategoryStackedChart();
  }

  public budget: Budget | null = null;
  public selectedYear = new Date().getFullYear();
  public isLoading = true;

  public ngOnInit(): void {
    this.loadBudget();
  }

  public ngAfterViewInit(): void {
    this.refreshMonthlyLineChart();
    this.refreshCategoryStackedChart();
  }

  public ngOnDestroy(): void {
    this.monthlyLineChart?.destroy();
    this.monthlyLineChart = null;
    this.categoryStackedChart?.destroy();
    this.categoryStackedChart = null;
  }

  public goToPreviousYear(): void {
    this.selectedYear -= 1;
    this.refreshMonthlyLineChart();
    this.refreshCategoryStackedChart();
  }

  public goToNextYear(): void {
    this.selectedYear += 1;
    this.refreshMonthlyLineChart();
    this.refreshCategoryStackedChart();
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
        this.refreshCategoryStackedChart();
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
            borderWidth: 2,
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
            borderWidth: 2,
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
              label: (context) =>
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
              callback: (value) => `${value}€`,
            },
          },
        },
      },
    });
  }

  private refreshCategoryStackedChart(): void {
    const canvas = this.categoryStackedChartCanvas;

    if (!canvas || !this.budget) {
      return;
    }

    const labels = this.categoryExpenseStats.map((item) => item.name);
    const plannedData = this.categoryExpenseStats.map((item) => item.planned);
    const realData = this.categoryExpenseStats.map((item) => item.real);

    this.categoryStackedChart?.destroy();
    this.categoryStackedChart = null;

    this.categoryStackedChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Planifié',
            data: plannedData,
            backgroundColor: '#93c5fd',
            borderColor: '#60a5fa',
            borderWidth: 1,
            stack: 'amounts',
          },
          {
            label: 'Réel',
            data: realData,
            backgroundColor: '#fda4af',
            borderColor: '#fb7185',
            borderWidth: 1,
            stack: 'amounts',
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
              pointStyle: 'rectRounded',
            },
          },
          tooltip: {
            callbacks: {
              label: (context) =>
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
            stacked: true,
            title: {
              display: true,
              text: 'Catégories',
            },
            ticks: {
              maxRotation: 40,
              minRotation: 0,
            },
            grid: {
              display: false,
            },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            title: {
              display: true,
              text: 'Montants (€)',
            },
            ticks: {
              callback: (value) => `${value}€`,
            },
          },
        },
      },
    });
  }
}
