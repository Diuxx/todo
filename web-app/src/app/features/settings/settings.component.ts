import { Component, OnDestroy, OnInit, inject } from "@angular/core";
import { FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { NgClass } from "@angular/common";
import { Subject, debounceTime, firstValueFrom, takeUntil } from "rxjs";
import { SettingsService } from "../../shared/services/settings.service";
import { AppSettings } from "../../shared/models/app-settings.model";
import { db } from "../../db.config";
import { AppData } from "../../shared/models/app-data.model";
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
  public isExportingData = false;
  public isImportingData = false;

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

  public async downloadAppData(): Promise<void> {
    if (this.isExportingData) {
      return;
    }

    this.isExportingData = true;

    try {
      const payload = await this.getCurrentAppData();

      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const downloadUrl = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const link = document.createElement('a');

      link.href = downloadUrl;
      link.download = `todo-backup-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } finally {
      this.isExportingData = false;
    }
  }

  public openImportPicker(fileInput: HTMLInputElement): void {
    if (this.isImportingData) {
      return;
    }

    fileInput.click();
  }

  public async importAppData(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || this.isImportingData) {
      return;
    }

    const confirmed = await firstValueFrom(this.confirmDialogService.confirm({
      title: 'Importer et ecraser les donnees ?',
      message: 'Cette action remplacera toutes les donnees locales actuelles (todos, historique, metadonnees et options) par le contenu du fichier JSON selectionne.',
      confirmText: 'Importer',
      cancelText: 'Annuler',
      variant: 'danger',
    }));

    if (!confirmed) {
      input.value = '';
      return;
    }

    this.isImportingData = true;

    try {
      const content = await file.text();
      const parsed = JSON.parse(content) as AppData;

      if (!this.isValidAppData(parsed)) {
        throw new Error('Le fichier JSON ne correspond pas au format attendu.');
      }

      await this.localNotificationService.clearAllTodoNotifications();

      await db.transaction('rw', [db.items, db.todoHistory, db.citationsMeta, db.imagesMeta, db.settings], async () => {
        await db.items.clear();
        await db.todoHistory.clear();
        await db.citationsMeta.clear();
        await db.imagesMeta.clear();
        await db.settings.clear();

        if (parsed.items.length) {
          await db.items.bulkAdd(parsed.items);
        }

        if (parsed.todoHistory.length) {
          await db.todoHistory.bulkAdd(parsed.todoHistory);
        }

        if (parsed.citationsMeta.length) {
          await db.citationsMeta.bulkAdd(parsed.citationsMeta);
        }

        if (parsed.imagesMeta.length) {
          await db.imagesMeta.bulkAdd(parsed.imagesMeta);
        }

        await db.settings.add(parsed.settings);
      });

      this.settingsForm.patchValue({
        id: parsed.settings.id,
        theme: parsed.settings.theme,
        language: parsed.settings.language,
        dailyAffirmationEnabled: parsed.settings.dailyAffirmationEnabled,
        showArchivedItems: parsed.settings.showArchivedItems,
        passwordHash: parsed.settings.passwordHash,
        userName: parsed.settings.userName,
        userId: parsed.settings.userId,
      }, { emitEvent: false });

      this.settingsForm.markAsPristine();
      this.updatePasswordState(parsed.settings.passwordHash);
      await this.loadStorageStats();
      await this.localNotificationService.syncScheduledTodoNotifications();
      this.triggerSavedFeedback();
    } catch (error) {
      console.error('[Settings] Import failed:', error);
      alert("Impossible d'importer ce fichier JSON.");
    } finally {
      input.value = '';
      this.isImportingData = false;
    }
  }

  private isValidAppData(payload: AppData): payload is AppData {
    return !!payload
      && Array.isArray(payload.items)
      && Array.isArray(payload.todoHistory)
      && Array.isArray(payload.citationsMeta)
      && Array.isArray(payload.imagesMeta)
      && !!payload.settings
      && typeof payload.settings === 'object'
      && typeof payload.settings.id === 'string';
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

    const payload = await this.getCurrentAppData();
    const serialized = JSON.stringify(payload);
    const byteSize = new Blob([serialized]).size;
    this.databaseSizeKb = Math.round(byteSize / 1024);
  }

  private async getCurrentAppData(): Promise<AppData> {
    const [items, todoHistory, citationsMeta, imagesMeta, settingsList] = await Promise.all([
      db.items.toArray(),
      db.todoHistory.toArray(),
      db.citationsMeta.toArray(),
      db.imagesMeta.toArray(),
      db.settings.toArray(),
    ]);

    return {
      id: 'app-data',
      items,
      todoHistory,
      citationsMeta,
      imagesMeta,
      settings: settingsList[0],
    };
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