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

export interface TimesheetItemLine {
  id: number;
  description: string;
  type: 'fixed' | 'percentage';
  fixedAmount: number | null;
  percentageRate: number | null;
  baseAmount: number | null;
  computedAmount: number;
  notes: string | null;
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
  timesheetItems: TimesheetItemLine[];
  timesheetId: number | null;
  timesheetStatus: string | null;
  subtotalCommissions: number;
  subtotalTimesheetItems: number;
  grossTotal: number;
  balance: BalanceDto;
  netPayable: number;
  balanceAfterPayment: number;
}

export interface ReportSummaryItem {
  employee: EmployeeInfo;
  grossTotal: number;
  subtotalCommissions: number;
  subtotalTimesheetItems: number;
  balance: number;
  netPayable: number;
  timesheetStatus: string | null;
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

  adjustBalance(type: string, id: number, dto: AdjustBalancePayload): Observable<{ balance: number; notes: string | null }> {
    return this.http.patch<{ balance: number; notes: string | null }>(
      `${API_URL}/reporting/balance/${type}/${id}`,
      dto,
    );
  }
}
