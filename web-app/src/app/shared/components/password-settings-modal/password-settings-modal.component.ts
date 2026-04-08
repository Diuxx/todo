import { CommonModule } from "@angular/common";
import { Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { FormsModule } from "@angular/forms";

export interface PasswordModalSubmitPayload {
  currentPassword: string;
  nextPassword: string;
}

export interface PasswordModalResetPayload {
  currentPassword: string;
}

@Component({
  standalone: true,
  selector: "app-password-settings-modal",
  templateUrl: "./password-settings-modal.component.html",
  styleUrls: ["./password-settings-modal.component.scss"],
  imports: [CommonModule, FormsModule],
})
export class PasswordSettingsModalComponent implements OnChanges {
  @Input() visible = false;
  @Input() hasCustomPassword = false;
  @Input() requiresCurrentPassword = false;
  @Input() isSaving = false;
  @Input() errorMessage: string | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() submitPassword = new EventEmitter<PasswordModalSubmitPayload>();
  @Output() resetPassword = new EventEmitter<PasswordModalResetPayload>();

  public currentPassword = "";
  public nextPassword = "";
  public confirmPassword = "";
  public localErrorMessage: string | null = null;

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes["visible"]?.currentValue) {
      this.resetFields();
    }
  }

  @HostListener("document:keydown.escape")
  public onEscapeKey(): void {
    if (!this.visible || this.isSaving) {
      return;
    }

    this.closeModal();
  }

  public closeModal(): void {
    if (this.isSaving) {
      return;
    }

    this.close.emit();
  }

  public savePassword(): void {
    this.localErrorMessage = null;

    if (this.requiresCurrentPassword && !this.currentPassword.trim()) {
      this.localErrorMessage = "Le mot de passe actuel est requis.";
      return;
    }

    if (!this.nextPassword.trim()) {
      this.localErrorMessage = "Le nouveau mot de passe est requis.";
      return;
    }

    if (this.nextPassword !== this.confirmPassword) {
      this.localErrorMessage = "La confirmation ne correspond pas au nouveau mot de passe.";
      return;
    }

    this.submitPassword.emit({
      currentPassword: this.currentPassword,
      nextPassword: this.nextPassword,
    });
  }

  public restoreDefaultPassword(): void {
    this.localErrorMessage = null;

    if (this.requiresCurrentPassword && !this.currentPassword.trim()) {
      this.localErrorMessage = "Le mot de passe actuel est requis.";
      return;
    }

    this.resetPassword.emit({
      currentPassword: this.currentPassword,
    });
  }

  private resetFields(): void {
    this.currentPassword = "";
    this.nextPassword = "";
    this.confirmPassword = "";
    this.localErrorMessage = null;
  }
}