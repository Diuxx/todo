import { NgClass } from "@angular/common";
import { Component, ElementRef, Input, OnDestroy, ViewChild } from "@angular/core";
import { NavigationEnd, Router, RouterLink } from "@angular/router";
import { Chart, ChartConfiguration, registerables } from "chart.js";
import { Subject, filter, takeUntil } from "rxjs";
import { SaveActionService } from "../../services/save-action.service";

Chart.register(...registerables);

@Component({
    selector: 'todo-footer',
    templateUrl: './todo-footer.component.html',
    styleUrls: ['./todo-footer.component.scss'],
    imports: [RouterLink, NgClass]
})
export class TodoFooterComponent implements OnDestroy {

    @Input() visible: boolean = true;
    public showSaveIcon: boolean = false;

    private readonly destroy$ = new Subject<void>();
    private readonly staticRoutes = new Set(['settings']);

    private progressCanvas?: HTMLCanvasElement;

    constructor(
        private readonly router: Router,
        private readonly saveActionService: SaveActionService
    ) {
        this.updateCenterActionFromUrl(this.router.url);
        this.router.events
            .pipe(
                filter((event): event is NavigationEnd => event instanceof NavigationEnd),
                takeUntil(this.destroy$)
            )
            .subscribe((event) => {
                this.updateCenterActionFromUrl(event.urlAfterRedirects);
            });
    }

    /**
     * Handles the click event on the board menu item. Currently, this method is a placeholder and does not perform any actions.
     */
    public onBoardClick(): void {
        if (this.showSaveIcon) {
            this.saveActionService.triggerSave();
            return;
        }
        // todo: display stats recap...
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
        this.destroy$.next();
        this.destroy$.complete();
    }

    private renderProgressChart(): void {
        if (!this.progressCanvas) {
            return;
        }

        this.destroyChart();

        const dayDone = 3;
        const dayTotal = 8;
        const weekDone = 11;
        const weekTotal = 20;
        const monthDone = 16;
        const monthTotal = 40;

        const chartConfig: ChartConfiguration<'doughnut'> = {
            type: 'doughnut',
            data: {
                labels: ['Done', 'Remaining'],
                datasets: [
                    {
                        label: 'Jour',
                        data: [dayDone, Math.max(0, dayTotal - dayDone)],
                        backgroundColor: ['#32c493', '#E5E7EB'],
                        borderWidth: 0,
                    },
                    {
                        label: 'Semaine',
                        data: [weekDone, Math.max(0, weekTotal - weekDone)],
                        backgroundColor: ['#6378FF', '#E5E7EB'],
                        borderWidth: 0,
                    },
                    {
                        label: 'Mois',
                        data: [monthDone, Math.max(0, monthTotal - monthDone)],
                        backgroundColor: ['#FFB85C', '#E5E7EB'],
                        borderWidth: 0,
                    }
                ]
            },
            options: {
                responsive: true,
                cutout: '18%',
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                animation: true,
                events: []
            }
        };

        this.progressChart = new Chart(this.progressCanvas, chartConfig);
    }

    private destroyChart(): void {
        this.progressChart?.destroy();
        this.progressChart = undefined;
    }

    private updateCenterActionFromUrl(url: string): void {
        const normalizedPath = url.split('?')[0].replace(/^\//, '');

        if (!normalizedPath) {
            this.showSaveIcon = false;
            return;
        }

        const segments = normalizedPath.split('/').filter(Boolean);

        this.showSaveIcon = segments.length > 1 && segments[0] === 'item' && segments[1] != null; 
    }

}