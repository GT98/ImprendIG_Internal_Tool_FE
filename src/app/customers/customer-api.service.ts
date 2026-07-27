import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

export interface CustomerSeller {
  id: number;
  name: string | null;
  lastName: string | null;
}

export interface CustomerSale {
  id: number;
  status: string;
  seller: CustomerSeller | null;
  pricePlan: {
    id: number;
    name: string;
    serviceVariant: {
      id: number;
      name: string;
      service: { id: number; name: string } | null;
    } | null;
  } | null;
}

export interface CustomerDto {
  id: number;
  name: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  telegramId: string | null;
  sale: CustomerSale | null;
}

@Injectable({ providedIn: 'root' })
export class CustomerApiService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<CustomerDto[]> {
    return this.http.get<CustomerDto[]>(`${API}/customers`);
  }
}
