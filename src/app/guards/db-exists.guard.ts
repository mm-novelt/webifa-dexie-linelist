import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DbService } from '../services/db.service';

export const dbExistsGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const dbService = inject(DbService);
  const databases = await indexedDB.databases();
  const exists = databases.some((db) => db.name === 'webifa');
  if (!exists) {
    return router.createUrlTree(['/getting-started']);
  }
  await dbService.openExisting();
  return true;
};
