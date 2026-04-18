import { Location } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { RouterLink } from '@angular/router';
import { Subject, filter, takeUntil } from 'rxjs';
import { TodoHeaderComponent } from './shared/components/todo-header/todo-header.component';
import { TodoFooterComponent } from './shared/components/todo-footer/todo-footer.component';
import { DatabaseService } from './shared/services/database.service';
import { ConfirmDialogComponent } from './shared/components/confirm-dialog/confirm-dialog.component';
import { SettingsService } from './shared/services/settings.service';
import { LocalNotificationService } from './shared/services/local-notification.service';
import { environment } from '../env/env';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    FormsModule,
    TodoHeaderComponent,
    TodoFooterComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  // services
  private readonly router: Router = inject(Router);
  private readonly location = inject(Location);
  private readonly databaseService = inject(DatabaseService);
  private readonly settingsService = inject(SettingsService);
  private readonly notificationService = inject(LocalNotificationService);

  // service observables
  public readonly settings$ = this.settingsService.settings$;

  // variables
  title = 'to-do';
  public readonly appVersion = environment.appVersion;
  public isSearchOpen = false;
  public searchQuery = '';
  private searchDebounceTimer?: ReturnType<typeof setTimeout>;
  private readonly destroy$ = new Subject<void>();
  private lastDashboardFilter: 'todo' | 'note' | 'citation' | null = null;
  public readonly itemTypeFilters: Array<{
    label: string;
    value: 'all' | 'todo' | 'note' | 'citation';
  }> = [
    { label: 'Tous', value: 'all' },
    { label: 'Todo', value: 'todo' },
    { label: 'Notes', value: 'note' },
    { label: 'Citations', value: 'citation' },
  ];
  public canGoBack: boolean = false;
  public isAppReady: boolean = false;

  /**
   * Cleans up subscriptions and pending timers to avoid memory leaks.
   */
  public ngOnDestroy(): void {
    clearTimeout(this.searchDebounceTimer);
    this.destroy$.next();
    this.destroy$.complete();
  }

  async ngOnInit(): Promise<void> {
    console.log('init application.');

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((e) => {
        const path = e.urlAfterRedirects.split('?')[0];

        if (path === '/') {
          this.lastDashboardFilter = this.extractFilterFromUrl(e.urlAfterRedirects);
          return;
        }

        if (path !== '/') {
          this.isSearchOpen = false;
          clearTimeout(this.searchDebounceTimer);
        }
      });

    try {
      await this.databaseService.init();
      this.settingsService.get().subscribe(); // Load settings into the reactive stream only after the DB is ready.

      try {
        await this.notificationService.init((action) => {
          const route = action.notification.extra?.route;
          if (typeof route === 'string' && route.length > 0) {
            this.router.navigateByUrl(route);
          }
        });

        await this.notificationService.syncScheduledTodoNotifications();
      } catch (error) {
        console.warn('Local notifications are unavailable:', error);
      }
    } finally {
      this.isAppReady = true;
    }
  }

  /**
   * Returns true when the current route points to the dashboard path.
   */
  public isHomePage(): boolean {
    return this.router.url.split('?')[0] === '/';
  }

  /**
   * Navigates back to the previous page, or falls back to the dashboard.
   */
  public goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }

    this.router.navigate(['/'], { queryParams: { filter: this.lastDashboardFilter, q: null } });
  }

  /**
   * Toggles the header search mode and resets query parameters when closing.
   */
  public toggleSearch(): void {
    this.isSearchOpen = !this.isSearchOpen;

    if (!this.isSearchOpen) {
      clearTimeout(this.searchDebounceTimer);
      this.searchQuery = '';
      this.router.navigate(['/'], { queryParams: { q: null }, queryParamsHandling: 'merge' });
    }
  }

  /**
   * Debounces search input updates and syncs the query to router params.
   */
  public onSearchChange(value: string): void {
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.router.navigate(['/'], {
        queryParams: { q: value.trim() || null },
        queryParamsHandling: 'merge',
      });
    }, 300);
  }

  /**
   * Computes active state for header filter pills.
   */
  public isItemTypeFilterActive(value: 'all' | 'todo' | 'note' | 'citation'): boolean {
    const current = this.getCurrentItemTypeFilter();

    if (value === 'all') {
      return current === null;
    }

    return current === value;
  }

  /**
   * Returns query params for filter navigation with toggle behavior.
   */
  public getItemTypeFilterQueryParams(value: 'all' | 'todo' | 'note' | 'citation'): {
    filter: 'todo' | 'note' | 'citation' | null;
  } {
    if (value === 'all') {
      return { filter: null };
    }

    // Toggle behavior: clicking the active filter resets to "Tous".
    if (this.isItemTypeFilterActive(value)) {
      return { filter: null };
    }

    return { filter: value };
  }

  public isCalendarFilterActive(): boolean {
    const query = this.router.url.split('?')[1] ?? '';
    return new URLSearchParams(query).get('calendar') === '1';
  }

  public toggleCalendarFilter(): void {
    this.router.navigate(['/'], {
      queryParams: { calendar: this.isCalendarFilterActive() ? null : '1' },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * Reads the currently selected item-type filter from URL query params.
   */
  private getCurrentItemTypeFilter(): 'todo' | 'note' | 'citation' | null {
    const query = this.router.url.split('?')[1] ?? '';
    const selected = new URLSearchParams(query).get('filter');

    if (selected === 'todo' || selected === 'note' || selected === 'citation') {
      return selected;
    }

    return null;
  }

  /**
   * Extracts a valid item-type filter from any absolute/relative URL string.
   */
  private extractFilterFromUrl(url: string): 'todo' | 'note' | 'citation' | null {
    const query = url.split('?')[1] ?? '';
    const selected = new URLSearchParams(query).get('filter');

    if (selected === 'todo' || selected === 'note' || selected === 'citation') {
      return selected;
    }

    return null;
  }
}
