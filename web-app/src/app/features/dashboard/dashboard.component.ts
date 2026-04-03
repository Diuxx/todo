import { Component, inject, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { NgClass } from "@angular/common";
import { AppDataService } from "../../shared/services/app-data.service";
import { AppData } from "../../shared/models/app-data.model";
import { AppItem } from "../../shared/models/app-item.model";

@Component({
  standalone: true,
  selector: 'life-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  imports: [NgClass]
})
export class DashboardComponent implements OnInit {

  private readonly appDataService: AppDataService = inject(AppDataService);
  private readonly router: Router = inject(Router);

  public data: AppData | null = null;

  public items: AppItem[] = [];
  public selectedItemId: string | null = null;

  // functions -----------
  public ngOnInit(): void {
    this.getData();
  }

  public displayItemDetails(item: AppItem): void {
    this.selectedItemId = item.id;

    setTimeout(() => {
      this.router.navigate([item.id]);
    }, 220);
  }

  public navigateToConfiguration(): void {
    // this.router.navigate(['/configuration']);
    // setTimeout(() => this.isClicked = false, 300);
  }

  /**
   * Fetches the application data and updates the component state.
   * @returns void
   */
  private getData(): void {
    this.appDataService
      .getAllActiveItems()
      .subscribe(items => {
        this.items = items;
        console.log('Active items fetched successfully:', items);
      });

    // this.appDataService
    //   .getAll()
    //   .subscribe(data => {
    //     this.data = data;
    //     console.log('Data fetched successfully:', data);
    //   });
  }
}