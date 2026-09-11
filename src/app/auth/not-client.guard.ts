import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const notClientGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const role = auth.currentUser()?.role;
  if (role === 'client') return router.createUrlTree(['/area-cliente']);
  if (role === 'referrer') return router.createUrlTree(['/area-referral']);
  return true;
};
