import { AsyncPipe, NgClass } from "@angular/common";
import { Component, HostListener, inject } from "@angular/core";
import { ConfirmDialogService } from "../../services/confirm-dialog.service";

@Component({
  standalone: true,
  selector: "app-confirm-dialog",
  templateUrl: "./confirm-dialog.component.html",
  styleUrls: ["./confirm-dialog.component.scss"],
  imports: [AsyncPipe, NgClass],
})
export class ConfirmDialogComponent {

  private readonly confirmDialogService = inject(ConfirmDialogService);

  public readonly dialogState$ = this.confirmDialogService.dialogState$;

  @HostListener("document:keydown.escape")
  public onEscapeKey(): void {
    this.confirmDialogService.resolve(false);
  }

  public cancel(): void {
    this.confirmDialogService.resolve(false);
  }

  public confirm(): void {
    this.confirmDialogService.resolve(true);
  }
}
