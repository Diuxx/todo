import { Component, OnInit, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { AppDataService } from "../../shared/services/app-data.service";
import { AppItem } from "../../shared/models/app-item.model";
import { ItemsService } from "../../shared/services/items.service";

@Component({
  standalone: true,
  selector: 'life-dashboard-item-detail',
  templateUrl: './dashboard-item-detail.component.html',
  styleUrls: ['./dashboard-item-detail.component.scss'],
  imports: []
})
export class DashboardItemDetailComponent implements OnInit {

  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly appDataService: AppDataService = inject(AppDataService);
  private readonly itemsService = inject(ItemsService);

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
      });
  }
}
