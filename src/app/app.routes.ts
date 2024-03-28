import { Routes } from '@angular/router';
import {LinelistComponent} from "./feature/linelist/linelist.component";
import { Linelist2Component } from "./feature/linelist2/linelist2.component";

export const routes: Routes = [
  { path: '',   redirectTo: '/linelist', pathMatch: 'full' },
  { path: 'linelist', component: LinelistComponent },
  { path: 'linelist2', component: Linelist2Component },
];
