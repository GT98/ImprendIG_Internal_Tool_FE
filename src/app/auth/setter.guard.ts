import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const setterGuard: CanActivateFn = () => {
  const user = inject(AuthService).currentUser();
  const router = inject(Router);
  if (user?.role === 'admin' || user?.setterId != null) return true;
  return router.createUrlTree(['/chiamate']);
};
