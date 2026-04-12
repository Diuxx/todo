import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { ItemDetailComponent } from '../item-detail/item-detail.component';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    component: DashboardComponent,
    title: 'Todo - Board',
  },
  {
    path: 'item/:id',
    component: ItemDetailComponent,
    title: 'Todo - Item details',
  },
  {
    path: 'settings',
    loadComponent: () => import('../settings/settings.component').then((m) => m.SettingsComponent),
    title: 'Todo - Settings',
  },
  {
    path: 'recap',
    loadComponent: () =>
      import('../history-recap/history-recap.component').then((m) => m.HistoryRecapComponent),
    title: 'Todo - Récap',
  },
];
