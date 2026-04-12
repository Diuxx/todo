import { Component, ElementRef, OnInit, ViewChild, inject } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { Observable, Subject, debounceTime, takeUntil } from "rxjs";
import { AppItem } from "../../shared/models/app-item.model";
import { ItemsService } from "../../shared/services/items.service";
import { SaveActionService } from "../../shared/services/save-action.service";
import { TodoEditModalComponent } from "./todo-edit-modal/todo-edit-modal.component";
import { createItemForm, getTodoContentFormArray, getTodoSubItemFormGroups, mapItemFormToAppItem } from "../../shared/models/app-item-form.model";
import { NgClass, NgStyle } from "@angular/common";
import { generateUUID } from "../../shared/utils";
import { ConfirmDialogService } from "../../shared/services/confirm-dialog.service";
import { TodoHistoryService } from "../../shared/services/todo-history.service";
import { ItemDetailSkeletonComponent } from "../../shared/components/item-detail-skeleton/item-detail-skeleton.component";
import { LocalNotificationService } from "../../shared/services/local-notification.service";
import { PasswordPromptModalComponent } from "../../shared/components/password-prompt-modal/password-prompt-modal.component";
import { ItemLockService } from "../../shared/services/item-lock.service";

const ITEM_DETAIL_IMPORTS = [
  ReactiveFormsModule,
  TodoEditModalComponent,
  NgClass,
  NgStyle,
  ItemDetailSkeletonComponent,
  PasswordPromptModalComponent,
];

@Component({
  standalone: true,
  selector: 'item-detail',
  templateUrl: './item-detail.component.html',
  styleUrls: ['./item-detail.component.scss'],
  imports: ITEM_DETAIL_IMPORTS,
})
export class ItemDetailComponent implements OnInit {

  // services
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly itemsService = inject(ItemsService);
  private readonly saveActionService = inject(SaveActionService);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly todoHistoryService = inject(TodoHistoryService);
  private readonly localNotificationService = inject(LocalNotificationService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly itemLockService = inject(ItemLockService);

  private readonly destroy$ = new Subject<void>();
  private savedFeedbackTimeoutId?: ReturnType<typeof setTimeout>;

  private pendingTextareaFocus: boolean = false;
  private contentTextareaElement?: HTMLTextAreaElement;
  private editingSubItemSnapshot: Record<string, unknown> | null = null;
  
  public isTodoEditModalVisible: boolean = false;
  public itemForm: FormGroup = createItemForm(this.formBuilder);
  public editingSubItemForm?: FormGroup;
  public isLoading: boolean = true;
  public isUnlockModalVisible = false;
  public isUnlockSubmitting = false;
  public unlockErrorMessage: string | null = null;
  public hasCurrentAccess = false;

  @ViewChild('titleInput')
  private titleInputRef?: ElementRef<HTMLInputElement>;

  @ViewChild('contentTextarea')
  private set contentTextareaRef(textareaRef: ElementRef<HTMLTextAreaElement> | undefined) {
    this.contentTextareaElement = textareaRef?.nativeElement;

    if (!textareaRef || !this.pendingTextareaFocus) {
      return;
    }

    this.pendingTextareaFocus = false;
    requestAnimationFrame(() => {
      const textarea = textareaRef.nativeElement;
      textarea.focus();

      const valueLength = textarea.value.length;
      textarea.setSelectionRange(valueLength, valueLength);
    });
  }

  public item: AppItem | undefined;

  public ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      return;
    }

    // get item and create form.
    this.itemsService.getItemById(id).subscribe({
      next: (item) => {
        this.item = item;
        this.itemForm = createItemForm(this.formBuilder, item);
        this.setupAutoSaveSubscriptions();
        this.emitTodoProgress();
        this.pendingTextareaFocus = !!item && !(item.type === 'todo' && item.todoContent?.length);
        this.hasCurrentAccess = !!item && (!item.isLocked || this.itemLockService.isUnlocked(item.id));
        this.isLoading = false;

        if (item?.isLocked && !this.hasCurrentAccess) {
          this.isUnlockModalVisible = true;
        }
      },
      error: (err) => {
        console.log('Error fetching item with id:', id, err);
        this.isLoading = false;
      }
    });

