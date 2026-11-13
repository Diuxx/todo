import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { ItemDetailComponent } from '../item-detail/item-detail.component';
import { protectPendingChanges } from '../../shared/guards/pending-changes.guard';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    component: DashboardComponent,
    title: 'Todo - Board',
  },
  {
    path: 'item/:id',
    component: ItemDetailComponent,
    canDeactivate: [protectPendingChanges],
    title: 'Todo - Item details',
  },
  {
    path: 'settings',
    loadComponent: () => import('../settings/settings.component').then((m) => m.SettingsComponent),
    canDeactivate: [protectPendingChanges],
    title: 'Todo - Settings',
  },
  {
    path: 'recap',
    loadComponent: () =>
      import('../history-recap/history-recap.component').then((m) => m.HistoryRecapComponent),
    title: 'Todo - Récap',
  },
  {
    path: 'calendar',
    loadComponent: () => import('../calendar/calendar.component').then((m) => m.CalendarComponent),
    title: 'Todo - Calendrier',
  },
  {
    path: 'budget',
    loadComponent: () => import('../budget/budget.component').then((m) => m.BudgetComponent),
    title: 'Todo - Budget',
  },
  {
    path: 'budget-stats',
    loadComponent: () => import('../budget/budget-stats/budget-stats.component').then((m) => m.BudgetStatsComponent),
    title: 'Todo - Budget Stats',
  },
  {
    path: 'budget-settings',
    loadComponent: () =>
      import('../budget/budget-settings/budget-settings.component').then((m) => m.BudgetSettingsComponent),
    title: 'Todo - Budget Settings',
  },
];
