import { Component, ElementRef, OnInit, ViewChild, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { Subject, takeUntil } from "rxjs";
import { AppDataService } from "../../shared/services/app-data.service";
import { AppItem, TodoInformation } from "../../shared/models/app-item.model";
import { ItemsService } from "../../shared/services/items.service";
import { SaveActionService } from "../../shared/services/save-action.service";
import { TodoEditModalComponent } from "./todo-edit-modal/todo-edit-modal.component";

@Component({
  standalone: true,
  selector: 'item-detail',
  templateUrl: './item-detail.component.html',
  styleUrls: ['./item-detail.component.scss'],
  imports: [FormsModule, TodoEditModalComponent]
})
export class ItemDetailComponent implements OnInit {

  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly appDataService: AppDataService = inject(AppDataService);
  private readonly itemsService = inject(ItemsService);
  private readonly saveActionService = inject(SaveActionService);

  private readonly destroy$ = new Subject<void>();
  private savedFeedbackTimeoutId?: ReturnType<typeof setTimeout>;

  private pendingTextareaFocus: boolean = false;
  private contentTextareaElement?: HTMLTextAreaElement;
  public editingSubItem?: TodoInformation;

  public isTodoEditModalVisible: boolean = false;

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

    this.appDataService
      .getActiveItemById(id)
      .subscribe(foundItem => {
        this.item = foundItem;
        this.pendingTextareaFocus = !!foundItem && !(foundItem.type === 'todo' && foundItem.todoContent?.length);
      });

    this.saveActionService.save$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.saveElement());
  }

  public saveElement(): void {
    if (!this.item) {
      return;
    }

    // --
    this.itemsService.updateItem(this.item).subscribe({
        next: () => this.triggerSavedFeedback(),
        error: () => console.log('Error updating item')
    });
  }

  public openTodoEditModal(subItem: TodoInformation): void {
    this.editingSubItem = subItem;
    this.isTodoEditModalVisible = true;
  }

  public closeTodoEditModal(): void {
    this.isTodoEditModalVisible = false;
    this.editingSubItem = undefined;
  }

  public saveTodoModal(): void {
    this.closeTodoEditModal();
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.savedFeedbackTimeoutId) {
      clearTimeout(this.savedFeedbackTimeoutId);
    }
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