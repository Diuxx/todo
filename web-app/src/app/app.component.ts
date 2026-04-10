import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { TodoHeaderComponent } from './shared/components/todo-header/todo-header.component';
import { TodoFooterComponent } from './shared/components/todo-footer/todo-footer.component';
import { DatabaseService } from './shared/services/database.service';
import { ConfirmDialogComponent } from './shared/components/confirm-dialog/confirm-dialog.component';
import { SettingsService } from './shared/services/settings.service';
import { LocalNotificationService } from './shared/services/local-notification.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TodoHeaderComponent, TodoFooterComponent, ConfirmDialogComponent, AsyncPipe],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {

  // services
  private readonly router: Router = inject(Router);
  private readonly databaseService = inject(DatabaseService);
  private readonly settingsService = inject(SettingsService);
  private readonly notificationService = inject(LocalNotificationService);

  // service observables
  public readonly settings$ = this.settingsService.settings$;

  // variables
  title = 'to-do';
  public canGoBack: boolean = false;
  public isAppReady: boolean = false;

  async ngOnInit(): Promise<void> {
    console.log('init application.');

    try {
      await this.databaseService.init();
      this.settingsService.get().subscribe(); // Load settings into the reactive stream only after the DB is ready.

      try {
        await this.notificationService.init((action) => {
          const route = action.notification.extra?.route;
          if (typeof route === 'string' && route.length > 0) {
            this.router.navigateByUrl(route);
          }
        });

        await this.notificationService.syncScheduledTodoNotifications();
      } catch (error) {
        console.warn('Local notifications are unavailable:', error);
      }
    } finally {
      this.isAppReady = true;
    }
  }

  public isHomePage(): boolean {
    return this.router.url === '/';
  }

  public goHome(): void {
    this.router.navigate(['/']);
  }
}