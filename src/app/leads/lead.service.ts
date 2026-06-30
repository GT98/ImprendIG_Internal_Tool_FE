import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Lead, LeadStatusOption } from './lead.model';
import { environment } from '../../environments/environment';

const API_URL = environment.apiUrl;

export interface PatchLeadDto {
  statusOptionId?: number | null;
  notes?: string | null;
  sellerId?: number | null;
  callStartDate?: string | null;
}

export interface LeadEventDto {
  id: number;
  type: string;
  payload: string | null;
  note: string | null;
  createdAt: string;
  createdBy: { id: number; name: string | null; lastName: string | null } | null;
}

export interface SellerBasicDto {
  id: number;
  name: string | null;
  lastName: string | null;
}

@Injectable({ providedIn: 'root' })
export class LeadsService {
  private readonly http = inject(HttpClient);

  getAll() {
    return this.http.get<Lead[]>(`${API_URL}/leads`);
  }

  getByDate(date: string) {
    return this.http.get<Lead[]>(`${API_URL}/leads`, { params: { date } });
  }

  getStatusOptions() {
    return this.http.get<LeadStatusOption[]>(`${API_URL}/lead-status-options`);
  }

  patch(id: string, dto: PatchLeadDto) {
    return this.http.patch<Lead>(`${API_URL}/leads/${id}`, dto);
  }

  getSellers() {
    return this.http.get<SellerBasicDto[]>(`${API_URL}/sellers`);
  }

  getEvents(leadId: string) {
    return this.http.get<LeadEventDto[]>(`${API_URL}/leads/${leadId}/events`);
  }

  createEvent(leadId: string, dto: { type: string; payload?: string; note?: string; createdBySellerId?: number }) {
    return this.http.post<LeadEventDto>(`${API_URL}/leads/${leadId}/events`, dto);
  }
}
