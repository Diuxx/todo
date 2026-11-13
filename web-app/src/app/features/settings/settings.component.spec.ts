import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { Subject } from 'rxjs';
import { AppSettings } from '../../shared/models/app-settings.model';
import { BackupFileService } from '../../shared/services/backup-file.service';
import { BackupService } from '../../shared/services/backup.service';
import { ConfirmDialogService } from '../../shared/services/confirm-dialog.service';
import { DatabaseService } from '../../shared/services/database.service';
import { LocalNotificationService } from '../../shared/services/local-notification.service';
import { PasswordService } from '../../shared/services/password.service';
import { SettingsService } from '../../shared/services/settings.service';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent autosave', () => {
  let component: SettingsComponent;
  let settingsService: jasmine.SpyObj<SettingsService>;
  let updates: Array<Subject<AppSettings>>;

  const initialSettings: AppSettings = {
    id: 'app-settings',
    theme: 'system',
    language: 'fr',
    dailyAffirmationEnabled: false,
    showArchivedItems: false,
    passwordHash: '',
    userName: 'Original',
    userId: 'test-user',
    backupState: { status: 'idle' },
    version: 5,
  };

  beforeEach(() => {
    updates = [];
    settingsService = jasmine.createSpyObj<SettingsService>('SettingsService', ['update']);
    settingsService.update.and.callFake(() => {
      const update = new Subject<AppSettings>();
      updates.push(update);
      return update.asObservable();
    });

    TestBed.configureTestingModule({
      providers: [
        FormBuilder,
        { provide: SettingsService, useValue: settingsService },
        { provide: BackupService, useValue: {} },
        { provide: BackupFileService, useValue: {} },
        { provide: ConfirmDialogService, useValue: {} },
        { provide: DatabaseService, useValue: {} },
        { provide: LocalNotificationService, useValue: {} },
        { provide: PasswordService, useValue: {} },
      ],
    });

    component = TestBed.runInInjectionContext(() => new SettingsComponent());
    const formBuilder = TestBed.inject(FormBuilder);
    component.settingsForm = formBuilder.group({
      id: [initialSettings.id],
      theme: [initialSettings.theme],
      language: [initialSettings.language],
      dailyAffirmationEnabled: [initialSettings.dailyAffirmationEnabled],
      showArchivedItems: [initialSettings.showArchivedItems],
      passwordHash: [initialSettings.passwordHash],
      userName: [initialSettings.userName],
      userId: [initialSettings.userId],
      backupState: [initialSettings.backupState],
      version: [initialSettings.version],
    });
  });

  it('persists a newer edit after an earlier settings write completes', async () => {
    component.settingsForm.get('userName')?.setValue('First');
    component.settingsForm.markAsDirty();
    component.saveSettings();

    expect(settingsService.update).toHaveBeenCalledTimes(1);

    component.settingsForm.get('userName')?.setValue('Second');
    component.settingsForm.markAsDirty();
    component.saveSettings();

    expect(settingsService.update).toHaveBeenCalledTimes(1);

    updates[0].next({ ...initialSettings, userName: 'First' });
    updates[0].complete();
    await Promise.resolve();

    expect(settingsService.update).toHaveBeenCalledTimes(2);
    expect(component.settingsForm.dirty).toBeTrue();

    updates[1].next({ ...initialSettings, userName: 'Second' });
    updates[1].complete();
    await Promise.resolve();

    expect(component.settingsForm.pristine).toBeTrue();
    expect(component.saveState).toBe('saved');
  });

  it('blocks route deactivation if persistence fails, then permits retry', async () => {
    component.settingsForm.get('userName')?.setValue('Important');
    component.settingsForm.markAsDirty();
    spyOn(console, 'error');

    const firstExit = component.canDeactivate();
    updates[0].error(new Error('IndexedDB unavailable'));

    expect(await firstExit).toBeFalse();
    expect(component.saveState).toBe('error');
    expect(component.settingsForm.dirty).toBeTrue();

    const secondExit = component.canDeactivate();
    updates[1].next({ ...initialSettings, userName: 'Important' });
    updates[1].complete();

    expect(await secondExit).toBeTrue();
    expect(component.settingsForm.pristine).toBeTrue();
  });

  it('keeps version and backup metadata when saving preferences', async () => {
    component.settingsForm.get('userName')?.setValue('Updated');
    component.settingsForm.markAsDirty();

    const save = component.canDeactivate();

    expect(settingsService.update).toHaveBeenCalledWith(
      jasmine.objectContaining({
        version: 5,
        backupState: { status: 'idle' },
        userName: 'Updated',
      })
    );

    updates[0].next({ ...initialSettings, userName: 'Updated' });
    updates[0].complete();
    expect(await save).toBeTrue();
  });

  it('does not navigate away while an authenticated dialog is active', async () => {
    component.isSensitivePasswordPromptVisible = true;
    expect(await component.canDeactivate()).toBeFalse();
  });
});
