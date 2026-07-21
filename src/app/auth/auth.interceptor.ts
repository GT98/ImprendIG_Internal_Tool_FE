import { inject } from '@angular/core';
import { type HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { catchError, switchMap, throwError, Observable, share } from 'rxjs';
import { AuthService } from './auth.service';
import type { LoginResponse } from './auth.models';

// Shared refresh observable — deduplica le chiamate concorrenti
let refreshInFlight$: Observable<LoginResponse> | null = null;

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const auth = inject(AuthService);
  const token = auth.token();

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError(err => {
      // Ignora gli errori non-401 o le chiamate a /auth/* (evita loop)
      if (err.status !== 401 || req.url.includes('/auth/')) {
        return throwError(() => err);
      }

      if (!refreshInFlight$) {
        refreshInFlight$ = auth.refresh().pipe(
          share(),
        );
        // Pulisce il riferimento al termine (successo o errore)
        refreshInFlight$.subscribe({
          complete: () => { refreshInFlight$ = null; },
          error: () => { refreshInFlight$ = null; },
        });
      }

      return refreshInFlight$.pipe(
        switchMap(() => {
          const newToken = auth.token();
          const retryReq = newToken
            ? req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })
            : req;
          return next(retryReq);
        }),
        catchError(refreshErr => {
          auth.logout();
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
