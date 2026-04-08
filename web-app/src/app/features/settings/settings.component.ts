import { Component, OnDestroy, OnInit, inject } from "@angular/core";
import { FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { NgClass } from "@angular/common";
import { Subject, debounceTime, takeUntil } from "rxjs";
import { SettingsService } from "../../shared/services/settings.service";
import { AppSettings } from "../../shared/models/app-settings.model";
import { db } from "../../db.config";

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  imports: [ReactiveFormsModule, NgClass],
})
export class SettingsComponent implements OnInit, OnDestroy {

  private readonly fb = inject(FormBuilder);
  private readonly settingsService = inject(SettingsService);
  private readonly destroy$ = new Subject<void>();
  private savedFeedbackTimeoutId?: ReturnType<typeof setTimeout>;

  public settingsForm!: FormGroup;
  public savedFeedback = false;
  public historyRowsCount: number | null = null;
  public databaseSizeKb: number | null = null;

  public ngOnInit(): void {
    this.settingsService.get().subscribe(settings => {
      if (!settings) {
        return;
      }
      this.buildForm(settings);
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

  private buildForm(settings: AppSettings): void {
    this.settingsForm = this.fb.group({
      id: [settings.id],
      theme: [settings.theme],
      language: [settings.language],
      dailyAffirmationEnabled: [settings.dailyAffirmationEnabled],
      showArchivedItems: [settings.showArchivedItems],
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
}