import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const API_URL = environment.apiUrl;

export interface SetterDto {
  id: number;
  name: string | null;
  lastName: string | null;
  email: string | null;
  percentage: number | null;
  telegramId: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class SetterApiService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<SetterDto[]> {
    return this.http.get<SetterDto[]>(`${API_URL}/setters`);
  }

  create(dto: Partial<Omit<SetterDto, 'id' | 'createdAt'>>): Observable<SetterDto> {
    return this.http.post<SetterDto>(`${API_URL}/setters`, dto);
  }

  update(id: number, dto: Partial<Omit<SetterDto, 'id' | 'createdAt'>>): Observable<SetterDto> {
    return this.http.patch<SetterDto>(`${API_URL}/setters/${id}`, dto);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/setters/${id}`);
  }
}
