import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  standalone: true,
  selector: 'app-password-prompt-modal',
  templateUrl: './password-prompt-modal.component.html',
  styleUrls: ['./password-prompt-modal.component.scss'],
  imports: [CommonModule, FormsModule],
})
export class PasswordPromptModalComponent {
  @Input() visible = false;
  @Input() title = 'Mot de passe requis';
  @Input() message = 'Entre le mot de passe pour continuer.';
  @Input() confirmText = 'Déverrouiller';
  @Input() errorMessage: string | null = null;
  @Input() isSubmitting = false;

  @Output() close = new EventEmitter<void>();
  @Output() submitPassword = new EventEmitter<string>();

  public password = '';

  @HostListener('document:keydown.escape')
  public onEscapeKey(): void {
    if (!this.visible || this.isSubmitting) {
      return;
    }

    this.closeModal();
  }

  public closeModal(): void {
    if (this.isSubmitting) {
      return;
    }

    this.password = '';
    this.close.emit();
  }

  public submit(): void {
    if (this.isSubmitting || !this.password.trim()) {
      return;
    }

    this.submitPassword.emit(this.password);
  }
}
