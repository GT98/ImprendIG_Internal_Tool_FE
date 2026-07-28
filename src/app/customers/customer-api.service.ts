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
  surname: string | null;
  email: string | null;
  phone: string | null;
  telegramId: string | null;
  codiceFiscale: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  cap: string | null;
  startDate: string | null;
  sale: CustomerSale | null;
}

export interface OnboardingFormStatusDto {
  status: 'pending' | 'completed';
  customerName: string | null;
  productName: string | null;
  prefillName: string | null;
}

export interface SubmitOnboardingFormDto {
  fullName: string;
  codiceFiscale: string;
  address: string;
  city: string;
  province: string;
  cap: string;
  startDate: string;
  termsAccepted: boolean;
}

@Injectable({ providedIn: 'root' })
export class CustomerApiService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<CustomerDto[]> {
    return this.http.get<CustomerDto[]>(`${API}/customers`);
  }
}

@Injectable({ providedIn: 'root' })
export class OnboardingFormApiService {
  private readonly http = inject(HttpClient);

  getForm(token: string): Observable<OnboardingFormStatusDto> {
    return this.http.get<OnboardingFormStatusDto>(`${API}/onboarding-form/${token}`);
  }

  submit(token: string, dto: SubmitOnboardingFormDto): Observable<void> {
    return this.http.post<void>(`${API}/onboarding-form/${token}/submit`, dto);
  }
}
