import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Client che vedono la pagina Vendite (solo il loro percorso): 3 = UGC Level Up */
export const SALES_PAGE_CLIENT_IDS = [3];

export const salesGuard: CanActivateFn = () => {
  const user = inject(AuthService).currentUser();
  if (user?.role !== 'client') return true;
  if (user.clientId != null && SALES_PAGE_CLIENT_IDS.includes(Number(user.clientId))) return true;
  return inject(Router).createUrlTree(['/area-cliente']);
};
