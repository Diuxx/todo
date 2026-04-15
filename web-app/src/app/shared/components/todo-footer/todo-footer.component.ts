import { NgClass } from '@angular/common';
import { Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { Subject, filter, takeUntil } from 'rxjs';
import { SaveActionService, TodoProgress } from '../../services/save-action.service';
import { SelectItemTypeModalComponent } from '../select-item-type-modal/select-item-type-modal.component';
import { ItemsService } from '../../services/items.service';
import { AppItem } from '../../models/app-item.model';

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
  public isSelectTypeModalVisible: boolean = false;
  public todoProgress: TodoProgress | null = null;

  private readonly destroy$ = new Subject<void>();
  private readonly staticRoutes = new Set(['settings', 'recap']);

  private progressCanvas?: HTMLCanvasElement;
  private todoProgressCanvas?: HTMLCanvasElement;
  private todoProgressChart?: Chart;
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
    private readonly itemsService: ItemsService
  ) {
    this.updateCenterActionFromUrl(this.router.url);
    this.loadProgressStats();

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event) => {
        this.updateCenterActionFromUrl(event.urlAfterRedirects);
        this.loadProgressStats();
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
        }
      }

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
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        animation: false,
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

  private updateCenterActionFromUrl(url: string): void {
    const normalizedPath = url.split('?')[0].replace(/^\//, '');
    this.isDashboardRoute = !normalizedPath || normalizedPath === 'dashboard';

    if (!normalizedPath) {
      this.showSaveIcon = false;
      return;
    }

    const segments = normalizedPath.split('/').filter(Boolean);
    this.showSaveIcon = segments.length > 1 && segments[0] === 'item' && segments[1] != null;
  }
}
