import { Component, ElementRef, OnInit, ViewChild, inject } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { Subject, takeUntil } from "rxjs";
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
  private savedFeedbackTimeoutId?: ReturnType<typeof setTimeout>;

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
        this.pendingTextareaFocus = !!foundItem && !(foundItem.type === 'todo' && foundItem.todoContent?.length);
      });

    this.saveActionService.save$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.saveElement());
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.savedFeedbackTimeoutId) {
      clearTimeout(this.savedFeedbackTimeoutId);
    }
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
    if (!this.item) {
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

    this.openTodoEditModal(subItemForm);
  }

  /**
   * Deletes a sub-item from the todo content.
   * If the deleted sub-item is currently being edited, it also closes the edit modal.
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
      this.closeTodoEditModal();
    }

    todoContentArray.removeAt(index);
    this.itemForm.markAsDirty();
  }

  public openTodoEditModal(subItemForm: FormGroup): void {
    this.editingSubItemForm = subItemForm;
    this.isTodoEditModalVisible = true;
  }

  public closeTodoEditModal(): void {
    this.isTodoEditModalVisible = false;
    this.editingSubItemForm = undefined;
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