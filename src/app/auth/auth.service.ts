import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import type { AuthUser, LoginResponse } from './auth.models';
import { environment } from '../../environments/environment';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const API_URL = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private readonly _user = signal<AuthUser | null>(
    JSON.parse(localStorage.getItem(USER_KEY) ?? 'null'),
  );

  readonly token = computed(() => this._token());
  readonly currentUser = computed(() => this._user());
  readonly isAuthenticated = computed(() => this._token() !== null);

  login(email: string, password: string) {
    return this.http
      .post<LoginResponse>(`${API_URL}/auth/login`, { email, password })
      .pipe(
        tap(res => {
          localStorage.setItem(TOKEN_KEY, res.access_token);
          localStorage.setItem(USER_KEY, JSON.stringify(res.user));
          this._token.set(res.access_token);
          this._user.set(res.user);
        }),
      );
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._token.set(null);
    this._user.set(null);
    this.router.navigate(['/login']);
  }
}
