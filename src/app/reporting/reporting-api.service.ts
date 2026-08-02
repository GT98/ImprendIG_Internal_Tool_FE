import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const API_URL = environment.apiUrl;

export interface EmployeeInfo {
  id: number;
  type: 'seller' | 'setter';
  name: string;
  email: string;
}

export interface CommissionLineItem {
  id: number;
  saleId: number | null;
  customerName: string;
  planName: string;
  installmentNumber: number | null;
  totalInstallments: number | null;
  amount: number;
  percentage: number | null;
}

export interface WorkOrderDto {
  id: number;
  description: string;
  type: 'fixed' | 'percentage';
  fixedAmount: number | null;
  percentageRate: number | null;
  baseAmount: number | null;
  computedAmount: number;
}

export interface BalanceDto {
  id: number | null;
  current: number;
  notes: string | null;
}

export interface MonthlyReportDto {
  employee: EmployeeInfo;
  month: string;
  commissions: CommissionLineItem[];
  workOrders: WorkOrderDto[];
  subtotalCommissions: number;
  subtotalWorkOrders: number;
  grossTotal: number;
  balance: BalanceDto;
  netPayable: number;
  balanceAfterPayment: number;
}

export interface ReportSummaryItem {
  employee: EmployeeInfo;
  grossTotal: number;
  subtotalCommissions: number;
  subtotalWorkOrders: number;
  balance: number;
  netPayable: number;
}

export interface WorkOrderListItem extends WorkOrderDto {
  month: string;
  employee: EmployeeInfo | null;
}

export interface CreateWorkOrderPayload {
  month: string;
  description: string;
  type: 'fixed' | 'percentage';
  fixedAmount?: number;
  percentageRate?: number;
  baseAmount?: number;
  sellerId?: number;
  setterId?: number;
}

export interface AdjustBalancePayload {
  delta: number;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class ReportingApiService {
  private readonly http = inject(HttpClient);

  getSummary(month: string): Observable<ReportSummaryItem[]> {
    return this.http.get<ReportSummaryItem[]>(`${API_URL}/reporting/summary`, { params: { month } });
  }

  getReport(type: string, id: number, month: string): Observable<MonthlyReportDto> {
    return this.http.get<MonthlyReportDto>(`${API_URL}/reporting/report`, {
      params: { type, id: String(id), month },
    });
  }

  getWorkOrders(month: string): Observable<WorkOrderListItem[]> {
    return this.http.get<WorkOrderListItem[]>(`${API_URL}/reporting/work-orders`, { params: { month } });
  }

  createWorkOrder(dto: CreateWorkOrderPayload): Observable<WorkOrderDto> {
    return this.http.post<WorkOrderDto>(`${API_URL}/reporting/work-orders`, dto);
  }

  updateWorkOrder(id: number, dto: Partial<CreateWorkOrderPayload>): Observable<WorkOrderDto> {
    return this.http.patch<WorkOrderDto>(`${API_URL}/reporting/work-orders/${id}`, dto);
  }

  deleteWorkOrder(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/reporting/work-orders/${id}`);
  }

  adjustBalance(type: string, id: number, dto: AdjustBalancePayload): Observable<{ balance: number; notes: string | null }> {
    return this.http.patch<{ balance: number; notes: string | null }>(
      `${API_URL}/reporting/balance/${type}/${id}`,
      dto,
    );
  }
}
