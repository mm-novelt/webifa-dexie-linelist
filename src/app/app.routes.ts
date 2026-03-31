import { Routes } from '@angular/router';
import { dbExistsGuard } from './guards/db-exists.guard';
import { GettingStartedComponent } from './feature/getting-started/getting-started.component';
import { LinelistComponent } from './feature/linelist/linelist.component';

export const routes: Routes = [
  {
    path: 'getting-started',
    component: GettingStartedComponent,
  },
  {
    path: 'linelist/:table',
    canActivate: [dbExistsGuard],
    component: LinelistComponent,
  },
  {
    path: '',
    redirectTo: 'linelist/cases',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'linelist/cases',
  },
];
