import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const API_URL = environment.apiUrl;

export interface CommissionDto {
  id: number;
  amount: string | null;
  percentage: number | null;
  createdAt: string;
  sale: {
    id: number;
    createdAt: string;
    pricePlan: { name: string | null; totalAmount: string | null } | null;
    customer: { name: string | null; surname: string | null } | null;
  } | null;
  seller: { id: number; name: string | null; lastName: string | null } | null;
  installment: {
    id: number;
    installmentNumber: number;
    totalInstallment: number;
    amount: string | null;
    status: string;
    type: string;
    paymentDate: string | null;
    dueDate: string | null;
  } | null;
}

@Injectable({ providedIn: 'root' })
export class CommissionApiService {
  private readonly http = inject(HttpClient);

  getAll(month?: string): Observable<CommissionDto[]> {
    const params: Record<string, string> = {};
    if (month) params['month'] = month;
    return this.http.get<CommissionDto[]>(`${API_URL}/commissions`, { params });
  }
}
