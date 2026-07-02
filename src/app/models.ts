export interface Seller {
  id: string;
  name: string;
  initials: string;
  color: string;
  role: string;
}

export interface Call {
  id: string;
  sellerId: string;
  setterId: string | null;
  client: string;
  company: string;
  type: 'demo' | 'follow-up' | 'closing';
  status: 'da-fare' | 'fatta' | 'no-show';
  statusCode: string | null;
  statusOptionId: number | null;
  value: number;
  when: string;
  link: string;
  notes: string | null;
}

export interface Deal {
  id: string;
  sellerId: string;
  client: string;
  value: number;
  commType: 'percentuale' | 'scaglione' | 'fisso';
  rate: number | null;
  commission: number;
  date: string;
  month: string;
}

export interface CommissionPoint {
  m: string;
  v: number;
}

export interface Client {
  id: string;
  sellerId: string;
  setterId: string | null;
  setterName: string | null;
  name: string;
  contact: string;
  plan: string;
  mrr: number;
  payStatus: 'pagato' | 'pending' | 'fallito';
  lastPay: string;
  nextPay: string;
  stripe: string;
  totalPaid: number;
  method: string;
}

export type NavRoute = 'chiamate' | 'provvigioni' | 'clienti' | 'catalogo';
export type Role = 'venditore' | 'admin';
export type Layout = 'lista' | 'kanban' | 'agenda';
export type ChartType = 'barre' | 'area' | 'donut';
