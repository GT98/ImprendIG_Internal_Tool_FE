import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const API = environment.apiUrl;

export interface ClientRevenueDto {
  id: number;
  clientId: number;
  month: string;
  total: string;
  updatedAt: string;
}

export interface ClientLeadDto {
  id: number;
  name: string | null;
  surname: string | null;
  email: string | null;
  phone: string | null;
  callStartDate: string | null;
  status: string | null;
  notes: string | null;
  sellerNotes: string | null;
  statusOption: { id: number; label: string } | null;
  seller: { id: number; name: string | null; lastName: string | null } | null;
}

export interface ClientSaleDto {
  id: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
  customer: { id: number; name: string | null; surname: string | null; email: string | null } | null;
  pricePlan: {
    id: number;
    name: string | null;
    basePrice: string | null;
    installmentCount: number | null;
    serviceVariant: { id: number; name: string | null; service: { id: number; name: string | null } | null } | null;
  } | null;
  installments: { id: number; amount: string | null; installmentNumber: number; status: string; type: string; dueDate: string | null; paymentDate: string | null }[];
}

@Injectable({ providedIn: 'root' })
export class AreaClienteApiService {
  private readonly http = inject(HttpClient);

  getRevenue(clientId: number) {
    return this.http.get<ClientRevenueDto[]>(`${API}/client-revenue/${clientId}`);
  }

  getLeads(month?: string) {
    const params = month ? `?month=${month}` : '';
    return this.http.get<ClientLeadDto[]>(`${API}/leads${params}`);
  }

  getSales() {
    return this.http.get<ClientSaleDto[]>(`${API}/sales`);
  }
}
