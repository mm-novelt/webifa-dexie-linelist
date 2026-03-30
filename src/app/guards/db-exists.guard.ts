import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const dbExistsGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const databases = await indexedDB.databases();
  const exists = databases.some((db) => db.name === 'webifa');
  if (!exists) {
    return router.createUrlTree(['/getting-started']);
  }
  return true;
};
