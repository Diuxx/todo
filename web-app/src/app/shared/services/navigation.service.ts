import { Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private history: string[] = [];

  constructor(private router: Router) {
    console.log('NavigationService initialized');
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.history.push(event.urlAfterRedirects);
      });
  }

  public getHistory() {
    return this.history;
  }

  public getPreviousUrl(): string | null {
    return this.history.length > 1 ? this.history[this.history.length - 2] : null;
  }
}
