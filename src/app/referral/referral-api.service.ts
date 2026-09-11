import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

export interface ReferralDto {
  id: number;
  token: string;
  referrer: {
    id: number;
    customer: { name: string | null; surname: string | null; email: string | null } | null;
  };
  lead: { id: number; name: string | null; surname: string | null; email: string | null; phone: string | null } | null;
  referredName: string | null;
  referredEmail: string | null;
  referredPhone: string | null;
  sale: { id: number } | null;
  status: 'pending' | 'converted' | 'paid';
  rewardAmount: string;
  notes: string | null;
  createdAt: string;
  convertedAt: string | null;
  paidAt: string | null;
}

export interface ReferralSummaryDto {
  totalPending: number;
  totalConverted: number;
  totalPaid: number;
  pendingAmount: number;
  paidAmount: number;
}

export interface MyReferralStatsDto {
  total: number;
  converted: number;
  paid: number;
  pendingAmount: number;
  paidAmount: number;
}

export interface ReferralPublicDto {
  referrerName: string | null;
  isValid: boolean;
}

export interface CreateReferralAccountDto {
  customerId: number;
  password: string;
}

export interface CreateReferralAccountResponse {
  email: string;
  shareLink: string;
}

export interface ReferrerDto {
  id: number;
  email: string;
  isActive: boolean;
  referralToken: string | null;
  customer: { id: number; name: string | null; surname: string | null; email: string | null } | null;
}

@Injectable({ providedIn: 'root' })
export class ReferralApiService {
  private readonly http = inject(HttpClient);

  // Admin
  createAccount(dto: CreateReferralAccountDto): Observable<CreateReferralAccountResponse> {
    return this.http.post<CreateReferralAccountResponse>(`${API}/referral/accounts`, dto);
  }

  getAll(): Observable<ReferralDto[]> {
    return this.http.get<ReferralDto[]>(`${API}/referral`);
  }

  getSummary(): Observable<ReferralSummaryDto> {
    return this.http.get<ReferralSummaryDto>(`${API}/referral/summary`);
  }

  update(id: number, dto: { saleId?: number | null; notes?: string }): Observable<ReferralDto> {
    return this.http.patch<ReferralDto>(`${API}/referral/${id}`, dto);
  }

  markPaid(id: number): Observable<ReferralDto> {
    return this.http.patch<ReferralDto>(`${API}/referral/${id}/mark-paid`, {});
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/referral/${id}`);
  }

  // Referrer
  getMy(): Observable<ReferralDto[]> {
    return this.http.get<ReferralDto[]>(`${API}/referral/my`);
  }

  getMyStats(): Observable<MyReferralStatsDto> {
    return this.http.get<MyReferralStatsDto>(`${API}/referral/my/summary`);
  }

  getReferrers(): Observable<ReferrerDto[]> {
    return this.http.get<ReferrerDto[]>(`${API}/referral/referrers`);
  }

  // Public
  getPublicInfo(token: string): Observable<ReferralPublicDto> {
    return this.http.get<ReferralPublicDto>(`${API}/referral/public/${token}`);
  }

  submitReferral(data: { referralToken: string; referredName?: string; referredEmail?: string; referredPhone?: string }): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${API}/referral/submit`, data);
  }
}
