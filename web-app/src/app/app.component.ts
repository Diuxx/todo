import { Component, OnInit, inject } from '@angular/core';
import { Location } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { TodoHeaderComponent } from './shared/components/header/todo-header.component';
import { TodoFooterComponent } from './shared/components/todo-footer/todo-footer.component';
import { NavigationService } from './shared/services/navigation.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TodoHeaderComponent, TodoFooterComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {

  // variables
  title = 'to-do';
  public canGoBack: boolean = false;

  private readonly router: Router = inject(Router);
  private readonly location: Location = inject(Location);
  private readonly navigationService: NavigationService = inject(NavigationService);

  ngOnInit(): void {
    console.log('init application.');

    this.updateCanGoBack();

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updateCanGoBack();
      });
  }

  public isHomePage(): boolean {
    return this.router.url === '/';
  }

  public goHome(): void {
    this.router.navigate(['/']);
  }

  public goBack(): void {
    if (!this.canGoBack) {
      return;
    }
    this.location.back();
  }

  private updateCanGoBack(): void {
    this.canGoBack = this.navigationService.getPreviousUrl() !== null;
  }
}