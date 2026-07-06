import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const API_URL = environment.apiUrl;

export interface SellerDto {
  id: number;
  name: string | null;
  lastName: string | null;
  email: string | null;
  percentage: number | null;
  telegramId: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class SellerApiService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<SellerDto[]> {
    return this.http.get<SellerDto[]>(`${API_URL}/sellers`);
  }

  create(dto: Partial<Omit<SellerDto, 'id' | 'createdAt'>>): Observable<SellerDto> {
    return this.http.post<SellerDto>(`${API_URL}/sellers`, dto);
  }

  update(id: number, dto: Partial<Omit<SellerDto, 'id' | 'createdAt'>>): Observable<SellerDto> {
    return this.http.patch<SellerDto>(`${API_URL}/sellers/${id}`, dto);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/sellers/${id}`);
  }
}
