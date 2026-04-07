import { Component, Input } from "@angular/core";

@Component({
  standalone: true,
  selector: "app-item-detail-skeleton",
  templateUrl: "./item-detail-skeleton.component.html",
  styleUrls: ["./item-detail-skeleton.component.scss"],
})
export class ItemDetailSkeletonComponent {
  @Input() todoRows: number = 4;

  public get placeholders(): number[] {
    return Array.from({ length: this.todoRows }, (_, index) => index);
  }
}
