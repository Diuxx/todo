import { Component, Input } from "@angular/core";

@Component({
  standalone: true,
  selector: "app-dashboard-skeleton",
  templateUrl: "./dashboard-skeleton.component.html",
  styleUrls: ["./dashboard-skeleton.component.scss"],
})
export class DashboardSkeletonComponent {
  @Input() count: number = 6;

  public get placeholders(): number[] {
    return Array.from({ length: this.count }, (_, index) => index);
  }
}
