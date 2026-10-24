import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const API_URL = environment.apiUrl;

export type ProspectStatus =
  | 'nuovo'
  | 'in_corso'
  | 'non_risponde'
  | 'non_qualificata'
  | 'discovery_rifiutata'
  | 'discovery_fatta'
  | 'discovery_no'
  | 'call_prenotata';

// Stati della fase chat/discovery (gli stessi della tabella Notion)
export const PROSPECT_STATUS: Record<ProspectStatus, { label: string; tone: string }> = {
  nuovo:               { label: 'Da contattare',        tone: 'blue' },
  in_corso:            { label: 'In corso',             tone: 'amber' },
  non_risponde:        { label: 'Non risponde',         tone: 'gray' },
  non_qualificata:     { label: 'Non qualificata',      tone: 'red' },
  discovery_rifiutata: { label: 'Discovery rifiutata',  tone: 'red' },
  discovery_fatta:     { label: 'Discovery fatta',      tone: 'violet' },
  discovery_no:        { label: 'Esito discovery: NO',  tone: 'red' },
  call_prenotata:      { label: 'Call prenotata',       tone: 'green' },
};

export interface ShiftView {
  date: string;
  slot: number;
  label: string;
  start: string;
  end: string;
  startsAt: string;
  endsAt: string;
  setter: { id: number; name: string } | null;
}

export interface Prospect {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  client: { id: number; name: string } | null;
  answers: Record<string, string>;
  arrivedAt: string;
  shiftDate: string;
  shiftSlot: number;
  shiftSetter: string | null;
  priority: number;
  arrivalGroup: string | null;
  status: ProspectStatus;
  handledBy: { id: number; name: string } | null;
  firstContactAt: string | null;
  notes: string | null;
  call: { startsAt: string; status: string; outcome: string | null } | null;
}

export interface SetterLinks {
  academy: string;
  slug: string;
  ads: string;
  organic: string;
}

export interface ProspectFilters {
  text?: string;
  status?: string;
  from?: string;
  to?: string;
  setterId?: number;
  slot?: number;
  clientId?: number;
}

export interface ShiftBoard {
  now: string;
  current: ShiftView | null;
  next: ShiftView;
  focus: 'current' | 'next';
  queue: Prospect[];
  backlog: Prospect[];
  followUp: Prospect[];
  /** Già assegnati ai turni successivi (es. arrivati di notte per il 2° turno) */
  upcoming: Prospect[];
  links: SetterLinks[];
}

export interface ShiftAssignment {
  date: string;
  slot: number;
  setter: { id: number; name: string };
}

export interface ShiftDefault {
  slot: number;
  setter: { id: number; name: string } | null;
}

@Injectable({ providedIn: 'root' })
export class ShiftApiService {
  private readonly http = inject(HttpClient);

  board(): Observable<ShiftBoard> {
    return this.http.get<ShiftBoard>(`${API_URL}/shifts/board`);
  }

  search(q: ProspectFilters): Observable<Prospect[]> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(q)) if (v) params = params.set(k, String(v));
    return this.http.get<Prospect[]>(`${API_URL}/shifts/prospects`, { params });
  }

  update(id: number, dto: { status?: ProspectStatus; notes?: string | null }): Observable<Prospect> {
    return this.http.patch<Prospect>(`${API_URL}/shifts/prospects/${id}`, dto);
  }

  /** Primo contatto: 409 se il lead lo segue già un'altra setter (force per procedere) */
  contact(id: number, channel: 'call' | 'whatsapp', force = false): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(`${API_URL}/shifts/prospects/${id}/contact`, { channel, force });
  }

  bookingLink(id: number): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(`${API_URL}/shifts/prospects/${id}/booking-link`, {});
  }

  shifts(from: string, to: string): Observable<ShiftAssignment[]> {
    return this.http.get<ShiftAssignment[]>(`${API_URL}/shifts`, { params: { from, to } });
  }

  setShift(date: string, slot: number, setterId: number | null): Observable<unknown> {
    return this.http.post(`${API_URL}/shifts`, { date, slot, setterId });
  }

  defaults(): Observable<ShiftDefault[]> {
    return this.http.get<ShiftDefault[]>(`${API_URL}/shifts/defaults`);
  }

  setDefault(slot: number, setterId: number | null): Observable<ShiftDefault[]> {
    return this.http.post<ShiftDefault[]>(`${API_URL}/shifts/defaults`, { slot, setterId });
  }

  copyWeek(fromStart: string, toStart: string): Observable<ShiftAssignment[]> {
    return this.http.post<ShiftAssignment[]>(`${API_URL}/shifts/copy-week`, { fromStart, toStart });
  }
}

/** Precompilazione del form di prenotazione dal link del lead (?l=) */
@Injectable({ providedIn: 'root' })
export class PublicProspectApiService {
  private readonly http = inject(HttpClient);

  prefill(token: string): Observable<{ name: string; surname: string; email: string; phone: string }> {
    return this.http.get<{ name: string; surname: string; email: string; phone: string }>(
      `${API_URL}/public/prospect/${token}`,
    );
  }
}
