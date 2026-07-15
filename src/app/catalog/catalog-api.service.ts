import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

export interface CatalogPricePlan {
  id: number;
  name: string;
  basePrice: number | null;
  installmentCount: number | null;
  installmentAmount: number | null;
  totalAmount: number | null;
  stripePaymentLink: string | null;
  stripePriceId: string | null;
  itaStripePriceId: string | null;
  itaStripePaymentLink: string | null;
  billingType: 'recurring' | 'one_time' | null;
}

export interface CatalogVariant {
  id: number;
  name: string;
  pricePlans: CatalogPricePlan[];
}

export interface CatalogService {
  id: number;
  name: string;
  isActive: boolean;
  client: { id: number; name: string } | null;
  variants: CatalogVariant[];
}

export interface CatalogClient {
  id: number;
  name: string;
}

export type UpdatePricePlanDto = Partial<Pick<CatalogPricePlan,
  'name' | 'basePrice' | 'installmentCount' | 'installmentAmount' | 'totalAmount' |
  'stripePaymentLink' | 'stripePriceId' | 'itaStripePriceId' | 'itaStripePaymentLink' |
  'billingType'
>>;

export interface CreateCheckoutSessionDto {
  pricePlanId: number;
  sellerId: number;
  trialEndDate?: string;
  stripeClientId?: number;
  withCf?: boolean;
}

/** ID Stripe ITA dedicato (Anna Massari) */
export const ITALIAN_STRIPE_CLIENT_ID = 99;

@Injectable({ providedIn: 'root' })
export class CatalogApiService {
  private readonly http = inject(HttpClient);

  getCatalog(clientId?: number): Observable<CatalogService[]> {
    const params: Record<string, string> = {};
    if (clientId != null) params['clientId'] = String(clientId);
    return this.http.get<CatalogService[]>(`${API}/services/catalog`, { params });
  }

  getClients(): Observable<CatalogClient[]> {
    return this.http.get<CatalogClient[]>(`${API}/clients`);
  }

  updatePricePlan(id: number, dto: UpdatePricePlanDto): Observable<CatalogPricePlan> {
    return this.http.patch<CatalogPricePlan>(`${API}/price-plans/${id}`, dto);
  }

  createCheckoutSession(dto: CreateCheckoutSessionDto): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(`${API}/stripe/checkout-session`, dto);
  }
}