    this.saveActionService.save$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.saveElement());
  }

  public ngOnDestroy(): void {
    if (this.item?.isLocked) {
      this.itemLockService.lock(this.item.id);
      this.hasCurrentAccess = false;
    }

    this.destroy$.next();
    this.destroy$.complete();

    if (this.savedFeedbackTimeoutId) {
      clearTimeout(this.savedFeedbackTimeoutId);
    }

    this.saveActionService.updateTodoProgress(null);
  }

  public isFormChanged(): boolean {
    return this.itemForm.dirty;
  }

  /**
   * Deletes the current item.
   * @returns void
   */
  public deleteItem(): void {
    if (!this.item) {
      return;
    }

    this.confirmDialogService
      .confirm({
        title: 'Supprimer cet item ?',
        message: `Cette action supprimera "${this.item.title}" définitivement.`,
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
        variant: 'danger',
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe(confirmed => {
        if (!confirmed || !this.item) {
          return;
        }

        this.itemsService.deleteItem(this.item.id).subscribe({
          next: () => {
            this.router.navigate(['/']);
          },
          error: () => console.log('Error deleting item')
        });
      });
  }

  /**
   * Saves the current item if it has been modified.
   * @returns void
   */
  public saveElement(): void {
    if (!this.item || !this.itemForm.dirty) {
      return;
    }

    const payload = mapItemFormToAppItem(this.itemForm, this.item);
    this.item = payload;

    // --
    this.itemsService.updateItem(payload).subscribe({
        next: () => {
          this.itemForm.markAsPristine();
          this.triggerSavedFeedback()
        },
        error: () => console.log('Error updating item')
    });
  }

  /**
   * Adds a new sub-item to the todo content and opens the edit modal for it.
   * Does nothing if the current item is not a todo.
   * @returns void
   */
  public addTodoSubItem(): void {
    if (this.item?.type !== 'todo') {
      return;
    }

    const todoContentArray = getTodoContentFormArray(this.itemForm);
    const subItemForm = this.formBuilder.group({
      id: [generateUUID()],
      title: [''],
      isDone: [false],
      recurrenceType: ['none'],
      alertEnabled: [false],
      alertAt: [''],
      recurrenceRule: [''],
      lastCompletedAt: [''],
      nextDueAt: [''],
    });

    todoContentArray.push(subItemForm);
    subItemForm.markAsDirty();
    this.itemForm.markAsDirty();
    this.emitTodoProgress();

    this.openTodoEditModal(subItemForm);
  }

  /**
   * Deletes a sub-item from the todo content.
   * If the deleted sub-item is currently being edited, it also closes the edit modal.
   * @param subItemForm The form group of the sub-item to delete.
   * @returns void
   */
  public deleteTodoSubItem(subItemForm: FormGroup): void {
    if (this.item?.type !== 'todo') {
      return;
    }

    const subItemTitle = `${subItemForm.get('title')?.value ?? ''}`.trim();

    this.confirmDialogService
      .confirm({
        title: 'Supprimer la sous-tâche ?',
        message: subItemTitle
          ? `Cette action supprimera "${subItemTitle}" définitivement.`
          : 'Cette action supprimera la sous-tâche définitivement.',
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
        variant: 'danger',
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe(confirmed => {
        if (!confirmed) {
          return;
        }

        this.removeTodoSubItem(subItemForm);
      });
  }

  /**
   * Opens the todo edit modal for a given sub-item form.
   * @param subItemForm The form group of the sub-item to edit.
   * @returns void
   */
  public openTodoEditModal(subItemForm: FormGroup): void {
    this.editingSubItemSnapshot = subItemForm.getRawValue();
    this.editingSubItemForm = subItemForm;
    this.isTodoEditModalVisible = true;
  }

  /**
   * Closes the todo edit modal.
   * @param shouldAutoSave Determines whether the changes should be automatically saved.
   * @returns void
   */
  // Called on cancel: reverts the sub-item form to its state before the modal was opened.
  // If the item was just created (empty title snapshot), removes it silently.
  public closeTodoEditModal(shouldRevert: boolean = true): void {
    this.isTodoEditModalVisible = false;

    const wasNewItem = !`${this.editingSubItemSnapshot?.['title'] ?? ''}`.trim();

    if (shouldRevert && this.editingSubItemForm && this.editingSubItemSnapshot) {
      if (wasNewItem) {
        this.removeTodoSubItem(this.editingSubItemForm);
        this.editingSubItemForm = undefined;
        this.editingSubItemSnapshot = null;
        return;
      }
      this.editingSubItemForm.reset(this.editingSubItemSnapshot);
    }

    this.editingSubItemForm = undefined;
    this.editingSubItemSnapshot = null;
  }

  /**
   * Saves the changes made in the todo edit modal and closes it.
   * If the form in the modal has been modified, it marks the main item form as dirty to indicate that there are unsaved changes.
   * @returns void
   */
  // Called on validate: keeps changes and lets the auto-save pipeline handle persistence.
  // If the title is empty, silently removes the sub-item instead of saving it.
  public saveTodoModal(): void {
    const title = `${this.editingSubItemForm?.get('title')?.value ?? ''}`.trim();

    if (!title) {
      const formToRemove = this.editingSubItemForm;
      this.editingSubItemForm = undefined;
      this.editingSubItemSnapshot = null;
      this.isTodoEditModalVisible = false;
      if (formToRemove) {
        this.removeTodoSubItem(formToRemove);
      }
      return;
    }

    if (this.editingSubItemForm?.dirty) {
      this.itemForm.markAsDirty();
    }
    this.closeTodoEditModal(false);
  }

  public onTodoStatusChange(subItemForm: FormGroup, isChecked: boolean): void {
    const subItemId = `${subItemForm.get('id')?.value ?? ''}`;
    const recurrenceType = `${subItemForm.get('recurrenceType')?.value ?? 'none'}`;

    if (!subItemId) {
      return;
    }

    subItemForm.get('isDone')?.setValue(isChecked, { emitEvent: false });

    let statusUpdate$: Observable<unknown>;

    if (isChecked) {
      statusUpdate$ = this.todoHistoryService.markTodoItemAsDone(subItemId);
    } else if (recurrenceType === 'daily') {
      statusUpdate$ = this.todoHistoryService.unDoneDaily(subItemId);
    } else if (recurrenceType === 'weekly') {
      statusUpdate$ = this.todoHistoryService.unDoneWeekly(subItemId);
    } else if (recurrenceType === 'monthly') {
      statusUpdate$ = this.todoHistoryService.unDoneMonthly(subItemId);
    } else {
      statusUpdate$ = this.todoHistoryService.unDoneTodoItem(subItemId);
    }

    statusUpdate$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.emitTodoProgress();
          this.syncTodoNotifications();
        },
        error: () => {
          subItemForm.get('isDone')?.setValue(!isChecked, { emitEvent: false });
          this.emitTodoProgress();
        },
      });

    this.emitTodoProgress();
  }

  public toggleFavorite(): void {
    const isFavoriteControl = this.itemForm.get('isFavorite');
    if (!isFavoriteControl) {
      return;
    }

    isFavoriteControl.setValue(!isFavoriteControl.value);
    isFavoriteControl.markAsDirty();
    this.itemForm.markAsDirty();
  }

  public toggleLock(): void {
    const isLockedControl = this.itemForm.get('isLocked');

    if (!isLockedControl || !this.item) {
      return;
    }

    const nextLockedState = !isLockedControl.value;
    isLockedControl.setValue(nextLockedState);
    isLockedControl.markAsDirty();
    this.itemForm.markAsDirty();

    if (nextLockedState) {
      this.itemLockService.lock(this.item.id);
      this.hasCurrentAccess = true;
    } else {
      this.itemLockService.unlock(this.item.id);
      this.hasCurrentAccess = true;
    }

    this.saveElement();
  }

  public closeUnlockModal(): void {
    this.isUnlockModalVisible = false;
    this.isUnlockSubmitting = false;
    this.unlockErrorMessage = null;

    if (this.item?.isLocked && !this.hasCurrentAccess) {
      this.router.navigate(['/']);
    }
  }

  public async unlockItem(password: string): Promise<void> {
    if (!this.item) {
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

    this.itemLockService.unlock(this.item.id);
    this.hasCurrentAccess = true;
    this.isUnlockModalVisible = false;
    this.isUnlockSubmitting = false;
    this.unlockErrorMessage = null;
  }

  public get todoSubItemsControls(): FormGroup[] {
    return getTodoSubItemFormGroups(this.itemForm);
  }

  public get shouldShowProtectedContent(): boolean {
    if (!this.item) {
      return false;
    }

    return !this.item.isLocked || this.hasCurrentAccess;
  }

  private emitTodoProgress(): void {
    if (this.item?.type !== 'todo') {
      return;
    }

    const controls = getTodoSubItemFormGroups(this.itemForm);
    const total = controls.length;
    const done = controls.filter(fg => !!fg.get('isDone')?.value).length;
    this.saveActionService.updateTodoProgress({ done, total });
  }

  private syncTodoNotifications(): void {
    if (!this.item?.id) {
      return;
    }

    this.itemsService.getItemById(this.item.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async (item) => {
          if (!item) {
            return;
          }

          this.item = item;
          await this.localNotificationService.syncTodoNotificationsForItem(item);
        },
        error: (error) => {
          console.error('Notification synchronization after todo status update failed:', error);
        },
      });
  }

  private removeTodoSubItem(subItemForm: FormGroup): void {
    const todoContentArray = getTodoContentFormArray(this.itemForm);
    const index = todoContentArray.controls.indexOf(subItemForm);

    if (index < 0) {
      return;
    }

    if (this.editingSubItemForm === subItemForm) {
      this.closeTodoEditModal(false);
    }

    todoContentArray.removeAt(index);
    this.itemForm.markAsDirty();
    this.emitTodoProgress();
  }

  private setupAutoSaveSubscriptions(): void {
    this.itemForm.valueChanges
      .pipe(debounceTime(1000), takeUntil(this.destroy$))
      .subscribe(() => this.saveElement());
  }

  private triggerSavedFeedback(): void {
    const titleInput = this.titleInputRef?.nativeElement;
    const contentTextarea = this.contentTextareaElement;

    titleInput?.classList.add('saved-feedback');
    contentTextarea?.classList.add('saved-feedback');

    if (this.savedFeedbackTimeoutId) {
      clearTimeout(this.savedFeedbackTimeoutId);
    }

    this.savedFeedbackTimeoutId = setTimeout(() => {
      titleInput?.classList.remove('saved-feedback');
      contentTextarea?.classList.remove('saved-feedback');
    }, 1200);
  }

}