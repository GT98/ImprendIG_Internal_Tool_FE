import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const API_URL = environment.apiUrl;

export interface BookingQuestion {
  key: string;
  label: string;
  shortLabel?: string;
  // testi con cui la domanda compariva in passato (modulo Wix)
  aliases?: string[];
  // radio = scelta a bottoni; confirm = spunta di presa visione/consenso
  type: 'text' | 'textarea' | 'select' | 'radio' | 'confirm';
  options?: string[];
  required?: boolean;
  help?: string;
  blockingOptions?: string[];
  blockingMessage?: string;
  hideWhenRef?: boolean;
}

export interface BookingBrand {
  /** principale: pulsanti, bordi */
  color?: string;
  /** testo sopra il principale */
  onColor?: string;
  /** testi e link colorati */
  accent?: string;
  /** secondario: evidenziazioni */
  soft?: string;
  /** sfondo pagina ed email */
  background?: string;
  logoUrl?: string;
  subtitle?: string;
}

export interface PublicBookingSettings {
  slug: string;
  title: string;
  durationMin: number;
  horizonDays: number;
  changeLimitHours: number;
  questions: BookingQuestion[];
  brand: BookingBrand;
}

export interface CreatePublicBooking {
  startsAt: string;
  name: string;
  surname?: string;
  email: string;
  phone?: string;
  answers: Record<string, string>;
  ref?: string;
  utm?: Record<string, string>;
  prospect?: string;
  website?: string;
}

export interface PublicBookingView {
  settings: PublicBookingSettings;
  status: BookingStatus;
  startsAt: string;
  endsAt: string;
  name: string;
  sellerName: string | null;
  meetUrl: string | null;
  canChange: boolean;
}

export type BookingStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export type BookingChannel = 'organic' | 'ads' | 'direct';

interface Person {
  id: number;
  name: string | null;
  lastName: string | null;
  email?: string | null;
}

export interface BookingDto {
  id: number;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  channel: BookingChannel;
  utm: Record<string, string> | null;
  name: string;
  surname: string | null;
  email: string;
  phone: string | null;
  answers: Record<string, string>;
  meetUrl: string | null;
  seller: Person;
  setter: Person | null;
  client: { id: number; name: string | null };
  lead: { id: number } | null;
  link: { id: number; slug: string; label: string | null } | null;
}

export interface AvailabilityWindow {
  weekday: number;
  startTime: string;
  endTime: string;
}

/** Riga della vista d'insieme admin: una per venditrice */
export interface SellerOverview {
  id: number;
  name: string;
  windows: AvailabilityWindow[];
  academies: { id: number; title: string }[];
  /** Blocchi/ferie da lunedì di questa settimana in poi; current = in corso adesso */
  timeOffs: { startsAt: string; endsAt: string; note: string | null; current: boolean }[];
}

export interface TimeOffDto {
  id: number;
  startsAt: string;
  endsAt: string;
  note: string | null;
  seller?: Person;
  conflicts?: BookingDto[];
}

export interface BookingSettingsDto {
  id: number;
  slug: string;
  title: string;
  durationMin: number;
  bufferMin: number;
  slotStepMin: number;
  minNoticeHours: number;
  horizonDays: number;
  changeLimitHours: number;
  sellerIds: number[];
  questions: BookingQuestion[];
  brand: BookingBrand;
  active: boolean;
  client: { id: number; name: string | null };
}

export interface BookingLinkDto {
  id: number;
  slug: string;
  label: string | null;
  channel: BookingChannel;
  active: boolean;
  setter: Person | null;
  client: { id: number; name: string | null } | null;
  bookingsCount: number;
  createdAt: string;
}

export interface UpsertBookingLink {
  slug?: string;
  label?: string | null;
  setterId?: number | null;
  clientId?: number | null;
  channel?: BookingChannel;
  active?: boolean;
}

