import { NgClass } from '@angular/common';
import { Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { Subject, filter, takeUntil } from 'rxjs';
import { SaveActionService, TodoProgress } from '../../services/save-action.service';
import { SelectItemTypeModalComponent } from '../select-item-type-modal/select-item-type-modal.component';
import { ItemsService } from '../../services/items.service';
import { AppItem, TodoInformation } from '../../models/app-item.model';
import { isTodoOccurrenceOverdue, normalizeTodoDueDate } from '../../utils/todo-config.utils';
import { BudgetService } from '../../services/budget.service';
import { Budget, Period } from '../../models/budget/budget.model';

Chart.register(...registerables);

@Component({
  selector: 'todo-footer',
  templateUrl: './todo-footer.component.html',
  styleUrls: ['./todo-footer.component.scss'],
  imports: [NgClass, SelectItemTypeModalComponent],
})
export class TodoFooterComponent implements OnDestroy {
  @Input() visible: boolean = true;
  public showSaveIcon: boolean = false;
  public isDashboardRoute: boolean = true;
  public isBudgetRoute: boolean = false;
  public isSelectTypeModalVisible: boolean = false;
  public todoProgress: TodoProgress | null = null;
  public overdueCalendarCount: number = 0;
  public budgetSummary: BudgetFooterSummary | null = null;

  private readonly destroy$ = new Subject<void>();
  private readonly staticRoutes = new Set(['settings', 'recap']);

  private progressCanvas?: HTMLCanvasElement;
  private todoProgressCanvas?: HTMLCanvasElement;
  private budgetProgressCanvas?: HTMLCanvasElement;
  private todoProgressChart?: Chart;
  private budgetProgressChart?: Chart;
  private budget: Budget | null = null;
  private budgetMonthKey = this.getCurrentMonthKey();
  private progressStats = {
    dayDone: 0,
    dayTotal: 0,
    weekDone: 0,
    weekTotal: 0,
    monthDone: 0,
    monthTotal: 0,
  };

  constructor(
    private readonly router: Router,
    private readonly saveActionService: SaveActionService,
    private readonly itemsService: ItemsService,
    private readonly budgetService: BudgetService
  ) {
    this.updateCenterActionFromUrl(this.router.url);
    this.loadProgressStats();
    this.loadBudgetSummary();

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event) => {
        this.updateCenterActionFromUrl(event.urlAfterRedirects);
        this.loadProgressStats();
        this.loadBudgetSummary();
      });

    this.saveActionService.save$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadProgressStats());

    this.saveActionService.todoProgress$.pipe(takeUntil(this.destroy$)).subscribe((progress) => {
      this.todoProgress = progress;
      if (this.todoProgressCanvas && progress) {
        this.renderTodoProgressChart();
      } else if (!progress) {
        this.destroyTodoChart();
      }
    });

    this.budgetService.budget$.pipe(takeUntil(this.destroy$)).subscribe((budget) => {
      this.budget = budget;
      this.refreshBudgetSummary();
    });
  }

  /**
   * Handles the click event on the board menu item. Currently, this method is a placeholder and does not perform any actions.
   */
  public onBoardClick(): void {
    console.log('Board menu item clicked', this.showSaveIcon);
    if (this.showSaveIcon) {
      return;
    }
    this.router.navigate(['/recap']);
  }

  public onPrimaryAction(): void {
    if (this.isDashboardRoute) {
      this.openSelectTypeModal();
      return;
    }

    this.router.navigate(['/']);
  }

  public openSelectTypeModal(): void {
    this.isSelectTypeModalVisible = true;
  }

  public closeSelectTypeModal(): void {
    this.isSelectTypeModalVisible = false;
  }

  public goToCalendar(): void {
    this.router.navigate(['/calendar']);
  }

  public goToSettings(): void {
    this.router.navigate(['/settings']);
  }

  public goToBudget(): void {
    this.router.navigate(['/budget']);
  }

  public onSelectItemType(type: 'todo' | 'note' | 'citation'): void {
    const newItem: AppItem = {
      id: '',
      type: type,
      title: '',
      content: '',
      color: 'default',
      visibility: 'private',
      isArchived: false,
      isFavorite: false,
      isLocked: false,
      isAffirmation: false,
      fromCalendar: false,
      date: undefined,
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(type === 'todo' && { todoContent: [] }),
    };

    this.itemsService.createItem(newItem).subscribe({
      next: (createdItem) => {
        this.closeSelectTypeModal();
        this.router.navigate(['/item', createdItem.id]);
      },
      error: (error) => {
        console.error('Error creating item:', error);
        this.closeSelectTypeModal();
      },
    });
  }

  @ViewChild('todoProgressChart')
  private set todoProgressChartRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    const canvas = ref?.nativeElement;

    if (!canvas) {
      this.destroyTodoChart();
      this.todoProgressCanvas = undefined;
      return;
    }

    this.todoProgressCanvas = canvas;
    this.renderTodoProgressChart();
  }

  @ViewChild('budgetProgressChart')
  private set budgetProgressChartRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    const canvas = ref?.nativeElement;

    if (!canvas) {
      this.destroyBudgetChart();
      this.budgetProgressCanvas = undefined;
      return;
    }

    this.budgetProgressCanvas = canvas;
    this.renderBudgetProgressChart();
  }

  @ViewChild('progressChart')
  private set progressChartRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    const canvas = ref?.nativeElement;

    if (!canvas) {
      this.destroyChart();
      this.progressCanvas = undefined;
      return;
    }

    if (this.progressCanvas === canvas && this.progressChart) {
      return;
    }

    this.progressCanvas = canvas;
    this.renderProgressChart();
  }

  private progressChart?: Chart;

  public ngOnDestroy(): void {
    this.destroyChart();
    this.destroyTodoChart();
    this.destroyBudgetChart();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private renderProgressChart(): void {
    if (!this.progressCanvas) {
      return;
    }

    this.destroyChart();

    const { dayDone, dayTotal, weekDone, weekTotal, monthDone, monthTotal } = this.progressStats;

    const safe = (done: number, total: number) =>
      total === 0 ? [0, 1] : [done, Math.max(0, total - done)];

    const legendItems = [
      { label: 'J', color: dayTotal === 0 ? '#C0C5CC' : '#32c493' },
      { label: 'S', color: weekTotal === 0 ? '#C0C5CC' : '#6378FF' },
      { label: 'M', color: monthTotal === 0 ? '#C0C5CC' : '#FFB85C' },
    ];

    const centerPlugin: any = {
      id: 'centerLegend',
      afterDraw(chart: any) {
        const { ctx, chartArea } = chart;
        if (!chartArea) {
          return;
        }
        const cx = (chartArea.left + chartArea.right) / 2 + 5;
        const cy = (chartArea.top + chartArea.bottom) / 2;
        const rowH = 12;
        const totalH = (legendItems.length - 1) * rowH;
        let y = cy - totalH / 2;

        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 9px sans-serif';

        for (const item of legendItems) {
          ctx.beginPath();
          ctx.arc(cx - 8, y, 3, 0, Math.PI * 2);
          ctx.fillStyle = item.color;
          ctx.fill();
          ctx.fillStyle = '#888';
          ctx.fillText(item.label, cx - 3, y);
          y += rowH;
        }

        ctx.restore();
      },
    };

    const chartConfig: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: ['Done', 'Remaining'],
        datasets: [
          {
            label: 'Jour',
            data: safe(dayDone, dayTotal),
            backgroundColor: dayTotal === 0 ? ['#E5E7EB', '#E5E7EB'] : ['#32c493', '#E5E7EB'],
            borderWidth: 0,
          },
          {
            label: 'Semaine',
            data: safe(weekDone, weekTotal),
            backgroundColor: weekTotal === 0 ? ['#E5E7EB', '#E5E7EB'] : ['#6378FF', '#E5E7EB'],
            borderWidth: 0,
          },
          {
            label: 'Mois',
            data: safe(monthDone, monthTotal),
            backgroundColor: monthTotal === 0 ? ['#E5E7EB', '#E5E7EB'] : ['#FFB85C', '#E5E7EB'],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        cutout: '55%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
        animation: true,
        events: [],
      },
      plugins: [centerPlugin],
    };

    this.progressChart = new Chart(this.progressCanvas, chartConfig);
  }

  private destroyChart(): void {
    this.progressChart?.destroy();
    this.progressChart = undefined;
  }

  private loadProgressStats(): void {
    this.itemsService.getAllActive().subscribe((items) => {
      const stats = {
        dayDone: 0,
        dayTotal: 0,
        weekDone: 0,
        weekTotal: 0,
        monthDone: 0,
        monthTotal: 0,
      };
      const now = new Date();
      let overdueCalendarCount = 0;

      for (const item of items) {
        if (item.type !== 'todo' || !item.todoContent?.length) {
          continue;
        }

        for (const sub of item.todoContent) {
          const rt = sub.config?.recurrenceType ?? 'none';
          const isDone = !!sub.isDone;

          if (rt === 'none' || rt === 'daily') {
            stats.dayTotal++;
            if (isDone) stats.dayDone++;
          } else if (rt === 'weekly') {
            stats.weekTotal++;
            if (isDone) stats.weekDone++;
          } else if (rt === 'monthly') {
            stats.monthTotal++;
            if (isDone) stats.monthDone++;
          }

          if (this.isPastUncheckedTodo(sub, now)) {
            overdueCalendarCount++;
          }
        }
      }

      this.overdueCalendarCount = overdueCalendarCount;
      this.progressStats = stats;
      if (this.progressCanvas) {
        this.renderProgressChart();
      }
    });
  }

  private renderTodoProgressChart(): void {
    if (!this.todoProgressCanvas || !this.todoProgress) {
      return;
    }

    this.destroyTodoChart();

    const {
      dailyDone,
      dailyTotal,
      weeklyDone,
      weeklyTotal,
      monthlyDone,
      monthlyTotal,
    } = this.todoProgress;

    const safe = (done: number, total: number) =>
      total === 0 ? [0, 1] : [done, Math.max(0, total - done)];

    const legendItems = [
      { label: 'J', color: dailyTotal === 0 ? '#C0C5CC' : '#32c493' },
      { label: 'S', color: weeklyTotal === 0 ? '#C0C5CC' : '#6378FF' },
      { label: 'M', color: monthlyTotal === 0 ? '#C0C5CC' : '#FFB85C' },
    ];

    const centerPlugin: any = {
      id: 'centerLegend',
      afterDraw(chart: any) {
        const { ctx, chartArea } = chart;
        if (!chartArea) {
          return;
        }
        const cx = (chartArea.left + chartArea.right) / 2 + 5;
        const cy = (chartArea.top + chartArea.bottom) / 2;
        const rowH = 12;
        const totalH = (legendItems.length - 1) * rowH;
        let y = cy - totalH / 2;

        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 9px sans-serif';

        for (const item of legendItems) {
          ctx.beginPath();
          ctx.arc(cx - 8, y, 3, 0, Math.PI * 2);
          ctx.fillStyle = item.color;
          ctx.fill();
          ctx.fillStyle = '#888';
          ctx.fillText(item.label, cx - 3, y);
          y += rowH;
        }

        ctx.restore();
      },
    };

    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: ['Done', 'Remaining'],
        datasets: [
          {
            label: 'Jour',
            data: safe(dailyDone, dailyTotal),
            backgroundColor: dailyTotal === 0 ? ['#E5E7EB', '#E5E7EB'] : ['#32c493', '#E5E7EB'],
            borderWidth: 0,
          },
          {
            label: 'Semaine',
            data: safe(weeklyDone, weeklyTotal),
            backgroundColor: weeklyTotal === 0 ? ['#E5E7EB', '#E5E7EB'] : ['#6378FF', '#E5E7EB'],
            borderWidth: 0,
          },
          {
            label: 'Mois',
            data: safe(monthlyDone, monthlyTotal),
            backgroundColor:
              monthlyTotal === 0 ? ['#E5E7EB', '#E5E7EB'] : ['#FFB85C', '#E5E7EB'],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        cutout: '55%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        animation: true,
        events: [],
      },
      plugins: [centerPlugin],
    };

    this.todoProgressChart = new Chart(this.todoProgressCanvas, config);
  }

  private destroyTodoChart(): void {
    this.todoProgressChart?.destroy();
    this.todoProgressChart = undefined;
  }

  private loadBudgetSummary(): void {
    if (!this.isBudgetRoute) {
      this.budgetSummary = null;
      this.destroyBudgetChart();
      return;
    }

    this.budgetService.get().subscribe();
  }

  private refreshBudgetSummary(): void {
    if (!this.isBudgetRoute || !this.budget) {
      this.budgetSummary = null;
      this.destroyBudgetChart();
      return;
    }

    const currentPeriod = this.resolveBudgetPeriod(this.budget, this.budgetMonthKey);
    const savingIncomeTypeIds = new Set(
      this.budget.incomeTypes.filter((incomeType) => incomeType.saving).map((incomeType) => incomeType.id)
    );

    const incomePlanned = currentPeriod?.incomes.reduce((sum, income) => sum + income.plannedAmount, 0) ?? 0;
    const incomeReal = currentPeriod?.incomes.reduce((sum, income) => sum + income.realAmount, 0) ?? 0;
    const expensePlanned = currentPeriod?.expenses.reduce((sum, expense) => sum + expense.plannedAmount, 0) ?? 0;
    const expenseReal = currentPeriod?.expenses.reduce((sum, expense) => sum + expense.realAmount, 0) ?? 0;
    const savingsPlanned =
      currentPeriod?.incomes
        .filter((income) => savingIncomeTypeIds.has(income.typeId))
        .reduce((sum, income) => sum + income.plannedAmount, 0) ?? 0;
    const savingsReal =
      currentPeriod?.incomes
        .filter((income) => savingIncomeTypeIds.has(income.typeId))
        .reduce((sum, income) => sum + income.realAmount, 0) ?? 0;

    this.budgetSummary = {
      incomePlanned,
      incomeReal,
      expensePlanned,
      expenseReal,
      savingsPlanned,
      savingsReal,
      incomeDisplay: incomeReal > 0 ? incomeReal : incomePlanned,
      expenseDisplay: expenseReal > 0 ? expenseReal : expensePlanned,
      savingsDisplay: savingsReal > 0 ? savingsReal : savingsPlanned,
    };

    this.renderBudgetProgressChart();
  }

  private renderBudgetProgressChart(): void {
    if (!this.budgetProgressCanvas || !this.budgetSummary) {
      return;
    }

    this.destroyBudgetChart();

    const safe = (done: number, total: number) =>
      total === 0 ? [0, 1] : [done, Math.max(0, total - done)];

    const centerItems = [
      { label: 'Ent', value: this.formatBudgetCenterValue(this.budgetSummary.incomeDisplay), color: '#6378FF' },
      { label: 'Dep', value: this.formatBudgetCenterValue(this.budgetSummary.expenseDisplay), color: '#FFB85C' },
      { label: 'Epa', value: this.formatBudgetCenterValue(this.budgetSummary.savingsDisplay), color: '#32c493' },
    ];

    const centerPlugin: any = {
      id: 'budgetCenterLegend',
      afterDraw(chart: any) {
        const { ctx, chartArea } = chart;
        if (!chartArea) {
          return;
        }

        const cx = (chartArea.left + chartArea.right) / 2 - 15;
        const cy = (chartArea.top + chartArea.bottom) / 2;
        const rowH = 14;
        const totalH = (centerItems.length - 1) * rowH;
        let y = cy - totalH / 2;

        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        for (const item of centerItems) {
          ctx.beginPath();
          ctx.arc(cx, y, 3, 0, Math.PI * 2);
          ctx.fillStyle = item.color;
          ctx.fill();

          ctx.fillStyle = '#666';
          ctx.font = 'bold 8px sans-serif';
          // ctx.fillText(item.label, cx + 7, y);

          ctx.fillStyle = '#2f3441';
          ctx.font = '700 9px sans-serif';
          ctx.fillText(item.value, cx + 7, y);
          // ctx.fillText(item.value, cx + 27, y);
          y += rowH;
        }

        ctx.restore();
      },
    };

    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: ['Done', 'Remaining'],
        datasets: [
          {
            label: 'Entrees',
            data: safe(this.budgetSummary.incomeReal, this.budgetSummary.incomePlanned),
            backgroundColor:
              this.budgetSummary.incomePlanned === 0 ? ['#E5E7EB', '#E5E7EB'] : ['#6378FF', '#E5E7EB'],
            borderWidth: 0,
          },
          {
            label: 'Depenses',
            data: safe(this.budgetSummary.expenseReal, this.budgetSummary.expensePlanned),
            backgroundColor:
              this.budgetSummary.expensePlanned === 0 ? ['#E5E7EB', '#E5E7EB'] : ['#FFB85C', '#E5E7EB'],
            borderWidth: 0,
          },
          {
            label: 'Epargne',
            data: safe(this.budgetSummary.savingsReal, this.budgetSummary.savingsPlanned),
            backgroundColor:
              this.budgetSummary.savingsPlanned === 0 ? ['#E5E7EB', '#E5E7EB'] : ['#32c493', '#E5E7EB'],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        // radius: '100%',
        cutout: '80%',
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        animation: true,
        events: [],
      },
      plugins: [centerPlugin],
    };

    this.budgetProgressChart = new Chart(this.budgetProgressCanvas, config);
  }

  private destroyBudgetChart(): void {
    this.budgetProgressChart?.destroy();
    this.budgetProgressChart = undefined;
  }

  private isPastUncheckedTodo(subItem: TodoInformation, now: Date): boolean {
    const occurrenceDate = this.resolveOccurrenceDateForToday(subItem, now);

    if (!occurrenceDate) {
      return false;
    }

    const reminderAt = this.resolveReminderDate(occurrenceDate, subItem.config?.alertAt);

    return isTodoOccurrenceOverdue({
      isDone: subItem.isDone,
      occurrenceDate,
      reminderAt,
      canBeChecked: true,
      now,
    });
  }

  private resolveOccurrenceDateForToday(subItem: TodoInformation, now: Date): Date | null {
    const dueDate = normalizeTodoDueDate(subItem.config?.dueDate);

    if (dueDate) {
      const parsedDate = new Date(`${dueDate}T00:00:00`);
      return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
    }

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const recurrenceType = subItem.config?.recurrenceType ?? 'none';

    if (recurrenceType === 'daily' || recurrenceType === 'none' || recurrenceType === 'custom') {
      return today;
    }

    if (recurrenceType === 'weekly') {
      const weekdays = this.parseWeeklyRule(subItem.config?.recurrenceRule);
      return !weekdays.length || weekdays.includes(today.getDay()) ? today : null;
    }

    if (recurrenceType === 'monthly') {
      const scheduledDay = this.parseMonthlyRule(subItem.config?.recurrenceRule);
      return scheduledDay == null || scheduledDay === today.getDate() ? today : null;
    }

    return today;
  }

  private resolveReminderDate(baseDate: Date, alertAt?: string): Date | null {
    if (!alertAt) {
      return null;
    }

    const [hourText, minuteText] = alertAt.split(':');
    const hours = Number.parseInt(hourText, 10);
    const minutes = Number.parseInt(minuteText, 10);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return null;
    }

    return new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      hours,
      minutes,
      0,
      0
    );
  }

  private parseWeeklyRule(rule?: string): number[] {
    const rawValue = rule?.split(':')[1]?.trim().toLowerCase();

    if (!rawValue) {
      return [];
    }

    const dayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
      dimanche: 0,
      lundi: 1,
      mardi: 2,
      mercredi: 3,
      jeudi: 4,
      vendredi: 5,
      samedi: 6,
    };

    return rawValue
      .split(',')
      .map((day) => day.trim())
      .map((day) => dayMap[day])
      .filter((day): day is number => day !== undefined);
  }

  private parseMonthlyRule(rule?: string): number | undefined {
    const rawValue = rule?.split(':')[1]?.trim();

    if (!rawValue) {
      return undefined;
    }

    const day = Number.parseInt(rawValue, 10);
    return Number.isFinite(day) && day >= 1 && day <= 31 ? day : undefined;
  }

  private updateCenterActionFromUrl(url: string): void {
    const [pathPart, queryPart] = url.split('?');
    const normalizedPath = pathPart.replace(/^\//, '');
    this.isDashboardRoute = !normalizedPath || normalizedPath === 'dashboard';
    this.isBudgetRoute = normalizedPath.startsWith('budget');
    this.budgetMonthKey = this.resolveBudgetMonthKey(queryPart);

    if (!normalizedPath) {
      this.showSaveIcon = false;
      return;
    }

    const segments = normalizedPath.split('/').filter(Boolean);
    this.showSaveIcon = segments.length > 1 && segments[0] === 'item' && segments[1] != null;
  }

  private resolveBudgetMonthKey(queryPart?: string): string {
    const currentMonthKey = this.getCurrentMonthKey();

    if (!queryPart) {
      return currentMonthKey;
    }

    const params = new URLSearchParams(queryPart);
    const month = params.get('month');

    return month && /^\d{4}-\d{2}$/.test(month) ? month : currentMonthKey;
  }

  private resolveBudgetPeriod(budget: Budget, monthKey: string): Period | undefined {
    return budget.periods.find((period) => period.date === monthKey);
  }

  private getCurrentMonthKey(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${month}`;
  }

  private formatBudgetCenterValue(value: number): string {
    return `${Math.round(value)} €`;
  }
}

interface BudgetFooterSummary {
  incomePlanned: number;
  incomeReal: number;
  expensePlanned: number;
  expenseReal: number;
  savingsPlanned: number;
  savingsReal: number;
  incomeDisplay: number;
  expenseDisplay: number;
  savingsDisplay: number;
}
