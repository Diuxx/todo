import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { ItemDetailComponent } from '../item-detail/item-detail.component';

export const DASHBOARD_ROUTES: Routes = [
  { 
    path: '',
    component: DashboardComponent,
    title: 'Dashboard'
  },
  {
    path: 'item/:id',
    component: ItemDetailComponent,
    title: 'Item details'
  },
  {
    path: 'settings',
    loadComponent: () => import('../settings/settings.component').then(m => m.SettingsComponent),
    title: 'Settings'
  }
];