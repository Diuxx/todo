import { Component, inject, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { NgClass } from "@angular/common";
import { AppData } from "../../shared/models/app-data.model";
import { AppItem } from "../../shared/models/app-item.model";
import { ItemsService } from "../../shared/services/items.service";
import { DashboardSkeletonComponent } from "../../shared/components/dashboard-skeleton/dashboard-skeleton.component";
import { SettingsService } from "../../shared/services/settings.service";
import { switchMap } from "rxjs";
import { AppSettings } from "../../shared/models/app-settings.model";
import { PasswordPromptModalComponent } from "../../shared/components/password-prompt-modal/password-prompt-modal.component";
import { ItemLockService } from "../../shared/services/item-lock.service";

@Component({
  standalone: true,
  selector: 'life-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  imports: [NgClass, DashboardSkeletonComponent, PasswordPromptModalComponent]
})
export class DashboardComponent implements OnInit {

  // -- variables --
  private readonly itemsService = inject(ItemsService);
  private readonly settingsService = inject(SettingsService);
  private readonly router: Router = inject(Router);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly itemLockService = inject(ItemLockService);

  public data: AppData | null = null;
  public filter: string | null = null;

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
    console.log('DashboardComponent initialized');
    this.route.queryParamMap.subscribe(params => {
      this.filter = params.get('filter') || null;
      console.log('filter:', this.filter);

      this.getData(this.filter);
    });
  }

  /**
   * Formats the progress of a todo item as a string in the format "done / total".
   * If the item is not a todo or has no todo content, it returns "0 / 0".
   * @param item The item for which to format the progress.
   * @returns A string representing the progress of the todo item.
   */
  public formatTodoProgress(item: AppItem): string {
    const total = item.todoContent?.length || 0;
    const done = item.todoContent?.filter(subItem => !!subItem.isDone).length || 0;
    return `${done} / ${total}`;
  }

  public get affirmationItem(): AppItem | undefined {
    if (this.filter) {
      return undefined;
    }

    return this.settings?.dailyAffirmationEnabled
      ? this.items.find(item => item.type === 'citation' && !!item.isAffirmation)
      : undefined;
  }

  public get displayedItems(): AppItem[] {
    const affirmation = this.affirmationItem;

    if (!affirmation) {
      return this.items;
    }

    return this.items.filter(item => item.id !== affirmation.id);
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
    this.settingsService.get()
      .pipe(
        switchMap((config) => this.itemsService.getAll(filter, !!config?.showArchivedItems).pipe(
          switchMap((items) => [{ items, config }])
        ))
      )
      .subscribe({
      next: ({ items, config }) => {
        this.items = items;
        this.settings = config;
        this.isLoading = false;
        console.log('Active items fetched successfully:', items);
      },
      error: (error) => {
        console.error('Error fetching active items:', error);
        this.items = [];
        this.isLoading = false;
      }
    });
  }
}