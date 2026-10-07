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
  status: 'draft' | 'paid' | 'failed' | 'trial';
  type: 'balance' | 'deposit';
  dueDate: string | null;
  paymentDate: string | null;
}

export interface SaleDto {
  id: number;
  status: string;
  paymentMethod: 'stripe' | 'stripe_ita' | 'bonifico';
  createdAt: string;
  stripeSubscriptionId: string | null;
  customer: { id: number; name: string | null; surname: string | null; email: string | null; phone: string | null; startDate: string | null } | null;
  seller: { id: number; name: string | null; lastName: string | null } | null;
  setter: { id: number; name: string | null; lastName: string | null } | null;
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

export interface CreateNeutralSaleDto {
  amount: number;
  clientId: number;
  notes?: string;
  customerEmail?: string;
  customerName?: string;
  customerSurname?: string;
  paymentDate?: string;
  paymentMethod?: 'stripe' | 'stripe_ita' | 'bonifico';
}

export interface CreateManualSaleDto {
  customerEmail: string;
  customerName?: string;
  customerSurname?: string;
  customerPhone?: string;
  pricePlanId: number;
  sellerId?: number;
  setterId?: number;
  clientId?: number;
  leadId?: number;
  includeDeposit?: boolean;
  depositAmount?: number;
  hasTrial?: boolean;
  firstInstallmentDate?: string;
  paymentMethod?: 'stripe' | 'stripe_ita' | 'bonifico';
}

@Injectable({ providedIn: 'root' })
export class SaleApiService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<SaleDto[]> {
    return this.http.get<SaleDto[]>(`${API_URL}/sales`);
  }

  createNeutral(dto: CreateNeutralSaleDto): Observable<SaleDto> {
    return this.http.post<SaleDto>(`${API_URL}/sales/neutral`, dto);
  }

  createManual(dto: CreateManualSaleDto): Observable<SaleDto> {
    return this.http.post<SaleDto>(`${API_URL}/sales/manual`, dto);
  }

  reassignSeller(saleId: number, sellerId: number): Observable<SaleDto> {
    return this.http.post<SaleDto>(`${API_URL}/sales/${saleId}/reassign-seller`, { sellerId });
  }

  reassignSetter(saleId: number, setterId: number | null): Observable<SaleDto> {
    return this.http.post<SaleDto>(`${API_URL}/sales/${saleId}/reassign-setter`, { setterId });
  }

  recalculateCommissions(saleId: number): Observable<{ totalAmount: number }> {
    return this.http.post<{ totalAmount: number }>(`${API_URL}/sales/${saleId}/recalculate-commissions`, {});
  }

  markInstallmentPaid(id: number): Observable<InstallmentDto> {
    return this.http.patch<InstallmentDto>(`${API_URL}/installments/${id}/mark-paid-notify`, null);
  }

  markInstallmentDraft(id: number): Observable<InstallmentDto> {
    return this.http.patch<InstallmentDto>(`${API_URL}/installments/${id}`, {
      status: 'draft',
      paymentDate: null,
    });
  }
}
