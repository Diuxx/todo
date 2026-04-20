import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Subject, debounceTime, firstValueFrom, takeUntil } from 'rxjs';
import { SettingsService } from '../../shared/services/settings.service';
import { AppSettings } from '../../shared/models/app-settings.model';
import { db } from '../../db.config';
import { AppData } from '../../shared/models/app-data.model';
import {
  createDefaultBudget,
  IncomeItem,
  Period,
  resolveExpenseIncomeId,
} from '../../shared/models/budget/budget.model';
import { ConfirmDialogService } from '../../shared/services/confirm-dialog.service';
import { DatabaseService } from '../../shared/services/database.service';
import { LocalNotificationService } from '../../shared/services/local-notification.service';
import { PasswordService } from '../../shared/services/password.service';
import {
  PasswordModalResetPayload,
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

  public async resetPasswordToDefault(payload: PasswordModalResetPayload): Promise<void> {
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

      await this.persistPasswordHash(this.passwordService.defaultPasswordHash);
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

  private isValidAppData(payload: AppData): payload is AppData {
    return (
      !!payload &&
      Array.isArray(payload.items) &&
      Array.isArray(payload.todoHistory) &&
      Array.isArray(payload.citationsMeta) &&
      Array.isArray(payload.imagesMeta) &&
      !!payload.settings &&
      typeof payload.settings === 'object' &&
      typeof payload.settings.id === 'string'
    );
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
      const payload = await this.getCurrentAppData();
      const json = JSON.stringify(payload, null, 2);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `todo-backup-${timestamp}.json`;

      if (Capacitor.isNativePlatform()) {
        await this.downloadAppDataOnDevice(fileName, json);
      } else {
        this.downloadAppDataInBrowser(fileName, json);
      }
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
      const content = await file.text();
      const parsed = JSON.parse(content) as AppData;

      if (!this.isValidAppData(parsed)) {
        throw new Error('Le fichier JSON ne correspond pas au format attendu.');
      }

      const migratedPayload = this.withBudgetMigration(parsed);

      await this.localNotificationService.clearAllTodoNotifications();

      await db.transaction(
        'rw',
        [db.items, db.todoHistory, db.citationsMeta, db.imagesMeta, db.budgets, db.settings],
        async () => {
          await db.items.clear();
          await db.todoHistory.clear();
          await db.citationsMeta.clear();
          await db.imagesMeta.clear();
          await db.budgets.clear();
          await db.settings.clear();

          if (migratedPayload.items.length) {
            await db.items.bulkAdd(migratedPayload.items);
          }

          if (migratedPayload.todoHistory.length) {
            await db.todoHistory.bulkAdd(migratedPayload.todoHistory);
          }

          if (migratedPayload.citationsMeta.length) {
            await db.citationsMeta.bulkAdd(migratedPayload.citationsMeta);
          }

          if (migratedPayload.imagesMeta.length) {
            await db.imagesMeta.bulkAdd(migratedPayload.imagesMeta);
          }

          await db.budgets.add({
            id: 'main',
            ...migratedPayload.budget,
          });

          await db.settings.add(migratedPayload.settings);
        }
      );

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

  private async loadStorageStats(): Promise<void> {
    this.historyRowsCount = await db.todoHistory.count();

    const payload = await this.getCurrentAppData();
    const serialized = JSON.stringify(payload);
    const byteSize = new Blob([serialized]).size;
    this.databaseSizeKb = Math.round(byteSize / 1024);
  }

  private async getCurrentAppData(): Promise<AppData> {
    const [items, todoHistory, citationsMeta, imagesMeta, budgets, settingsList] = await Promise.all([
      db.items.toArray(),
      db.todoHistory.toArray(),
      db.citationsMeta.toArray(),
      db.imagesMeta.toArray(),
      db.budgets.toArray(),
      db.settings.toArray(),
    ]);

    const budgetDocument = budgets[0];
    const budget = budgetDocument
      ? {
          periods: budgetDocument.periods,
          accounts: budgetDocument.accounts,
          expenseCategories: budgetDocument.expenseCategories,
          incomeTypes: budgetDocument.incomeTypes,
        }
      : createDefaultBudget();

    return {
      id: 'app-data',
      items,
      todoHistory,
      citationsMeta,
      imagesMeta,
      budget,
      settings: settingsList[0],
    };
  }

  private withBudgetMigration(payload: AppData): AppData {
    const budgetCandidate = (payload as { budget?: unknown }).budget;

    if (!this.isBudgetLike(budgetCandidate)) {
      return {
        ...payload,
        budget: createDefaultBudget(),
      };
    }

    return {
      ...payload,
      budget: {
        periods: Array.isArray(budgetCandidate.periods)
          ? budgetCandidate.periods.map((period) => {
              const candidatePeriod = period as Partial<Period> & {
                expenses?: Array<{ accountId: string; incomeId?: string }>;
              };
              const candidateIncomes = Array.isArray(candidatePeriod.incomes)
                ? (candidatePeriod.incomes as IncomeItem[])
                : [];

              return {
                ...candidatePeriod,
                date: typeof candidatePeriod.date === 'string' ? candidatePeriod.date : '',
                incomes: candidateIncomes,
                expenses: Array.isArray(candidatePeriod.expenses)
                  ? candidatePeriod.expenses.map((expense) => ({
                      ...expense,
                      incomeId: resolveExpenseIncomeId(expense, candidateIncomes),
                    }))
                  : [],
              };
            })
          : [],
        accounts: Array.isArray(budgetCandidate.accounts)
          ? budgetCandidate.accounts
          : createDefaultBudget().accounts,
        expenseCategories: Array.isArray(budgetCandidate.expenseCategories)
          ? budgetCandidate.expenseCategories
          : createDefaultBudget().expenseCategories,
        incomeTypes: Array.isArray(budgetCandidate.incomeTypes)
          ? budgetCandidate.incomeTypes
          : createDefaultBudget().incomeTypes,
      },
    };
  }

  private isBudgetLike(value: unknown): value is {
    periods: unknown;
    accounts: unknown;
    expenseCategories: unknown;
    incomeTypes?: unknown;
  } {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as {
      periods?: unknown;
      accounts?: unknown;
      expenseCategories?: unknown;
      incomeTypes?: unknown;
    };

    return (
      Array.isArray(candidate.periods) &&
      Array.isArray(candidate.accounts) &&
      Array.isArray(candidate.expenseCategories)
    );
  }

  private downloadAppDataInBrowser(fileName: string, json: string): void {
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  }

  private async downloadAppDataOnDevice(fileName: string, json: string): Promise<void> {
    const permissions = await Filesystem.checkPermissions();

    if (permissions.publicStorage !== 'granted') {
      const requested = await Filesystem.requestPermissions();

      if (requested.publicStorage !== 'granted') {
        throw new Error('Storage permission denied');
      }
    }

    const result = await Filesystem.writeFile({
      path: fileName,
      data: json,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    });

    await Share.share({
      title: 'Sauvegarde JSON',
      text: `Fichier exporte: ${fileName}`,
      url: result.uri,
      dialogTitle: 'Enregistrer ou partager la sauvegarde',
    });
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
