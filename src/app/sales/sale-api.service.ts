import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const API_URL = environment.apiUrl;

export interface InstallmentDto {
  id: number;
  installmentNumber: number;
  totalInstallment: number;
  amount: string | null;
  status: 'draft' | 'paid' | 'failed';
  type: 'balance' | 'deposit';
  dueDate: string | null;
  paymentDate: string | null;
}

export interface SaleDto {
  id: number;
  status: string;
  createdAt: string;
  stripeSubscriptionId: string | null;
  customer: { name: string | null; surname: string | null; email: string | null; phone: string | null } | null;
  seller: { id: number; name: string | null; lastName: string | null } | null;
  client: { id: number; name: string | null } | null;
  pricePlan: {
    name: string | null;
    installmentAmount: string | null;
    totalAmount: string | null;
    serviceVariant: {
      name: string | null;
      service: { name: string | null } | null;
    } | null;
  } | null;
  installments: InstallmentDto[];
}

@Injectable({ providedIn: 'root' })
export class SaleApiService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<SaleDto[]> {
    return this.http.get<SaleDto[]>(`${API_URL}/sales`);
  }
}
