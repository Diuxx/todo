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
  imports: [RouterOutlet, RouterLink, FormsModule, TodoHeaderComponent, TodoFooterComponent, ConfirmDialogComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {

  // services
  private readonly router: Router = inject(Router);
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
  public readonly itemTypeFilters: Array<{ label: string; value: 'all' | 'todo' | 'note' | 'citation' }> = [
    { label: 'Tous', value: 'all' },
    { label: 'Todo', value: 'todo' },
    { label: 'Notes', value: 'note' },
    { label: 'Citations', value: 'citation' },
  ];
  public canGoBack: boolean = false;
  public isAppReady: boolean = false;

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

  public isHomePage(): boolean {
    return this.router.url.split('?')[0] === '/';
  }

  public goHome(): void {
    this.router.navigate(['/'], { queryParams: { filter: this.lastDashboardFilter, q: null } });
  }

  public toggleSearch(): void {
    this.isSearchOpen = !this.isSearchOpen;

    if (!this.isSearchOpen) {
      clearTimeout(this.searchDebounceTimer);
      this.searchQuery = '';
      this.router.navigate(['/'], { queryParams: { q: null }, queryParamsHandling: 'merge' });
    }
  }

  public onSearchChange(value: string): void {
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.router.navigate(['/'], { queryParams: { q: value.trim() || null }, queryParamsHandling: 'merge' });
    }, 300);
  }

  public isItemTypeFilterActive(value: 'all' | 'todo' | 'note' | 'citation'): boolean {
    const current = this.getCurrentItemTypeFilter();

    if (value === 'all') {
      return current === null;
    }

    return current === value;
  }

  public getItemTypeFilterQueryParams(value: 'all' | 'todo' | 'note' | 'citation'): { filter: 'todo' | 'note' | 'citation' | null } {
    if (value === 'all') {
      return { filter: null };
    }

    // Toggle behavior: clicking the active filter resets to "Tous".
    if (this.isItemTypeFilterActive(value)) {
      return { filter: null };
    }

    return { filter: value };
  }

  private getCurrentItemTypeFilter(): 'todo' | 'note' | 'citation' | null {
    const query = this.router.url.split('?')[1] ?? '';
    const selected = new URLSearchParams(query).get('filter');

    if (selected === 'todo' || selected === 'note' || selected === 'citation') {
      return selected;
    }

    return null;
  }

  private extractFilterFromUrl(url: string): 'todo' | 'note' | 'citation' | null {
    const query = url.split('?')[1] ?? '';
    const selected = new URLSearchParams(query).get('filter');

    if (selected === 'todo' || selected === 'note' || selected === 'citation') {
      return selected;
    }

    return null;
  }
}