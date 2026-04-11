import { CommonModule } from "@angular/common";
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from "@angular/core";
import { Chart, ChartConfiguration, registerables } from "chart.js";
import { combineLatest, Subject, takeUntil } from "rxjs";
import { AppItem } from "../../shared/models/app-item.model";
import { TodoHistoryEntry } from "../../shared/models/todo-history.model";
import { ItemsService } from "../../shared/services/items.service";
import { TodoHistoryService } from "../../shared/services/todo-history.service";

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
  selector: "history-recap",
  templateUrl: "./history-recap.component.html",
  styleUrls: ["./history-recap.component.scss"],
  imports: [CommonModule],
})
export class HistoryRecapComponent implements AfterViewInit, OnDestroy {
  private readonly todoHistoryService = inject(TodoHistoryService);
  private readonly itemsService = inject(ItemsService);
  private readonly destroy$ = new Subject<void>();

  private chart?: Chart;
  private weeklyHistoryChartCanvas?: HTMLCanvasElement;
  private readonly weeksToAnalyze = 8;

  public isLoading: boolean = true;
  public weeklyStats: WeeklyStats[] = [];
  public summary: RecapSummary = {
    totalDone: 0,
    averageDonePerWeek: 0,
    bestWeekLabel: "-",
    bestWeekDone: 0,
    activeWeeksCount: 0,
  };
  public topTodos: TopTodo[] = [];
  public selectedWeek: WeeklyStats | null = null;

  @ViewChild("weeklyHistoryChart")
  private set weeklyHistoryChartRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    const canvas = ref?.nativeElement;

    if (!canvas) {
      this.weeklyHistoryChartCanvas = undefined;
      this.destroyChart();
      return;
    }

    this.weeklyHistoryChartCanvas = canvas;

    if (this.weeklyStats.length) {
      this.renderChart(this.weeklyStats);
    }
  }

  public ngAfterViewInit(): void {
    this.loadRecap();
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.destroyChart();
  }

  private loadRecap(): void {
    this.isLoading = true;

    combineLatest([
      this.todoHistoryService.getAll(),
      this.itemsService.getAllActive("todo"),
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ([history, todoItems]) => {
          const doneHistory = history.filter((entry) => entry.status === "done" && !!entry.completedAt);
          const titleBySubItemId = this.buildTitleBySubItemId(todoItems);
          this.weeklyStats = this.buildWeeklyStats(doneHistory, titleBySubItemId);
          this.summary = this.buildSummary(this.weeklyStats);
          this.topTodos = this.buildTopTodos(doneHistory, titleBySubItemId);
          this.selectedWeek = this.resolveSelectedWeek(this.selectedWeek?.label, this.weeklyStats);
          this.renderChart(this.weeklyStats);
          this.isLoading = false;
        },
        error: () => {
          this.weeklyStats = [];
          this.topTodos = [];
          this.selectedWeek = null;
          this.isLoading = false;
          this.destroyChart();
        },
      });
  }

  public selectWeek(week: WeeklyStats): void {
    this.selectedWeek = week;
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

  public getSelectedWeekTopTodoMaxCount(): number {
    if (!this.selectedWeek?.topTodos.length) {
      return 1;
    }

    return Math.max(...this.selectedWeek.topTodos.map((todo) => todo.count), 1);
  }

  private buildWeeklyStats(doneHistory: TodoHistoryEntry[], titleBySubItemId: Map<string, string>): WeeklyStats[] {
    const currentWeekStart = this.getWeekStart(new Date());
    const rows: WeeklyStats[] = [];

    for (let offset = this.weeksToAnalyze; offset >= 1; offset--) {
      const weekStart = new Date(currentWeekStart);
      weekStart.setDate(weekStart.getDate() - (offset * 7));

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekStartISO = weekStart.toISOString();
      const weekEndISO = weekEnd.toISOString();

      const entries = doneHistory.filter((entry) => {
        const completedAt = entry.completedAt;
        return !!completedAt && completedAt >= weekStartISO && completedAt < weekEndISO;
      });

      const dayStats = this.buildDayStats(entries, weekStart);

      rows.push({
        label: `S-${offset}`,
        rangeLabel: `${this.formatShortDate(weekStart)} - ${this.formatShortDate(new Date(weekEnd.getTime() - 1))}`,
        startISO: weekStartISO,
        endISO: weekEndISO,
        doneCount: entries.length,
        uniqueTodos: new Set(entries.map((entry) => entry.todoItemId)).size,
        dayStats,
        topTodos: this.buildTopTodos(entries, titleBySubItemId),
      });
    }

    return rows.filter((row) => row.doneCount > 0);
  }

  private buildSummary(weeklyStats: WeeklyStats[]): RecapSummary {
    if (!weeklyStats.length) {
      return {
        totalDone: 0,
        averageDonePerWeek: 0,
        bestWeekLabel: "-",
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

  private buildTopTodos(doneHistory: TodoHistoryEntry[], titleBySubItemId: Map<string, string>): TopTodo[] {
    const countByTodoId = new Map<string, number>();

    for (const entry of doneHistory) {
      countByTodoId.set(entry.todoItemId, (countByTodoId.get(entry.todoItemId) ?? 0) + 1);
    }

    return Array.from(countByTodoId.entries())
      .map(([todoItemId, count]) => ({
        todoItemId,
        title: titleBySubItemId.get(todoItemId) ?? "Sous-tâche supprimée",
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private buildTitleBySubItemId(todoItems: AppItem[]): Map<string, string> {
    const titleBySubItemId = new Map<string, string>();

    for (const todo of todoItems) {
      if (todo.type !== "todo" || !todo.todoContent?.length) {
        continue;
      }

      for (const subItem of todo.todoContent) {
        const title = `${subItem.title ?? "Sous-tâche"}`.trim() || "Sous-tâche";
        titleBySubItemId.set(subItem.id, title);
      }
    }

    return titleBySubItemId;
  }

  private buildDayStats(entries: TodoHistoryEntry[], weekStart: Date): WeekDayStats[] {
    const labels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

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

  private resolveSelectedWeek(selectedLabel: string | undefined, weeklyStats: WeeklyStats[]): WeeklyStats | null {
    if (!weeklyStats.length || !selectedLabel) {
      return null;
    }

    return weeklyStats.find((week) => week.label === selectedLabel) ?? null;
  }

  private renderChart(weeklyStats: WeeklyStats[]): void {
    const canvas = this.weeklyHistoryChartCanvas;

    if (!canvas) {
      return;
    }

    this.destroyChart();

    const config: ChartConfiguration<"bar"> = {
      type: "bar",
      data: {
        labels: weeklyStats.map((week) => week.label),
        datasets: [
          {
            label: "Tâches réalisées",
            data: weeklyStats.map((week) => week.doneCount),
            borderRadius: 8,
            maxBarThickness: 32,
            backgroundColor: "#4f7cff",
            hoverBackgroundColor: "#3d68e5",
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
                return stat ? `${stat.uniqueTodos} sous-tâches distinctes` : "";
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#6b7280" },
          },
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0,
              color: "#6b7280",
            },
            grid: {
              color: "rgba(107, 114, 128, 0.16)",
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

  private getWeekStart(date: Date): Date {
    const start = new Date(date);
    const day = start.getDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - daysSinceMonday);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private formatShortDate(date: Date): string {
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    });
  }
}
