import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;

export interface WixRoutingPersonDto {
  id: number;
  name: string | null;
  lastName: string | null;
}

export interface WixRoutingRuleDto {
  id: number;
  wixServiceId: string;
  wixServiceName: string | null;
  defaultSetter: WixRoutingPersonDto | null;
  defaultSeller: WixRoutingPersonDto | null;
}

export interface UpsertWixRoutingDto {
  wixServiceId: string;
  wixServiceName?: string | null;
  defaultSetterId?: number | null;
  defaultSellerId?: number | null;
}

@Injectable({ providedIn: 'root' })
export class WixRoutingApiService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<WixRoutingRuleDto[]> {
    return this.http.get<WixRoutingRuleDto[]>(`${API_URL}/wix-routing`);
  }

  upsert(dto: UpsertWixRoutingDto): Observable<WixRoutingRuleDto> {
    return this.http.post<WixRoutingRuleDto>(`${API_URL}/wix-routing`, dto);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/wix-routing/${id}`);
  }
}
