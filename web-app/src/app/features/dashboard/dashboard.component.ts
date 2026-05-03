import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgClass } from '@angular/common';
import { AppData } from '../../shared/models/app-data.model';
import { AppItem } from '../../shared/models/app-item.model';
import { ItemsService } from '../../shared/services/items.service';
import { DashboardSkeletonComponent } from '../../shared/components/dashboard-skeleton/dashboard-skeleton.component';
import { SettingsService } from '../../shared/services/settings.service';
import { Subject, switchMap } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AppSettings } from '../../shared/models/app-settings.model';
import { PasswordPromptModalComponent } from '../../shared/components/password-prompt-modal/password-prompt-modal.component';
import { ItemLockService } from '../../shared/services/item-lock.service';
import { getTodoCriticalityRank, normalizeTodoDueDate } from '../../shared/utils/todo-config.utils';

@Component({
  standalone: true,
  selector: 'life-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  imports: [NgClass, DashboardSkeletonComponent, PasswordPromptModalComponent],
})
export class DashboardComponent implements OnInit, OnDestroy {
  // -- variables --
  private readonly itemsService = inject(ItemsService);
  private readonly settingsService = inject(SettingsService);
  private readonly router: Router = inject(Router);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly itemLockService = inject(ItemLockService);
  private readonly destroy$ = new Subject<void>();

  public data: AppData | null = null;
  public filter: string | null = null;
  public searchQuery: string | null = null;
  public calendarOnlyMode: boolean = false;

  public items: AppItem[] = [];
  public settings: AppSettings | undefined;
  public selectedItemId: string | null = null;
  public isLoading: boolean = true;
  public lockedItemPending?: AppItem;
  public isUnlockModalVisible = false;
  public isUnlockSubmitting = false;
  public unlockErrorMessage: string | null = null;

  // -- functions --
  public ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const rawFilter = params.get('filter');
      this.calendarOnlyMode = params.get('calendar') === '1' || rawFilter === 'calendar';
      this.filter = rawFilter === 'todo' || rawFilter === 'note' || rawFilter === 'citation' ? rawFilter : null;
      this.searchQuery = params.get('q') || null;

      this.getData(this.searchQuery ? null : this.filter);
    });
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Formats the progress of a todo item as a string in the format "done / total".
   * If the item is not a todo or has no todo content, it returns "0 / 0".
   * @param item The item for which to format the progress.
   * @returns A string representing the progress of the todo item.
   */
  public formatTodoProgress(item: AppItem): string {
    const total = item.todoContent?.length || 0;
    const done = item.todoContent?.filter((subItem) => !!subItem.isDone).length || 0;
    return `${done} / ${total}`;
  }

  public formatItemDate(item: AppItem): string {
    const itemDate = normalizeTodoDueDate(item.date);

    if (!itemDate) {
      return '';
    }

    return new Date(`${itemDate}T00:00:00`).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
    });
  }

  public getSortedTodoPreview(item: AppItem) {
    if (item.type !== 'todo' || !item.todoContent?.length) {
      return [];
    }

    return [...item.todoContent]
      .sort((left, right) => {
        const doneDelta = Number(!!left.isDone) - Number(!!right.isDone);

        if (doneDelta !== 0) {
          return doneDelta;
        }

        const criticalityDelta =
          getTodoCriticalityRank(left.config?.criticality) -
          getTodoCriticalityRank(right.config?.criticality);

        if (criticalityDelta !== 0) {
          return criticalityDelta;
        }

        return `${left.title ?? ''}`.localeCompare(`${right.title ?? ''}`, 'fr');
      })
      .slice(0, 3);
  }

  public get affirmationItem(): AppItem | undefined {
    if (this.filter || this.searchQuery || this.calendarOnlyMode) {
      return undefined;
    }

    return this.settings?.dailyAffirmationEnabled
      ? this.items.find((item) => item.type === 'citation' && !!item.isAffirmation)
      : undefined;
  }

  public get displayedItems(): AppItem[] {
    const affirmation = this.affirmationItem;
    const baseItems = this.items.filter((item) => {
      if (affirmation && item.id === affirmation.id) {
        return false;
      }

      const isCalendarItem = !!item.fromCalendar;

      if (this.calendarOnlyMode ? !isCalendarItem : isCalendarItem) {
        return false;
      }

      if (!this.filter && item.type === 'citation') {
        return false;
      }

      return true;
    });

    if (!this.searchQuery) {
      return baseItems;
    }

    const needle = this.searchQuery.toLowerCase();
    return baseItems.filter(
      (item) =>
        item.title?.toLowerCase().includes(needle) || item.content?.toLowerCase().includes(needle)
    );
  }

  /**
   * Displays the details of the selected item.
   * @param item The item to display details for.
   */
  public displayItemDetails(item: AppItem): void {
    if (item.isLocked && !this.itemLockService.isUnlocked(item.id)) {
      this.lockedItemPending = item;
      this.unlockErrorMessage = null;
      this.isUnlockModalVisible = true;
      return;
    }

    this.selectedItemId = item.id;
    setTimeout(() => this.router.navigate([`item/${item.id}`]), 220);
  }

  public closeUnlockModal(): void {
    this.isUnlockModalVisible = false;
    this.isUnlockSubmitting = false;
    this.unlockErrorMessage = null;
    this.lockedItemPending = undefined;
  }

  public async unlockAndOpenItem(password: string): Promise<void> {
    if (!this.lockedItemPending) {
      return;
    }

    this.isUnlockSubmitting = true;
    this.unlockErrorMessage = null;

    const isValid = await this.itemLockService.verifyPassword(password);

    if (!isValid) {
      this.isUnlockSubmitting = false;
      this.unlockErrorMessage = 'Mot de passe incorrect.';
      return;
    }

    const item = this.lockedItemPending;
    this.itemLockService.unlock(item.id);
    this.closeUnlockModal();
    this.displayItemDetails(item);
  }

  /**
   * Fetches the application data and updates the component state.
   * @returns void
   */
  private getData(filter: string | null = null): void {
    this.isLoading = true;
    this.settingsService
      .get()
      .pipe(
        switchMap((config) =>
          this.itemsService
            .getAll(filter, !!config?.showArchivedItems)
            .pipe(switchMap((items) => [{ items, config }]))
        )
      )
      .subscribe({
        next: ({ items, config }) => {
          this.items = items;
          this.settings = config;
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error fetching active items:', error);
          this.items = [];
          this.isLoading = false;
        },
      });
  }
}
