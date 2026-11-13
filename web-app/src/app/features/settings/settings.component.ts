import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { Subject, debounceTime, firstValueFrom, takeUntil } from 'rxjs';
import { SettingsService } from '../../shared/services/settings.service';
import { AppSettings } from '../../shared/models/app-settings.model';
import { ConfirmDialogService } from '../../shared/services/confirm-dialog.service';
import { DatabaseService } from '../../shared/services/database.service';
import { BackupService } from '../../shared/services/backup.service';
import { BackupFileService } from '../../shared/services/backup-file.service';
import { LocalNotificationService } from '../../shared/services/local-notification.service';
import { PasswordService } from '../../shared/services/password.service';
import {
  PasswordModalSubmitPayload,
  PasswordSettingsModalComponent,
} from '../../shared/components/password-settings-modal/password-settings-modal.component';
import { PasswordPromptModalComponent } from '../../shared/components/password-prompt-modal/password-prompt-modal.component';

type SensitiveAction = 'delete' | 'export' | 'import';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  imports: [
    ReactiveFormsModule,
    NgClass,
    PasswordSettingsModalComponent,
    PasswordPromptModalComponent,
  ],
})
export class SettingsComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly settingsService = inject(SettingsService);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly databaseService = inject(DatabaseService);
  private readonly backupService = inject(BackupService);
  private readonly backupFileService = inject(BackupFileService);
  private readonly localNotificationService = inject(LocalNotificationService);
  private readonly passwordService = inject(PasswordService);
  private readonly destroy$ = new Subject<void>();
  private savedFeedbackTimeoutId?: ReturnType<typeof setTimeout>;
  private pendingSensitiveAction: SensitiveAction | null = null;
  private pendingImportInput: HTMLInputElement | null = null;
  private importPasswordValidated = false;

  public settingsForm!: FormGroup;
  public savedFeedback = false;
  public isDeletingData = false;
  public isPasswordModalVisible = false;
  public isPasswordSaving = false;
  public hasCustomPassword = false;
  public passwordErrorMessage: string | null = null;
  public historyRowsCount: number | null = null;
  public databaseSizeKb: number | null = null;
  public isExportingData = false;
  public isImportingData = false;
  public isSensitivePasswordPromptVisible = false;
  public isSensitivePasswordSubmitting = false;
  public sensitivePasswordErrorMessage: string | null = null;

  public ngOnInit(): void {
    this.settingsService.get().subscribe((settings) => {
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
    const currentPasswordHash = this.settingsForm.get('passwordHash')?.value as string;

    this.passwordErrorMessage = null;
    this.isPasswordSaving = true;

    try {
      if (this.hasCustomPassword) {
        const isCurrentPasswordValid = await this.passwordService.verify(
          payload.currentPassword,
          currentPasswordHash
        );

        if (!isCurrentPasswordValid) {
          this.passwordErrorMessage = 'Le mot de passe actuel est incorrect.';
          return;
        }
      }

      const nextPasswordHash = await this.passwordService.hash(payload.nextPassword);
      await this.persistPasswordHash(nextPasswordHash);
    } finally {
      this.isPasswordSaving = false;
    }
  }

  public deleteAppData(): void {
    if (this.isDeletingData) {
      return;
    }

    this.openSensitivePasswordPrompt('delete');
  }

  public downloadAppData(): void {
    if (this.isExportingData) {
      return;
    }

    this.openSensitivePasswordPrompt('export');
  }

  public openImportPicker(fileInput: HTMLInputElement): void {
    if (this.isImportingData) {
      return;
    }

    if (this.importPasswordValidated) {
      fileInput.value = '';
      fileInput.click();
      return;
    }

    this.pendingImportInput = fileInput;
    this.openSensitivePasswordPrompt('import');
  }

  public cancelImportSelection(): void {
    this.importPasswordValidated = false;
    this.pendingImportInput = null;
  }

  public async importAppData(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || this.isImportingData) {
      return;
    }

    this.importPasswordValidated = false;
    await this.performImportAppData(file, input);
  }

  public closeSensitivePasswordPrompt(): void {
    if (this.isSensitivePasswordSubmitting) {
      return;
    }

    this.isSensitivePasswordPromptVisible = false;
    this.sensitivePasswordErrorMessage = null;
    this.pendingSensitiveAction = null;

    if (this.pendingImportInput) {
      this.pendingImportInput.value = '';
    }

    this.pendingImportInput = null;
    this.importPasswordValidated = false;
  }

  public async confirmSensitivePassword(password: string): Promise<void> {
    if (!this.pendingSensitiveAction || !this.settingsForm) {
      return;
    }

    const currentPasswordHash = this.settingsForm.get('passwordHash')?.value as string;

    this.sensitivePasswordErrorMessage = null;
    this.isSensitivePasswordSubmitting = true;

    try {
      const isPasswordValid = await this.passwordService.verify(password, currentPasswordHash);

      if (!isPasswordValid) {
        this.sensitivePasswordErrorMessage = 'Mot de passe incorrect.';
        return;
      }

      if (this.passwordService.isLegacyPasswordHash(currentPasswordHash)) {
        await this.upgradeVerifiedPassword(password);
      }

      const action = this.pendingSensitiveAction;
      const importInput = this.pendingImportInput;

      this.isSensitivePasswordPromptVisible = false;
      this.pendingSensitiveAction = null;
      this.pendingImportInput = null;
      this.sensitivePasswordErrorMessage = null;

      if (action === 'delete') {
        await this.performDeleteAppData();
        return;
      }

      if (action === 'export') {
        await this.performDownloadAppData();
        return;
      }

      if (action === 'import' && importInput) {
        this.importPasswordValidated = true;
        importInput.value = '';
        importInput.click();
      }
    } finally {
      this.isSensitivePasswordSubmitting = false;
    }
  }

  public get sensitivePasswordPromptTitle(): string {
    if (this.pendingSensitiveAction === 'delete') {
      return 'Confirmation requise';
    }

    if (this.pendingSensitiveAction === 'export') {
      return 'Téléchargement protégé';
    }

    if (this.pendingSensitiveAction === 'import') {
      return 'Import protégé';
    }

    return 'Mot de passe requis';
  }

  public get sensitivePasswordPromptMessage(): string {
    if (this.pendingSensitiveAction === 'delete') {
      return 'Entre le mot de passe avant de supprimer les données locales.';
    }

    if (this.pendingSensitiveAction === 'export') {
      return 'Entre le mot de passe avant de télécharger la sauvegarde JSON.';
    }

    if (this.pendingSensitiveAction === 'import') {
      return 'Entre le mot de passe avant d’importer et d’écraser les données actuelles.';
    }

    return 'Entre le mot de passe pour continuer.';
  }

  public get sensitivePasswordPromptConfirmText(): string {
    if (this.pendingSensitiveAction === 'delete') {
      return 'Confirmer';
    }

    if (this.pendingSensitiveAction === 'export') {
      return 'Télécharger';
    }

    if (this.pendingSensitiveAction === 'import') {
      return 'Continuer';
    }

    return 'Continuer';
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

  private openSensitivePasswordPrompt(action: SensitiveAction): void {
    const passwordHash = this.settingsForm?.get('passwordHash')?.value as string | undefined;
    if (!passwordHash || passwordHash === this.passwordService.legacyDefaultPasswordHash) {
      this.openPasswordModal();
      this.passwordErrorMessage = 'Définissez un mot de passe personnel avant cette action.';
      this.pendingImportInput = null;
      return;
    }

    this.pendingSensitiveAction = action;
    this.sensitivePasswordErrorMessage = null;
    this.isSensitivePasswordPromptVisible = true;
  }

  private async performDeleteAppData(): Promise<void> {
    const confirmed = await firstValueFrom(
      this.confirmDialogService.confirm({
        title: 'Supprimer les donnees ?',
        message:
          'Cette action va supprimer tous les todos, les notes, les citations, leur historique local et les notifications associees. Cette action est irreversible.',
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
        variant: 'danger',
      })
    );

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
  }

  private async performDownloadAppData(): Promise<void> {
    this.isExportingData = true;

    try {
      await this.backupFileService.download(await this.backupService.getCurrentData());
    } finally {
      this.isExportingData = false;
    }
  }

  private async performImportAppData(file: File, input: HTMLInputElement): Promise<void> {
    const confirmed = await firstValueFrom(
      this.confirmDialogService.confirm({
        title: 'Importer et ecraser les donnees ?',
        message:
          'Cette action remplacera toutes les donnees locales actuelles (todos, historique, metadonnees et options) par le contenu du fichier JSON selectionne.',
        confirmText: 'Importer',
        cancelText: 'Annuler',
        variant: 'danger',
      })
    );

    if (!confirmed) {
      input.value = '';
      return;
    }

    this.isImportingData = true;

    try {
      const migratedPayload = await this.backupService.restoreFromFile(file);

      this.settingsForm.patchValue(
        {
          id: migratedPayload.settings.id,
          theme: migratedPayload.settings.theme,
          language: migratedPayload.settings.language,
          dailyAffirmationEnabled: migratedPayload.settings.dailyAffirmationEnabled,
          showArchivedItems: migratedPayload.settings.showArchivedItems,
          passwordHash: migratedPayload.settings.passwordHash,
          userName: migratedPayload.settings.userName,
          userId: migratedPayload.settings.userId,
        },
        { emitEvent: false }
      );

      this.settingsForm.markAsPristine();
      this.updatePasswordState(migratedPayload.settings.passwordHash);
      await this.loadStorageStats();
      await this.localNotificationService.clearAllTodoNotifications();
      await this.localNotificationService.syncScheduledTodoNotifications();
      this.triggerSavedFeedback();
    } catch (error) {
      console.error('[Settings] Import failed:', error);
      alert(error instanceof Error ? error.message : "Impossible d'importer ce fichier JSON.");
    } finally {
      input.value = '';
      this.isImportingData = false;
    }
  }

  private async loadStorageStats(): Promise<void> {
    const stats = await this.backupService.getStorageStats();
    this.historyRowsCount = stats.historyRowsCount;
    this.databaseSizeKb = stats.databaseSizeKb;
  }

  private async upgradeVerifiedPassword(password: string): Promise<void> {
    const currentSettings = await firstValueFrom(this.settingsService.get());
    if (!currentSettings) {
      throw new Error('Unable to load settings to upgrade the password.');
    }

    const passwordHash = await this.passwordService.hash(password);
    await firstValueFrom(this.settingsService.update({ ...currentSettings, passwordHash }));
    this.settingsForm.patchValue({ passwordHash }, { emitEvent: false });
    this.updatePasswordState(passwordHash);
  }

  private async persistPasswordHash(passwordHash: string): Promise<void> {
    this.settingsForm.get('passwordHash')?.setValue(passwordHash);
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
