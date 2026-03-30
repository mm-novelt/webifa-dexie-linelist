import { Routes } from '@angular/router';
import { dbExistsGuard } from './guards/db-exists.guard';
import { GettingStartedComponent } from './feature/getting-started/getting-started.component';

export const routes: Routes = [
  {
    path: 'getting-started',
    component: GettingStartedComponent,
  },
  {
    path: '**',
    canActivate: [dbExistsGuard],
    children: [],
  },
];
