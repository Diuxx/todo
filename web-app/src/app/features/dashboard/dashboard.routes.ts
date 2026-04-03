import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { DashboardItemDetailComponent } from '../item-detail/dashboard-item-detail.component';

export const DASHBOARD_ROUTES: Routes = [
  { 
    path: '',
    component: DashboardComponent,
    title: 'Dashboard'
  },
  {
    path: ':id',
    component: DashboardItemDetailComponent,
    title: 'Item details'
  }
];