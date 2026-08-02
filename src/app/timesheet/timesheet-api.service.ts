import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const API_URL = environment.apiUrl;

export type TimesheetStatus = 'draft' | 'ready' | 'approved' | 'revision';

export interface TimesheetItemDto {
  id: number;
  description: string;
  type: 'fixed' | 'percentage';
  fixedAmount: number | null;
  percentageRate: number | null;
  baseAmount: number | null;
  computedAmount: number;
  notes: string | null;
  commessa: { id: number; title: string } | null;
}

export interface TimesheetDto {
  id: number;
  month: string;
  status: TimesheetStatus;
  adminNotes: string | null;
  submittedAt: string | null;
  items: TimesheetItemDto[];
}

export interface AdminTimesheetSummary {
  id: number;
  month: string;
  status: TimesheetStatus;
  adminNotes: string | null;
  submittedAt: string | null;
  seller: { id: number; name: string; lastName: string; email: string } | null;
  items: TimesheetItemDto[];
}

@Injectable({ providedIn: 'root' })
export class TimesheetApiService {
  private readonly http = inject(HttpClient);

  getMy(month: string): Observable<TimesheetDto> {
    return this.http.get<TimesheetDto>(`${API_URL}/timesheets/my`, { params: { month } });
  }

  addItem(month: string, commessaId: number, baseAmount?: number, notes?: string): Observable<TimesheetItemDto> {
    const body: Record<string, unknown> = { commessaId };
    if (baseAmount !== undefined) body['baseAmount'] = baseAmount;
    if (notes) body['notes'] = notes;
    return this.http.post<TimesheetItemDto>(`${API_URL}/timesheets/my/items`, body, { params: { month } });
  }

  removeItem(month: string, itemId: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/timesheets/my/items/${itemId}`, { params: { month } });
  }

  updateStatus(id: number, status: TimesheetStatus, adminNotes?: string): Observable<TimesheetDto> {
    const body: Record<string, unknown> = { status };
    if (adminNotes !== undefined) body['adminNotes'] = adminNotes;
    return this.http.patch<TimesheetDto>(`${API_URL}/timesheets/${id}/status`, body);
  }

  listAll(month: string): Observable<AdminTimesheetSummary[]> {
    return this.http.get<AdminTimesheetSummary[]>(`${API_URL}/timesheets`, { params: { month } });
  }
}
