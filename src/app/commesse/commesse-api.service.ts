import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const API_URL = environment.apiUrl;

export interface CommessaDto {
  id: number;
  title: string;
  description: string | null;
  type: 'fixed' | 'percentage';
  fixedAmount: number | null;
  percentageRate: number | null;
  baseAmount: number | null;
  computedAmount: number;
  isActive: boolean;
  createdAt: string;
}

export interface CreateCommessaPayload {
  title: string;
  description?: string;
  type: 'fixed' | 'percentage';
  fixedAmount?: number;
  percentageRate?: number;
  baseAmount?: number;
}

export interface UpdateCommessaPayload extends Partial<CreateCommessaPayload> {
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class CommesseApiService {
  private readonly http = inject(HttpClient);

  findAll(includeInactive = false): Observable<CommessaDto[]> {
    const url = includeInactive ? `${API_URL}/commesse?all=true` : `${API_URL}/commesse`;
    return this.http.get<CommessaDto[]>(url);
  }

  create(dto: CreateCommessaPayload): Observable<CommessaDto> {
    return this.http.post<CommessaDto>(`${API_URL}/commesse`, dto);
  }

  update(id: number, dto: UpdateCommessaPayload): Observable<CommessaDto> {
    return this.http.patch<CommessaDto>(`${API_URL}/commesse/${id}`, dto);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/commesse/${id}`);
  }
}
