import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NEVER, of } from 'rxjs';
import { AppComponent } from './app.component';
import { DatabaseService } from './shared/services/database.service';
import { LocalNotificationService } from './shared/services/local-notification.service';
import { SettingsService } from './shared/services/settings.service';

describe('AppComponent startup', () => {
  let component: AppComponent;
  let databaseService: jasmine.SpyObj<DatabaseService>;
  let notificationService: jasmine.SpyObj<LocalNotificationService>;

  beforeEach(() => {
    databaseService = jasmine.createSpyObj<DatabaseService>('DatabaseService', ['init']);
    notificationService = jasmine.createSpyObj<LocalNotificationService>('LocalNotificationService', [
      'init',
      'syncScheduledTodoNotifications',
    ]);
    notificationService.init.and.resolveTo();
    notificationService.syncScheduledTodoNotifications.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { events: NEVER } },
        { provide: Location, useValue: {} },
        { provide: DatabaseService, useValue: databaseService },
        { provide: SettingsService, useValue: { settings$: of(null), get: () => of(undefined) } },
        { provide: LocalNotificationService, useValue: notificationService },
      ],
    });

    component = TestBed.runInInjectionContext(() => new AppComponent());
  });

  it('does not show application content when IndexedDB initialization fails', async () => {
    databaseService.init.and.rejectWith(new Error('IndexedDB unavailable'));
    spyOn(console, 'error');

    await component.ngOnInit();

    expect(component.isAppReady).toBeFalse();
    expect(component.startupError).toContain('données locales');
    expect(notificationService.init).not.toHaveBeenCalled();
    component.ngOnDestroy();
  });

  it('still opens the app if only native notifications fail', async () => {
    databaseService.init.and.resolveTo();
    notificationService.init.and.rejectWith(new Error('Native APIs unavailable'));
    spyOn(console, 'warn');

    await component.ngOnInit();

    expect(component.isAppReady).toBeTrue();
    expect(component.startupError).toBeNull();
    component.ngOnDestroy();
  });
});
