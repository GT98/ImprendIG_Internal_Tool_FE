import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, EMPTY, filter, forkJoin, switchMap } from 'rxjs';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/toast.service';
import {
  ReportingApiService,
  MonthlyReportDto,
  WorkOrderDto,
  WorkOrderListItem,
  EmployeeInfo,
  CreateWorkOrderPayload,
  ReportSummaryItem,
} from '../../reporting/reporting-api.service';
import { WorkOrderModalComponent } from './work-order-modal.component';
import { BalanceModalComponent } from './balance-modal.component';

function currentMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonth(iso: string): string {
  const [year, mon] = iso.split('-');
  const names = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  return `${names[parseInt(mon, 10) - 1]} ${year}`;
}

function shiftMonth(iso: string, delta: number): string {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

@Component({
  selector: 'app-rendicontazioni',
  imports: [IconComponent, WorkOrderModalComponent, BalanceModalComponent],
  templateUrl: './rendicontazioni.component.html',
  styleUrl: './rendicontazioni.component.css',
})
export class RendicontazioniComponent {
  private readonly api = inject(ReportingApiService);
  private readonly toast = inject(ToastService);

  // ── Mese ──────────────────────────────────────────────────────
  readonly month = signal(currentMonthIso());
  readonly monthLabel = computed(() => formatMonth(this.month()));
  prevMonth() { this.month.update(m => shiftMonth(m, -1)); }
  nextMonth() { this.month.update(m => shiftMonth(m, +1)); }

  // ── Tab ───────────────────────────────────────────────────────
  readonly activeTab = signal<'riepilogo' | 'commesse'>('riepilogo');

  // ── Riepilogo (summary) ───────────────────────────────────────
  readonly summaryItems   = signal<ReportSummaryItem[]>([]);
  readonly summaryLoading = signal(true);
  readonly summaryError   = signal(false);

  readonly allEmployees = computed<EmployeeInfo[]>(() =>
    this.summaryItems().map(s => s.employee),
  );

  // ── Commesse tab ──────────────────────────────────────────────
  readonly workOrderItems   = signal<WorkOrderListItem[]>([]);
  readonly workOrderLoading = signal(false);
  readonly workOrderError   = signal(false);

  constructor() {
    // Re-fetch summary whenever month changes (switchMap cancels in-flight requests)
    toObservable(this.month).pipe(
      switchMap(m => {
        this.summaryLoading.set(true);
        this.summaryError.set(false);
        return this.api.getSummary(m).pipe(
          catchError(() => {
            this.summaryError.set(true);
            this.summaryLoading.set(false);
            return EMPTY;
          }),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe(data => {
      this.summaryItems.set(data);
      this.summaryLoading.set(false);
    });

    // Re-fetch work orders when month changes OR when switching to 'commesse' tab
    combineLatest([toObservable(this.month), toObservable(this.activeTab)]).pipe(
      filter(([, tab]) => tab === 'commesse'),
      switchMap(([m]) => {
        this.workOrderLoading.set(true);
        this.workOrderError.set(false);
        return this.api.getWorkOrders(m).pipe(
          catchError(() => {
            this.workOrderError.set(true);
            this.workOrderLoading.set(false);
            return EMPTY;
          }),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe(data => {
      this.workOrderItems.set(data);
      this.workOrderLoading.set(false);
    });
  }

  reloadSummary() {
    this.summaryLoading.set(true);
    this.summaryError.set(false);
    this.api.getSummary(this.month()).subscribe({
      next: data => { this.summaryItems.set(data); this.summaryLoading.set(false); },
      error: () => { this.summaryError.set(true); this.summaryLoading.set(false); },
    });
  }

  reloadWorkOrders() {
    this.workOrderLoading.set(true);
    this.workOrderError.set(false);
    this.api.getWorkOrders(this.month()).subscribe({
      next: data => { this.workOrderItems.set(data); this.workOrderLoading.set(false); },
      error: () => { this.workOrderError.set(true); this.workOrderLoading.set(false); },
    });
  }

  // ── Dettaglio dipendente ──────────────────────────────────────
  readonly selectedEmployee = signal<EmployeeInfo | null>(null);
  readonly reportData    = signal<MonthlyReportDto | null>(null);
  readonly reportLoading = signal(false);
  readonly reportError   = signal(false);

  selectEmployee(emp: EmployeeInfo) {
    this.selectedEmployee.set(emp);
    this.activeTab.set('riepilogo');
    this.loadReport(emp);
  }

  closeDetail() {
    this.selectedEmployee.set(null);
    this.reportData.set(null);
    this.reportError.set(false);
  }

  private loadReport(emp: EmployeeInfo) {
    this.reportLoading.set(true);
    this.reportError.set(false);
    this.reportData.set(null);
    this.api.getReport(emp.type, Number(emp.id), this.month()).subscribe({
      next: data => { this.reportData.set(data); this.reportLoading.set(false); },
      error: () => { this.reportError.set(true); this.reportLoading.set(false); },
    });
  }

  reloadReport() {
    const emp = this.selectedEmployee();
    if (emp) this.loadReport(emp);
  }

  // ── Work order modal (da dettaglio: singolo dipendente) ───────
  readonly showWorkOrderModal = signal(false);
  readonly editingWorkOrder   = signal<WorkOrderDto | null>(null);

  openAddWorkOrder() { this.editingWorkOrder.set(null); this.showWorkOrderModal.set(true); }
  openEditWorkOrder(wo: WorkOrderDto) { this.editingWorkOrder.set(wo); this.showWorkOrderModal.set(true); }

  onWorkOrderSaved() {
    this.showWorkOrderModal.set(false);
    this.editingWorkOrder.set(null);
    this.reloadReport();
    this.reloadSummary();
    this.reloadWorkOrders();
  }

  // ── Work order modal (da tab commesse: multi-dipendente) ──────
  readonly showMultiModal  = signal(false);
  readonly multiSaving     = signal(false);
  readonly selectedEmpKeys = signal<Set<string>>(new Set());

  openMultiModal() {
    this.selectedEmpKeys.set(new Set());
    this.showMultiModal.set(true);
  }

  toggleEmp(emp: EmployeeInfo) {
    const key = `${emp.type}/${emp.id}`;
    this.selectedEmpKeys.update(s => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }

  submitMultiWorkOrder(payload: Omit<CreateWorkOrderPayload, 'sellerId' | 'setterId'>) {
    const keys = [...this.selectedEmpKeys()];
    if (!keys.length) { this.toast.error('Seleziona almeno un dipendente'); return; }

    const requests = keys.map(k => {
      const [type, id] = k.split('/');
      const dto: CreateWorkOrderPayload = {
        ...payload,
        ...(type === 'seller' ? { sellerId: Number(id) } : { setterId: Number(id) }),
      };
      return this.api.createWorkOrder(dto);
    });

    this.multiSaving.set(true);
    forkJoin(requests).subscribe({
      next: () => {
        this.multiSaving.set(false);
        this.showMultiModal.set(false);
        this.toast.success(`Commessa assegnata a ${keys.length} dipendente/i`);
        this.reloadWorkOrders();
        this.reloadSummary();
        this.reloadReport();
      },
      error: () => {
        this.multiSaving.set(false);
        this.toast.error('Errore durante il salvataggio');
      },
    });
  }

  // ── Delete work order ─────────────────────────────────────────
  readonly deletingId = signal<number | null>(null);

  deleteWorkOrder(id: number) {
    this.deletingId.set(id);
    this.api.deleteWorkOrder(id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.toast.success('Commessa eliminata');
        this.reloadReport();
        this.reloadSummary();
        this.reloadWorkOrders();
      },
      error: () => {
        this.deletingId.set(null);
        this.toast.error('Errore durante l\'eliminazione');
      },
    });
  }

  // ── Balance modal ─────────────────────────────────────────────
  readonly showBalanceModal = signal(false);

  onBalanceSaved() {
    this.showBalanceModal.set(false);
    this.reloadReport();
    this.reloadSummary();
  }

  // ── Print ─────────────────────────────────────────────────────
  openPrint() {
    const emp = this.selectedEmployee();
    if (!emp) return;
    window.open(`/rendicontazioni/print?type=${emp.type}&id=${emp.id}&month=${this.month()}`, '_blank');
  }

  // ── Helpers ───────────────────────────────────────────────────
  formatAmount(n: number | null | undefined): string {
    return Number(n ?? 0).toFixed(2);
  }

  balanceClass(b: number): string {
    return b < 0 ? 'neg' : b > 0 ? 'pos' : 'zero';
  }

  woLabel(wo: WorkOrderDto): string {
    return wo.type === 'percentage'
      ? `${wo.percentageRate}% di €${Number(wo.baseAmount ?? 0).toFixed(2)}`
      : 'Fisso';
  }
}
