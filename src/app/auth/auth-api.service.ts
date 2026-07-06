import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const API_URL = environment.apiUrl;

export interface UserDto {
  id: number;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  seller: { id: number; name: string | null; lastName: string | null } | null;
}

export interface RegisterDto {
  email: string;
  password: string;
  role: string;
  sellerId?: number;
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);

  getUsers(): Observable<UserDto[]> {
    return this.http.get<UserDto[]>(`${API_URL}/users`);
  }

  register(dto: RegisterDto): Observable<UserDto> {
    return this.http.post<UserDto>(`${API_URL}/auth/register`, dto);
  }

  deactivate(userId: number): Observable<UserDto> {
    return this.http.patch<UserDto>(`${API_URL}/users/${userId}/deactivate`, {});
  }
}
