import { Routes } from '@angular/router';
import { QuestCreateFormComponent } from './quest-create-form.component';

export const QUEST_CREATE_ROUTES: Routes = [
  { 
    path: '',
    component: QuestCreateFormComponent,
    title: 'Create Quest'
  },
  { path: ':id', component: QuestCreateFormComponent, title: 'Edit Quest' }
];