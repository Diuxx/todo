import { Component, inject, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { NgClass } from "@angular/common";
import { AppData } from "../../shared/models/app-data.model";
import { AppItem } from "../../shared/models/app-item.model";
import { ItemsService } from "../../shared/services/items.service";

@Component({
  standalone: true,
  selector: 'life-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  imports: [NgClass]
})
export class DashboardComponent implements OnInit {

  // -- variables --
  private readonly itemsService = inject(ItemsService);
  private readonly router: Router = inject(Router);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);

  public data: AppData | null = null;
  public filter: string | null = null;

  public items: AppItem[] = [];
  public selectedItemId: string | null = null;

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
    const done = item.todoContent?.filter(subItem => subItem.config?.status === 'done').length || 0;
    return `${done} / ${total}`;
  }

  /**
   * Displays the details of the selected item.
   * @param item The item to display details for.
   */
  public displayItemDetails(item: AppItem): void {
    this.selectedItemId = item.id;
    setTimeout(() => this.router.navigate([`item/${item.id}`]), 220);
  }

  /**
   * Fetches the application data and updates the component state.
   * @returns void
   */
  private getData(filter: string | null = null): void {
    console.log('Fetching active items with filter:', filter);
    this.itemsService
      .getAllActive(filter)
      .subscribe(items => {
        this.items = items;
        console.log('Active items fetched successfully:', items);
      });
  }
}