export interface LeadSeller {
  id: number;
  name: string | null;
  lastName: string | null;
  email: string | null;
}

export interface LeadSetter {
  id: number;
  name: string | null;
  lastName: string | null;
}

export interface LeadClient {
  id: number;
  name: string | null;
}

export interface LeadServiceRef {
  id: number;
  name: string | null;
  isActive: boolean;
  client: LeadClient | null;
}

export interface LeadStatusOption {
  id: number;
  code: string;
  label: string;
  sortOrder: number;
}

export interface Lead {
  id: number;
  createdAt: string;
  name: string | null;
  surname: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  statusOption: LeadStatusOption | null;
  notes: string | null;
  callStartDate: string | null;
  seller: LeadSeller | null;
  setter: LeadSetter | null;
  client: LeadClient | null;
  service: LeadServiceRef | null;
}