// Pagina pubblica /prenota (nessun login)
@Injectable({ providedIn: 'root' })
export class PublicBookingApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_URL}/public/booking`;

  settings(slug: string): Observable<PublicBookingSettings> {
    return this.http.get<PublicBookingSettings>(`${this.base}/${slug}`);
  }

  /** prospect = token del lead ADS, ref = link della setter: col link ADS solo gli orari della setter */
  slots(slug: string, from: string, to: string, prospect?: string, ref?: string): Observable<string[]> {
    const params: Record<string, string> = { from, to };
    if (prospect) params['l'] = prospect;
    if (ref) params['ref'] = ref;
    return this.http.get<string[]>(`${this.base}/${slug}/slots`, { params });
  }

  create(slug: string, dto: CreatePublicBooking): Observable<{ startsAt: string; manageToken: string }> {
    return this.http.post<{ startsAt: string; manageToken: string }>(`${this.base}/${slug}`, dto);
  }

  manage(token: string): Observable<PublicBookingView> {
    return this.http.get<PublicBookingView>(`${this.base}/manage/${token}`);
  }

  manageSlots(token: string, from: string, to: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/manage/${token}/slots`, { params: { from, to } });
  }

  reschedule(token: string, startsAt: string): Observable<PublicBookingView> {
    return this.http.post<PublicBookingView>(`${this.base}/manage/${token}/reschedule`, { startsAt });
  }

  cancel(token: string): Observable<PublicBookingView> {
    return this.http.post<PublicBookingView>(`${this.base}/manage/${token}/cancel`, {});
  }
}

export interface AcademyCoverage {
  id: number;
  slug: string;
  sellers: number;
  withoutHours: string[];
  freeSlots7d: number;
}

export interface SellerAcademy {
  id: number;
  slug: string;
  title: string;
  active: boolean;
  selected: boolean;
}

// Area interna: agenda, disponibilità, link e impostazioni
@Injectable({ providedIn: 'root' })
export class BookingApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_URL}/booking`;

  availability(sellerId: number): Observable<AvailabilityWindow[]> {
    return this.http.get<AvailabilityWindow[]>(`${this.base}/availability/${sellerId}`);
  }

  /** Tutte le venditrici con orari, percorsi e prossimo blocco (solo admin) */
  overview(): Observable<SellerOverview[]> {
    return this.http.get<SellerOverview[]>(`${this.base}/overview`);
  }

  /** Copertura dei percorsi: chi è senza orari, orari prenotabili nei prossimi 7 giorni */
  coverage(): Observable<AcademyCoverage[]> {
    return this.http.get<AcademyCoverage[]>(`${this.base}/coverage`);
  }

  /** Academy in cui la venditrice è a rotazione */
  sellerAcademies(sellerId: number): Observable<SellerAcademy[]> {
    return this.http.get<SellerAcademy[]>(`${this.base}/academies/${sellerId}`);
  }

  saveSellerAcademies(sellerId: number, settingsIds: number[]): Observable<SellerAcademy[]> {
    return this.http.post<SellerAcademy[]>(`${this.base}/academies/${sellerId}`, { settingsIds });
  }

  saveAvailability(sellerId: number, windows: AvailabilityWindow[]): Observable<AvailabilityWindow[]> {
    return this.http.post<AvailabilityWindow[]>(`${this.base}/availability/${sellerId}`, { windows });
  }

  timeOff(sellerId?: number | null): Observable<TimeOffDto[]> {
    const params: Record<string, string> = sellerId ? { sellerId: String(sellerId) } : {};
    return this.http.get<TimeOffDto[]>(`${this.base}/time-off`, { params });
  }

  createTimeOff(dto: { sellerId: number; startsAt: string; endsAt: string; note?: string }): Observable<TimeOffDto> {
    return this.http.post<TimeOffDto>(`${this.base}/time-off`, dto);
  }

  removeTimeOff(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/time-off/${id}`);
  }

  settings(): Observable<BookingSettingsDto[]> {
    return this.http.get<BookingSettingsDto[]>(`${this.base}/settings`);
  }

  updateSettings(id: number, dto: Partial<Omit<BookingSettingsDto, 'id' | 'slug' | 'client'>>): Observable<BookingSettingsDto> {
    return this.http.patch<BookingSettingsDto>(`${this.base}/settings/${id}`, dto);
  }

  links(): Observable<BookingLinkDto[]> {
    return this.http.get<BookingLinkDto[]>(`${this.base}/links`);
  }

  createLink(dto: UpsertBookingLink): Observable<BookingLinkDto> {
    return this.http.post<BookingLinkDto>(`${this.base}/links`, dto);
  }

  updateLink(id: number, dto: UpsertBookingLink): Observable<BookingLinkDto> {
    return this.http.patch<BookingLinkDto>(`${this.base}/links/${id}`, dto);
  }

  removeLink(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/links/${id}`);
  }
}
