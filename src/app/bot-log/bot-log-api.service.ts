import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const API_URL = environment.apiUrl;

export type BotLogType =
  | 'seller_verified'
  | 'unlock_sent'
  | 'join_approved'
  | 'join_declined'
  | 'link_revoked';

export interface BotLogItem {
  id: number;
  type: BotLogType;
  saleId: number | null;
  installmentId: number | null;
  sellerId: number | null;
  customerName: string | null;
  telegramUserId: string | null;
  channelId: string | null;
  segmentName: string | null;
  extra: Record<string, unknown> | null;
  createdAt: string;
}

export interface BotLogPage {
  items: BotLogItem[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class BotLogApiService {
  private readonly http = inject(HttpClient);

  getAll(opts: { limit?: number; offset?: number; type?: string; saleId?: number } = {}): Observable<BotLogPage> {
    const params: Record<string, string> = {};
    if (opts.limit !== undefined) params['limit'] = String(opts.limit);
    if (opts.offset !== undefined) params['offset'] = String(opts.offset);
    if (opts.type) params['type'] = opts.type;
    if (opts.saleId !== undefined) params['saleId'] = String(opts.saleId);
    return this.http.get<BotLogPage>(`${API_URL}/bot-logs`, { params });
  }
}
