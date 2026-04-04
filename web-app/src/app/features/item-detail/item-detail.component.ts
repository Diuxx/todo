import { Component, ElementRef, OnInit, ViewChild, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { AppDataService } from "../../shared/services/app-data.service";
import { AppItem } from "../../shared/models/app-item.model";
import { ItemsService } from "../../shared/services/items.service";

@Component({
  standalone: true,
  selector: 'item-detail',
  templateUrl: './item-detail.component.html',
  styleUrls: ['./item-detail.component.scss'],
  imports: [FormsModule]
})
export class ItemDetailComponent implements OnInit {

  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly appDataService: AppDataService = inject(AppDataService);
  private readonly itemsService = inject(ItemsService);

  private pendingTextareaFocus: boolean = false;

  @ViewChild('contentTextarea')
  private set contentTextareaRef(textareaRef: ElementRef<HTMLTextAreaElement> | undefined) {
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
  }

  public saveElement(): void {
    if (!this.item) {
      return;
    }
    // this.itemsService.updateItem(this.item).subscribe();
  }

}