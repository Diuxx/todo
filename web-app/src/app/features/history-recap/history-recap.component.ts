import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { combineLatest, Subject, takeUntil } from 'rxjs';
import { AppItem } from '../../shared/models/app-item.model';
import { TodoHistoryEntry } from '../../shared/models/todo-history.model';
import { ItemsService } from '../../shared/services/items.service';
import { TodoHistoryService } from '../../shared/services/todo-history.service';

Chart.register(...registerables);

interface WeeklyStats {
  label: string;
  rangeLabel: string;
  startISO: string;
  endISO: string;
  doneCount: number;
  uniqueTodos: number;
  dayStats: WeekDayStats[];
  topTodos: TopTodo[];
}

interface WeekDayStats {
  label: string;
  shortLabel: string;
  doneCount: number;
}

interface MonthOption {
  key: string;
  label: string;
  startISO: string;
  endISO: string;
}

interface RecapSummary {
  totalDone: number;
  averageDonePerWeek: number;
  bestWeekLabel: string;
  bestWeekDone: number;
  activeWeeksCount: number;
}

interface TopTodo {
  todoItemId: string;
  title: string;
  count: number;
}

@Component({
  standalone: true,
  selector: 'history-recap',
  templateUrl: './history-recap.component.html',
  styleUrls: ['./history-recap.component.scss'],
  imports: [CommonModule],
})
export class HistoryRecapComponent implements AfterViewInit, OnDestroy {
  private readonly todoHistoryService = inject(TodoHistoryService);
  private readonly itemsService = inject(ItemsService);
  private readonly destroy$ = new Subject<void>();

  private chart?: Chart;
  private weeklyHistoryChartCanvas?: HTMLCanvasElement;
  private currentWeekChart?: Chart;
  private currentWeekChartCanvas?: HTMLCanvasElement;
  private allDoneHistory: TodoHistoryEntry[] = [];
  private titleBySubItemId: Map<string, string> = new Map();

  public isLoading: boolean = true;
  public availableMonths: MonthOption[] = [];
  public selectedMonthKey: string = '';
  public weeklyStats: WeeklyStats[] = [];
  public chartWeeklyStats: WeeklyStats[] = [];
  public summary: RecapSummary = {
    totalDone: 0,
    averageDonePerWeek: 0,
    bestWeekLabel: '-',
    bestWeekDone: 0,
    activeWeeksCount: 0,
  };
  public currentWeek: WeeklyStats | null = null;
  public topTodos: TopTodo[] = [];
  public selectedWeek: WeeklyStats | null = null;

  @ViewChild('weeklyHistoryChart')
  private set weeklyHistoryChartRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    const canvas = ref?.nativeElement;

    if (!canvas) {
      this.weeklyHistoryChartCanvas = undefined;
      this.destroyChart();
      return;
    }

    this.weeklyHistoryChartCanvas = canvas;

