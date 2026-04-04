import { Component, ElementRef, OnInit, ViewChild, inject } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { Subject, debounceTime, takeUntil } from "rxjs";
import { AppItem } from "../../shared/models/app-item.model";
import { ItemsService } from "../../shared/services/items.service";
import { SaveActionService } from "../../shared/services/save-action.service";
import { TodoEditModalComponent } from "./todo-edit-modal/todo-edit-modal.component";
import { createItemForm, getTodoContentFormArray, getTodoSubItemFormGroups, mapItemFormToAppItem } from "../../shared/models/app-item-form.model";
import { NgClass } from "@angular/common";
import { generateUUID } from "../../shared/utils";

@Component({
  standalone: true,
  selector: 'item-detail',
  templateUrl: './item-detail.component.html',
  styleUrls: ['./item-detail.component.scss'],
  imports: [ReactiveFormsModule, TodoEditModalComponent, NgClass], 
})
export class ItemDetailComponent implements OnInit {

  // services
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly itemsService = inject(ItemsService);
  private readonly saveActionService = inject(SaveActionService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);

  private readonly destroy$ = new Subject<void>();
  private readonly formSubscriptionsDestroy$ = new Subject<void>();
  private savedFeedbackTimeoutId?: ReturnType<typeof setTimeout>;
  private todoStatusAutoSaveTimeoutId?: ReturnType<typeof setTimeout>;
  private lastTitleInputAt: number = 0;

  private pendingTextareaFocus: boolean = false;
  private contentTextareaElement?: HTMLTextAreaElement;
  
  public isTodoEditModalVisible: boolean = false;
  public itemForm: FormGroup = createItemForm(this.formBuilder);
  public editingSubItemForm?: FormGroup;

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
    this.itemsService
      .getItemById(id)
      .subscribe(foundItem => {
        this.item = foundItem;
        this.itemForm = createItemForm(this.formBuilder, foundItem);
        this.setupAutoSaveSubscriptions();
        this.emitTodoProgress();
        this.pendingTextareaFocus = !!foundItem && !(foundItem.type === 'todo' && foundItem.todoContent?.length);
      });

    this.saveActionService.save$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.saveElement());
  }

  public ngOnDestroy(): void {
    this.formSubscriptionsDestroy$.next();
    this.formSubscriptionsDestroy$.complete();

    this.destroy$.next();
    this.destroy$.complete();

    if (this.savedFeedbackTimeoutId) {
      clearTimeout(this.savedFeedbackTimeoutId);
    }

    if (this.todoStatusAutoSaveTimeoutId) {
      clearTimeout(this.todoStatusAutoSaveTimeoutId);
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
    this.itemsService.deleteItem(this.item!.id).subscribe({
      next: () => {
        this.router.navigate(['/']);
      },
      error: () => console.log('Error deleting item')
    })
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
      status: ['pending'],
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

  /**
   * Opens the todo edit modal for a given sub-item form.
   * @param subItemForm The form group of the sub-item to edit.
   * @returns void
   */
  public openTodoEditModal(subItemForm: FormGroup): void {
    this.editingSubItemForm = subItemForm;
    this.isTodoEditModalVisible = true;
  }

  /**
   * Closes the todo edit modal.
   * @param shouldAutoSave Determines whether the changes should be automatically saved.
   * @returns void
   */
  public closeTodoEditModal(shouldAutoSave: boolean = true): void {
    this.isTodoEditModalVisible = false;

    if (this.editingSubItemForm?.dirty) {
      this.itemForm.markAsDirty();
    }

    this.editingSubItemForm = undefined;

    if (shouldAutoSave) {
      this.saveElement();
    }
  }

  public saveTodoModal(): void {
    console.log('Saving todo modal with form value:', this.editingSubItemForm?.value);
    if (this.editingSubItemForm?.dirty) {
      this.itemForm.markAsDirty();
    }
    this.closeTodoEditModal();
  }

  public onTodoStatusChange(subItemForm: FormGroup, isChecked: boolean): void {
    subItemForm.get('status')?.setValue(isChecked ? 'done' : 'pending');
    subItemForm.markAsDirty();
    this.itemForm.markAsDirty();
    this.emitTodoProgress();
    this.scheduleAutoSaveAfterTitleIdle();
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

  public get todoSubItemsControls(): FormGroup[] {
    return getTodoSubItemFormGroups(this.itemForm);
  }

  private emitTodoProgress(): void {
    if (this.item?.type !== 'todo') {
      return;
    }

    const controls = getTodoSubItemFormGroups(this.itemForm);
    const total = controls.length;
    const done = controls.filter(fg => fg.get('status')?.value === 'done').length;
    this.saveActionService.updateTodoProgress({ done, total });
  }

  /**
   * Sets up subscriptions to form control value changes to enable auto-saving after a debounce time.
   * Also tracks the last time the title was modified to ensure that auto-saving only occurs after the user has stopped typing for a certain period.
   * @returns void
   */
  private setupAutoSaveSubscriptions(): void {
    this.formSubscriptionsDestroy$.next();

    const titleControl = this.itemForm.get('title');
    const contentControl = this.itemForm.get('content');

    titleControl?.valueChanges
      .pipe(takeUntil(this.formSubscriptionsDestroy$), takeUntil(this.destroy$))
      .subscribe(() => {
        this.lastTitleInputAt = Date.now();
      });

    titleControl?.valueChanges
      .pipe(debounceTime(1000), takeUntil(this.formSubscriptionsDestroy$), takeUntil(this.destroy$))
      .subscribe(() => this.saveElement());

    contentControl?.valueChanges
      .pipe(debounceTime(1000), takeUntil(this.formSubscriptionsDestroy$), takeUntil(this.destroy$))
      .subscribe(() => this.saveElement());
  }

  private scheduleAutoSaveAfterTitleIdle(): void {
    if (this.todoStatusAutoSaveTimeoutId) {
      clearTimeout(this.todoStatusAutoSaveTimeoutId);
    }

    this.todoStatusAutoSaveTimeoutId = setTimeout(() => {
      const isTitleIdle = Date.now() - this.lastTitleInputAt >= 1000;

      if (!isTitleIdle) {
        this.scheduleAutoSaveAfterTitleIdle();
        return;
      }

      this.saveElement();
    }, 1000);
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