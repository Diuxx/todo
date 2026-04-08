import { Component, OnDestroy, OnInit, inject } from "@angular/core";
import { FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { NgClass } from "@angular/common";
import { Subject, debounceTime, firstValueFrom, takeUntil } from "rxjs";
import { SettingsService } from "../../shared/services/settings.service";
import { AppSettings } from "../../shared/models/app-settings.model";
import { db } from "../../db.config";
import { ConfirmDialogService } from "../../shared/services/confirm-dialog.service";
import { DatabaseService } from "../../shared/services/database.service";
import { LocalNotificationService } from "../../shared/services/local-notification.service";
import { PasswordService } from "../../shared/services/password.service";
import {
  PasswordModalResetPayload,
  PasswordModalSubmitPayload,
  PasswordSettingsModalComponent,
} from "../../shared/components/password-settings-modal/password-settings-modal.component";

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  imports: [ReactiveFormsModule, NgClass, PasswordSettingsModalComponent],
})
export class SettingsComponent implements OnInit, OnDestroy {

  private readonly fb = inject(FormBuilder);
  private readonly settingsService = inject(SettingsService);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly databaseService = inject(DatabaseService);
  private readonly localNotificationService = inject(LocalNotificationService);
  private readonly passwordService = inject(PasswordService);
  private readonly destroy$ = new Subject<void>();
  private savedFeedbackTimeoutId?: ReturnType<typeof setTimeout>;

  public settingsForm!: FormGroup;
  public savedFeedback = false;
  public isDeletingData = false;
  public isPasswordModalVisible = false;
  public isPasswordSaving = false;
  public hasCustomPassword = false;
  public passwordErrorMessage: string | null = null;
  public historyRowsCount: number | null = null;
  public databaseSizeKb: number | null = null;

  public ngOnInit(): void {
    this.settingsService.get().subscribe(settings => {
      if (!settings) {
        return;
      }

      this.buildForm(settings);
      this.updatePasswordState(settings.passwordHash);
      this.setupAutoSave();
    });

    this.loadStorageStats();
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.savedFeedbackTimeoutId) {
      clearTimeout(this.savedFeedbackTimeoutId);
    }
  }

  public setTheme(theme: 'light' | 'dark' | 'system'): void {
    this.settingsForm.get('theme')?.setValue(theme);
    this.settingsForm.markAsDirty();
  }

  public setLanguage(lang: 'fr' | 'en'): void {
    this.settingsForm.get('language')?.setValue(lang);
    this.settingsForm.markAsDirty();
  }

  public openPasswordModal(): void {
    this.passwordErrorMessage = null;
    this.isPasswordModalVisible = true;
  }

  public closePasswordModal(): void {
    this.passwordErrorMessage = null;
    this.isPasswordModalVisible = false;
  }

  public async savePassword(payload: PasswordModalSubmitPayload): Promise<void> {
    const currentPasswordHash = this.settingsForm.get("passwordHash")?.value as string;

    this.passwordErrorMessage = null;
    this.isPasswordSaving = true;

    try {
      if (this.hasCustomPassword) {
        const isCurrentPasswordValid = await this.passwordService.verify(payload.currentPassword, currentPasswordHash);

        if (!isCurrentPasswordValid) {
          this.passwordErrorMessage = "Le mot de passe actuel est incorrect.";
          return;
        }
      }

      const nextPasswordHash = await this.passwordService.hash(payload.nextPassword);
      await this.persistPasswordHash(nextPasswordHash);
    } finally {
      this.isPasswordSaving = false;
    }
  }

  public async resetPasswordToDefault(payload: PasswordModalResetPayload): Promise<void> {
    const currentPasswordHash = this.settingsForm.get("passwordHash")?.value as string;

    this.passwordErrorMessage = null;
    this.isPasswordSaving = true;

    try {
      if (this.hasCustomPassword) {
        const isCurrentPasswordValid = await this.passwordService.verify(payload.currentPassword, currentPasswordHash);

        if (!isCurrentPasswordValid) {
          this.passwordErrorMessage = "Le mot de passe actuel est incorrect.";
          return;
        }
      }

      await this.persistPasswordHash(this.passwordService.defaultPasswordHash);
    } finally {
      this.isPasswordSaving = false;
    }
  }

  public deleteAppData(): void {
    if (this.isDeletingData) {
      return;
    }

    this.confirmDialogService.confirm({
      title: 'Supprimer les donnees ?',
      message: 'Cette action va supprimer tous les todos, les notes, les citations, leur historique local et les notifications associees. Cette action est irreversible.',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      variant: 'danger',
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(async (confirmed) => {
        if (!confirmed) {
          return;
        }

        this.isDeletingData = true;

        try {
          await this.localNotificationService.clearAllTodoNotifications();
          await this.databaseService.clearUserContent();
          await this.loadStorageStats();
          this.triggerSavedFeedback();
        } finally {
          this.isDeletingData = false;
        }
      });
  }

  private buildForm(settings: AppSettings): void {
    this.settingsForm = this.fb.group({
      id: [settings.id],
      theme: [settings.theme],
      language: [settings.language],
      dailyAffirmationEnabled: [settings.dailyAffirmationEnabled],
      showArchivedItems: [settings.showArchivedItems],
      passwordHash: [settings.passwordHash],
      userName: [settings.userName],
      userId: [settings.userId],
    });
  }

  private setupAutoSave(): void {
    this.settingsForm.valueChanges
      .pipe(debounceTime(800), takeUntil(this.destroy$))
      .subscribe(() => this.saveSettings());
  }

  private saveSettings(): void {
    if (!this.settingsForm.dirty) {
      return;
    }
    const settings: AppSettings = this.settingsForm.getRawValue();
    this.settingsService.update(settings).subscribe(() => {
      this.settingsForm.markAsPristine();
      this.triggerSavedFeedback();
    });
  }

  private triggerSavedFeedback(): void {
    this.savedFeedback = true;
    if (this.savedFeedbackTimeoutId) {
      clearTimeout(this.savedFeedbackTimeoutId);
    }
    this.savedFeedbackTimeoutId = setTimeout(() => {
      this.savedFeedback = false;
    }, 2000);
  }

  private async loadStorageStats(): Promise<void> {
    this.historyRowsCount = await db.todoHistory.count();

    if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
      this.databaseSizeKb = null;
      return;
    }

    const estimate = await navigator.storage.estimate();
    this.databaseSizeKb = estimate.usage ? Math.round(estimate.usage / 1024) : 0;
  }

  private async persistPasswordHash(passwordHash: string): Promise<void> {
    this.settingsForm.get("passwordHash")?.setValue(passwordHash);
    this.settingsForm.markAsDirty();

    const settings: AppSettings = this.settingsForm.getRawValue();
    await firstValueFrom(this.settingsService.update(settings));

    this.settingsForm.markAsPristine();
    this.updatePasswordState(passwordHash);
    this.closePasswordModal();
    this.triggerSavedFeedback();
  }

  private updatePasswordState(passwordHash: string): void {
    this.hasCustomPassword = this.passwordService.isCustomPasswordHash(passwordHash);
  }
}