    if (this.chartWeeklyStats.length) {
      this.renderChart(this.chartWeeklyStats);
    }
  }

  @ViewChild('currentWeekChart')
  private set currentWeekChartRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    const canvas = ref?.nativeElement;

    if (!canvas) {
      this.currentWeekChartCanvas = undefined;
      this.destroyCurrentWeekChart();
      return;
    }

    this.currentWeekChartCanvas = canvas;
    this.renderCurrentWeekChart();
  }

  public ngAfterViewInit(): void {
    this.loadRecap();
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.destroyChart();
    this.destroyCurrentWeekChart();
  }

  private loadRecap(): void {
    this.isLoading = true;

    combineLatest([this.todoHistoryService.getAll(), this.itemsService.getAllActive('todo')])
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ([history, todoItems]) => {
          this.allDoneHistory = history.filter(
            (entry) => entry.status === 'done' && !!entry.completedAt
          );
          this.titleBySubItemId = this.buildTitleBySubItemId(todoItems);

          this.currentWeek = this.buildCurrentWeekStats(
            this.allDoneHistory,
            this.titleBySubItemId
          );
          this.renderCurrentWeekChart();
          this.availableMonths = this.buildAvailableMonths(this.allDoneHistory);
          this.selectedMonthKey = this.resolveSelectedMonthKey(
            this.selectedMonthKey,
            this.availableMonths
          );
          this.refreshMonthView();
          this.isLoading = false;
        },
        error: () => {
          this.availableMonths = [];
          this.selectedMonthKey = '';
          this.weeklyStats = [];
          this.chartWeeklyStats = [];
          this.currentWeek = null;
          this.topTodos = [];
          this.selectedWeek = null;
          this.isLoading = false;
          this.destroyChart();
          this.destroyCurrentWeekChart();
        },
      });
  }

  public selectWeek(week: WeeklyStats): void {
    this.selectedWeek = week;
  }

  public selectMonth(monthKey: string): void {
    this.selectedMonthKey = monthKey;
    this.selectedWeek = null;
    this.refreshMonthView();
  }

  public selectWeekByLabel(label: string): void {
    if (!label) {
      this.selectedWeek = null;
      return;
    }

    this.selectedWeek = this.weeklyStats.find((week) => week.label === label) ?? null;
  }

  public getSelectedWeekMaxDone(): number {
    if (!this.selectedWeek?.dayStats.length) {
      return 1;
    }

    return Math.max(...this.selectedWeek.dayStats.map((day) => day.doneCount), 1);
  }

  public getCurrentWeekMaxDone(): number {
    if (!this.currentWeek?.dayStats.length) {
      return 1;
    }

    return Math.max(...this.currentWeek.dayStats.map((day) => day.doneCount), 1);
  }

  public get currentWeekAverageDonePerDay(): number {
    if (!this.currentWeek) {
      return 0;
    }

    return this.currentWeek.doneCount / 7;
  }

  public get currentWeekBestDay(): WeekDayStats | null {
    if (!this.currentWeek?.dayStats.length) {
      return null;
    }

    const bestDay = this.currentWeek.dayStats.reduce((best, current) =>
      current.doneCount > best.doneCount ? current : best
    );

    return bestDay.doneCount > 0 ? bestDay : null;
  }

  public getSelectedWeekTopTodoMaxCount(): number {
    if (!this.selectedWeek?.topTodos.length) {
      return 1;
    }

    return Math.max(...this.selectedWeek.topTodos.map((todo) => todo.count), 1);
  }

  private refreshMonthView(): void {
    const month = this.availableMonths.find((option) => option.key === this.selectedMonthKey);

    if (!month) {
      this.weeklyStats = [];
      this.chartWeeklyStats = [];
      this.summary = this.buildSummary([]);
      this.topTodos = [];
      this.selectedWeek = null;
      this.renderChart([]);
      return;
    }

    this.chartWeeklyStats = this.buildWeeklyStatsForMonth(
      this.allDoneHistory,
      this.titleBySubItemId,
      month
    );
    this.weeklyStats = this.chartWeeklyStats.filter((row) => row.doneCount > 0);
    this.summary = this.buildSummary(this.chartWeeklyStats);

    const monthEntries = this.allDoneHistory.filter((entry) => {
      const completedAt = entry.completedAt;
      return !!completedAt && completedAt >= month.startISO && completedAt < month.endISO;
    });
    this.topTodos = this.buildTopTodos(monthEntries, this.titleBySubItemId);

    this.selectedWeek = this.resolveSelectedWeek(this.selectedWeek?.label, this.weeklyStats);
    this.renderChart(this.chartWeeklyStats);
  }

  private buildWeeklyStatsForMonth(
    doneHistory: TodoHistoryEntry[],
    titleBySubItemId: Map<string, string>,
    month: MonthOption
  ): WeeklyStats[] {
    const monthStart = new Date(month.startISO);
    const monthEnd = new Date(month.endISO);
    const rows: WeeklyStats[] = [];

    let cursor = new Date(monthStart);
    let weekIndex = 1;

    while (cursor < monthEnd) {
      const weekStart = new Date(cursor);
      const weekEnd = new Date(
        this.getWeekStart(new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000))
      );

      if (weekEnd <= weekStart) {
        weekEnd.setDate(weekStart.getDate() + 7);
      }

      if (weekEnd > monthEnd) {
        weekEnd.setTime(monthEnd.getTime());
      }

      const weekStartISO = weekStart.toISOString();
      const weekEndISO = weekEnd.toISOString();

      const entries = doneHistory.filter((entry) => {
        const completedAt = entry.completedAt;
        return !!completedAt && completedAt >= weekStartISO && completedAt < weekEndISO;
      });

      const dayStats = this.buildDayStats(entries, weekStart);

      rows.push({
        label: `S${weekIndex}`,
        rangeLabel: `${this.formatShortDate(weekStart)} - ${this.formatShortDate(new Date(weekEnd.getTime() - 1))}`,
        startISO: weekStartISO,
        endISO: weekEndISO,
        doneCount: entries.length,
        uniqueTodos: new Set(entries.map((entry) => entry.todoItemId)).size,
        dayStats,
        topTodos: this.buildTopTodos(entries, titleBySubItemId),
      });

      cursor = new Date(weekEnd);
      weekIndex++;
    }

    return rows;
  }

  private buildCurrentWeekStats(
    doneHistory: TodoHistoryEntry[],
    titleBySubItemId: Map<string, string>
  ): WeeklyStats {
    const weekStart = this.getWeekStart(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekStartISO = weekStart.toISOString();
    const weekEndISO = weekEnd.toISOString();
    const entries = doneHistory.filter((entry) => {
      const completedAt = entry.completedAt;
      return !!completedAt && completedAt >= weekStartISO && completedAt < weekEndISO;
    });

    return {
      label: 'Semaine en cours',
      rangeLabel: `${this.formatShortDate(weekStart)} - ${this.formatShortDate(new Date(weekEnd.getTime() - 1))}`,
      startISO: weekStartISO,
      endISO: weekEndISO,
      doneCount: entries.length,
      uniqueTodos: new Set(entries.map((entry) => entry.todoItemId)).size,
      dayStats: this.buildDayStats(entries, weekStart),
      topTodos: this.buildTopTodos(entries, titleBySubItemId),
    };
  }

  private buildSummary(weeklyStats: WeeklyStats[]): RecapSummary {
    if (!weeklyStats.length) {
      return {
        totalDone: 0,
        averageDonePerWeek: 0,
        bestWeekLabel: '-',
        bestWeekDone: 0,
        activeWeeksCount: 0,
      };
    }

    const totalDone = weeklyStats.reduce((acc, row) => acc + row.doneCount, 0);
    const activeWeeksCount = weeklyStats.filter((row) => row.doneCount > 0).length;
    const bestWeek = weeklyStats.reduce((best, current) =>
      current.doneCount > best.doneCount ? current : best
    );

    return {
      totalDone,
      averageDonePerWeek: totalDone / weeklyStats.length,
      bestWeekLabel: bestWeek.rangeLabel,
      bestWeekDone: bestWeek.doneCount,
      activeWeeksCount,
    };
  }

  private buildTopTodos(
    doneHistory: TodoHistoryEntry[],
    titleBySubItemId: Map<string, string>
  ): TopTodo[] {
    const countByTodoId = new Map<string, number>();

    for (const entry of doneHistory) {
      countByTodoId.set(entry.todoItemId, (countByTodoId.get(entry.todoItemId) ?? 0) + 1);
    }

    return Array.from(countByTodoId.entries())
      .map(([todoItemId, count]) => ({
        todoItemId,
        title: titleBySubItemId.get(todoItemId) ?? 'Sous-tâche supprimée',
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private buildTitleBySubItemId(todoItems: AppItem[]): Map<string, string> {
    const titleBySubItemId = new Map<string, string>();

    for (const todo of todoItems) {
      if (todo.type !== 'todo' || !todo.todoContent?.length) {
        continue;
      }

      for (const subItem of todo.todoContent) {
        const title = `${subItem.title ?? 'Sous-tâche'}`.trim() || 'Sous-tâche';
        titleBySubItemId.set(subItem.id, title);
      }
    }

    return titleBySubItemId;
  }

  private buildDayStats(entries: TodoHistoryEntry[], weekStart: Date): WeekDayStats[] {
    const labels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

    return labels.map((label, index) => {
      const dayStart = new Date(weekStart);
      dayStart.setDate(weekStart.getDate() + index);

      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayStartISO = dayStart.toISOString();
      const dayEndISO = dayEnd.toISOString();
      const doneCount = entries.filter((entry) => {
        const completedAt = entry.completedAt;
        return !!completedAt && completedAt >= dayStartISO && completedAt < dayEndISO;
      }).length;

      return {
        label,
        shortLabel: this.formatShortDate(dayStart),
        doneCount,
      };
    });
  }

  private resolveSelectedWeek(
    selectedLabel: string | undefined,
    weeklyStats: WeeklyStats[]
  ): WeeklyStats | null {
    if (!weeklyStats.length || !selectedLabel) {
      return null;
    }

    return weeklyStats.find((week) => week.label === selectedLabel) ?? null;
  }

  private buildAvailableMonths(doneHistory: TodoHistoryEntry[]): MonthOption[] {
    const keys = new Set<string>([this.toMonthKey(new Date())]);

    for (const entry of doneHistory) {
      if (!entry.completedAt) {
        continue;
      }

      keys.add(this.toMonthKey(new Date(entry.completedAt)));
    }

    return [...keys]
      .sort((a, b) => b.localeCompare(a))
      .map((key) => {
        const [year, month] = key.split('-').map(Number);
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 1);

        return {
          key,
          label: start.toLocaleDateString('fr-FR', {
            month: 'long',
            year: 'numeric',
          }),
          startISO: start.toISOString(),
          endISO: end.toISOString(),
        };
      });
  }

  private resolveSelectedMonthKey(current: string, options: MonthOption[]): string {
    const currentMonthKey = this.toMonthKey(new Date());

    if (current && options.some((option) => option.key === current)) {
      return current;
    }

    if (options.some((option) => option.key === currentMonthKey)) {
      return currentMonthKey;
    }

    return options[0]?.key ?? '';
  }

  private renderChart(weeklyStats: WeeklyStats[]): void {
    const canvas = this.weeklyHistoryChartCanvas;

    if (!canvas) {
      return;
    }

    this.destroyChart();

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: weeklyStats.map((week) => week.label),
        datasets: [
          {
            label: 'Tâches réalisées',
            data: weeklyStats.map((week) => week.doneCount),
            borderColor: '#dc2626',
            backgroundColor: 'rgba(220, 38, 38, 0.12)',
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 5,
            pointBackgroundColor: '#dc2626',
            pointBorderColor: '#dc2626',
            fill: true,
            tension: 0.38,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: (ctx) => {
                const stat = weeklyStats[ctx.dataIndex];
                return stat ? `${stat.uniqueTodos} sous-tâches distinctes` : '';
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#6b7280' },
          },
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0,
              color: '#6b7280',
            },
            grid: {
              color: 'rgba(107, 114, 128, 0.16)',
            },
          },
        },
      },
    };

    this.chart = new Chart(canvas, config);
  }

  private destroyChart(): void {
    this.chart?.destroy();
    this.chart = undefined;
  }

  private renderCurrentWeekChart(): void {
    const canvas = this.currentWeekChartCanvas;
    const currentWeek = this.currentWeek;

    if (!canvas || !currentWeek) {
      return;
    }

    this.destroyCurrentWeekChart();

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: currentWeek.dayStats.map((day) => day.label),
        datasets: [
          {
            label: 'Tâches réalisées',
            data: currentWeek.dayStats.map((day) => day.doneCount),
            borderColor: '#dc2626',
            backgroundColor: 'rgba(220, 38, 38, 0.12)',
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 5,
            pointBackgroundColor: '#dc2626',
            pointBorderColor: '#dc2626',
            fill: true,
            tension: 0.38,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: true },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#6b7280' },
          },
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0,
              color: '#6b7280',
            },
            grid: {
              color: 'rgba(107, 114, 128, 0.16)',
            },
          },
        },
      },
    };

    this.currentWeekChart = new Chart(canvas, config);
  }

  private destroyCurrentWeekChart(): void {
    this.currentWeekChart?.destroy();
    this.currentWeekChart = undefined;
  }

  private getWeekStart(date: Date): Date {
    const start = new Date(date);
    const day = start.getDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - daysSinceMonday);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private formatShortDate(date: Date): string {
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
    });
  }

  private toMonthKey(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}`;
  }
}
