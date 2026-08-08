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
  formCliente: string | null;
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

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface AssignableUser {
  id: number;
  email: string;
  role: string;
  seller: { id: number; name: string; lastName: string } | null;
}

export interface CallRecording {
  id: number;
  leadId: string | null;
  filename: string;
  mimeType: string;
  durationSeconds: number | null;
  createdAt: string;
  signedUrl: string;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  assignedTo: AssignableUser | null;
  createdBy: AssignableUser | null;
  createdAt: string;
  updatedAt: string;
}
