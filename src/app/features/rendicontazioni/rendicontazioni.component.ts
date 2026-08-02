import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, combineLatest, EMPTY, filter, forkJoin, switchMap } from 'rxjs';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/toast.service';
import { AuthService } from '../../auth/auth.service';
import {
  ReportingApiService,
  MonthlyReportDto,
  TimesheetItemLine,
  EmployeeInfo,
  ReportSummaryItem,
} from '../../reporting/reporting-api.service';
import { TimesheetApiService, TimesheetDto, TimesheetStatus, AdminTimesheetSummary } from '../../timesheet/timesheet-api.service';
import { CommesseApiService, CommessaDto } from '../../commesse/commesse-api.service';
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
  imports: [IconComponent, BalanceModalComponent, FormsModule],
  templateUrl: './rendicontazioni.component.html',
  styleUrl: './rendicontazioni.component.css',
})
export class RendicontazioniComponent {
  private readonly api = inject(ReportingApiService);
  private readonly timesheetApi = inject(TimesheetApiService);
  private readonly commesseApi = inject(CommesseApiService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');

  // ── Mese ──────────────────────────────────────────────────────
  readonly month = signal(currentMonthIso());
  readonly monthLabel = computed(() => formatMonth(this.month()));
  prevMonth() { this.month.update(m => shiftMonth(m, -1)); }
  nextMonth() { this.month.update(m => shiftMonth(m, +1)); }

  // ── Admin: Tab ─────────────────────────────────────────────────
  readonly activeTab = signal<'riepilogo' | 'timesheets'>('riepilogo');

  // ── Admin: Riepilogo ───────────────────────────────────────────
  readonly summaryItems   = signal<ReportSummaryItem[]>([]);
  readonly summaryLoading = signal(true);
  readonly summaryError   = signal(false);

  readonly allEmployees = computed<EmployeeInfo[]>(() =>
    this.summaryItems().map(s => s.employee),
  );

  // ── Admin: Timesheets tab ──────────────────────────────────────
  readonly adminTimesheets   = signal<AdminTimesheetSummary[]>([]);
  readonly tsTabLoading      = signal(false);
  readonly tsTabError        = signal(false);
  readonly approvingId       = signal<number | null>(null);
  readonly revisionId        = signal<number | null>(null);
  readonly revisionNotes     = signal('');
  readonly showRevisionForm  = signal<number | null>(null);

  // ── Employee: timesheet ────────────────────────────────────────
  readonly myReport        = signal<MonthlyReportDto | null>(null);
  readonly myReportLoading = signal(false);
  readonly myReportError   = signal(false);
  readonly myTimesheet     = signal<TimesheetDto | null>(null);
  readonly myTsLoading     = signal(false);
  readonly myTsError       = signal(false);
  readonly submitting      = signal(false);

  readonly catalog     = signal<CommessaDto[]>([]);
  readonly showCatalog = signal(false);
  readonly addingId    = signal<number | null>(null);
  readonly removingId  = signal<number | null>(null);

  readonly baseAmountPendingItem = signal<CommessaDto | null>(null);
  baseAmountInput = '';

  constructor() {
    if (this.isAdmin()) {
      this.initAdminStreams();
    } else {
      this.initEmployeeStreams();
    }
  }

  private initAdminStreams() {
    toObservable(this.month).pipe(
      switchMap(m => {
        this.summaryLoading.set(true);
        this.summaryError.set(false);
        return this.api.getSummary(m).pipe(
          catchError(() => { this.summaryError.set(true); this.summaryLoading.set(false); return EMPTY; }),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe(data => { this.summaryItems.set(data); this.summaryLoading.set(false); });

    combineLatest([toObservable(this.month), toObservable(this.activeTab)]).pipe(
      filter(([, tab]) => tab === 'timesheets'),
      switchMap(([m]) => {
        this.tsTabLoading.set(true);
        this.tsTabError.set(false);
        return this.timesheetApi.listAll(m).pipe(
          catchError(() => { this.tsTabError.set(true); this.tsTabLoading.set(false); return EMPTY; }),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe(data => { this.adminTimesheets.set(data); this.tsTabLoading.set(false); });
  }

  private initEmployeeStreams() {
    const user = this.auth.currentUser();
    const sellerId = user?.sellerId;
    if (!sellerId) return;

    toObservable(this.month).pipe(
      switchMap(m => {
        this.myReportLoading.set(true);
        this.myTsLoading.set(true);
        this.myReportError.set(false);
        this.myTsError.set(false);
        return forkJoin([
          this.api.getReport('seller', sellerId, m).pipe(catchError(() => { this.myReportError.set(true); return EMPTY; })),
          this.timesheetApi.getMy(m).pipe(catchError(() => { this.myTsError.set(true); return EMPTY; })),
        ]);
      }),
      takeUntilDestroyed(),
    ).subscribe(([report, ts]) => {
      this.myReport.set(report);
      this.myReportLoading.set(false);
      this.myTimesheet.set(ts);
      this.myTsLoading.set(false);
    });
  }

  reloadEmployee() {
    const sellerId = this.auth.currentUser()?.sellerId;
    if (!sellerId) return;
    const m = this.month();
    forkJoin([this.api.getReport('seller', sellerId, m), this.timesheetApi.getMy(m)]).subscribe({
      next: ([report, ts]) => { this.myReport.set(report); this.myTimesheet.set(ts); },
    });
  }

  reloadSummary() {
    this.summaryLoading.set(true);
    this.api.getSummary(this.month()).subscribe({
      next: data => { this.summaryItems.set(data); this.summaryLoading.set(false); },
      error: () => { this.summaryError.set(true); this.summaryLoading.set(false); },
    });
  }

  reloadTsTab() {
    this.tsTabLoading.set(true);
    this.timesheetApi.listAll(this.month()).subscribe({
      next: data => { this.adminTimesheets.set(data); this.tsTabLoading.set(false); },
      error: () => { this.tsTabError.set(true); this.tsTabLoading.set(false); },
    });
  }

  // ── Admin: approve / request revision ─────────────────────────
  approveTimesheet(ts: AdminTimesheetSummary) {
    this.approvingId.set(ts.id);
    this.timesheetApi.updateStatus(Number(ts.id), 'approved').subscribe({
      next: () => { this.approvingId.set(null); this.toast.success('Timesheet approvato'); this.reloadTsTab(); this.reloadSummary(); },
      error: () => { this.approvingId.set(null); this.toast.error('Errore'); },
    });
  }

  openRevisionForm(tsId: number) {
    this.revisionNotes.set('');
    this.showRevisionForm.set(tsId);
  }

  submitRevision(ts: AdminTimesheetSummary) {
    this.revisionId.set(ts.id);
    this.timesheetApi.updateStatus(Number(ts.id), 'revision', this.revisionNotes()).subscribe({
      next: () => {
        this.revisionId.set(null);
        this.showRevisionForm.set(null);
        this.toast.success('Revisione richiesta');
        this.reloadTsTab();
        this.reloadSummary();
      },
      error: () => { this.revisionId.set(null); this.toast.error('Errore'); },
    });
  }

  // ── Employee: timesheet status ─────────────────────────────────
  readonly tsStatusLabel: Record<TimesheetStatus, string> = {
    draft: 'Bozza',
    ready: 'In revisione',
    approved: 'Approvato',
    revision: 'Richiesta revisione',
  };

  submitTimesheet() {
    const ts = this.myTimesheet();
    if (!ts) return;
    this.submitting.set(true);
    this.timesheetApi.updateStatus(Number(ts.id), 'ready').subscribe({
      next: updated => { this.submitting.set(false); this.myTimesheet.set(updated); this.toast.success('Timesheet inviato per revisione'); },
      error: () => { this.submitting.set(false); this.toast.error('Errore durante l\'invio'); },
    });
  }

  recallTimesheet() {
    const ts = this.myTimesheet();
    if (!ts) return;
    this.timesheetApi.updateStatus(Number(ts.id), 'draft').subscribe({
      next: updated => { this.myTimesheet.set(updated); this.toast.success('Timesheet riportato in bozza'); },
      error: () => this.toast.error('Errore'),
    });
  }

  // ── Employee: catalog / add items ──────────────────────────────
  openCatalog() {
    if (this.catalog().length === 0) {
      this.commesseApi.findAll().subscribe({
        next: items => { this.catalog.set(items); this.showCatalog.set(true); },
        error: () => this.toast.error('Errore nel caricamento catalogo'),
      });
    } else {
      this.showCatalog.set(true);
    }
  }

  addCatalogItem(item: CommessaDto) {
    if (item.type === 'percentage' && item.formulaType !== 'client_revenue') {
      this.baseAmountInput = '';
      this.baseAmountPendingItem.set(item);
      return;
    }
    this.doAddItem(item, undefined);
  }

  confirmBaseAmount() {
    const item = this.baseAmountPendingItem();
    if (!item) return;
    const v = parseFloat(this.baseAmountInput);
    if (isNaN(v) || v < 0) { this.toast.error('Inserisci un importo valido'); return; }
    this.baseAmountPendingItem.set(null);
    this.doAddItem(item, v);
  }

  private doAddItem(item: CommessaDto, baseAmount: number | undefined) {
    this.addingId.set(Number(item.id));
    this.timesheetApi.addItem(this.month(), Number(item.id), baseAmount).subscribe({
      next: () => { this.addingId.set(null); this.toast.success(`"${item.title}" aggiunta`); this.showCatalog.set(false); this.reloadEmployee(); },
      error: err => { this.addingId.set(null); this.toast.error(err?.error?.message ?? 'Errore durante l\'aggiunta'); },
    });
  }

  baseAmountPreview(): string {
    const item = this.baseAmountPendingItem();
    if (!item) return '0.00';
    return ((parseFloat(this.baseAmountInput) || 0) * Number(item.percentageRate ?? 0) / 100).toFixed(2);
  }

  removeTimesheetItem(itemId: number) {
    this.removingId.set(itemId);
    this.timesheetApi.removeItem(this.month(), itemId).subscribe({
      next: () => { this.removingId.set(null); this.reloadEmployee(); },
      error: () => { this.removingId.set(null); this.toast.error('Errore durante l\'eliminazione'); },
    });
  }

  // ── Admin: Dettaglio dipendente ────────────────────────────────
  readonly selectedEmployee = signal<EmployeeInfo | null>(null);
  readonly reportData    = signal<MonthlyReportDto | null>(null);
  readonly reportLoading = signal(false);
  readonly reportError   = signal(false);

  selectEmployee(emp: EmployeeInfo) {
    this.selectedEmployee.set(emp);
    this.activeTab.set('riepilogo');
    this.loadReport(emp);
  }

  closeDetail() { this.selectedEmployee.set(null); this.reportData.set(null); this.reportError.set(false); }

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

  // ── Balance modal ──────────────────────────────────────────────
  readonly showBalanceModal = signal(false);

  onBalanceSaved() { this.showBalanceModal.set(false); this.reloadReport(); this.reloadSummary(); }

  // ── Print ──────────────────────────────────────────────────────
  openPrint() {
    const emp = this.selectedEmployee();
    if (!emp) return;
    window.open(`/rendicontazioni/print?type=${emp.type}&id=${emp.id}&month=${this.month()}`, '_blank');
  }

  openMyPrint() {
    const user = this.auth.currentUser();
    if (!user?.sellerId) return;
    window.open(`/rendicontazioni/print?type=seller&id=${user.sellerId}&month=${this.month()}`, '_blank');
  }

  // ── Helpers ───────────────────────────────────────────────────
  formatAmount(n: number | null | undefined): string { return Number(n ?? 0).toFixed(2); }
  balanceClass(b: number): string { return b < 0 ? 'neg' : b > 0 ? 'pos' : 'zero'; }

  tsItemLabel(item: TimesheetItemLine): string {
    return item.type === 'percentage'
      ? `${item.percentageRate}% di €${Number(item.baseAmount ?? 0).toFixed(2)}`
      : 'Fisso';
  }

  tsSubtotal = computed(() =>
    (this.myTimesheet()?.items ?? []).reduce((s, i) => s + Number(i.computedAmount), 0),
  );

  myGrossTotal = computed(() => {
    const r = this.myReport();
    return Math.round((Number(r?.subtotalCommissions ?? 0) + this.tsSubtotal()) * 100) / 100;
  });

  adminTsTotal(ts: AdminTimesheetSummary): number {
    return (ts.items ?? []).reduce((s, i) => s + Number(i.computedAmount), 0);
  }

  sellerName(ts: AdminTimesheetSummary): string {
    if (!ts.seller) return '—';
    return [ts.seller.name, ts.seller.lastName].filter(Boolean).join(' ') || ts.seller.email || '—';
  }

  readonly adminTsStatusLabel: Record<string, string> = {
    draft: 'Bozza',
    ready: 'Pronto per revisione',
    approved: 'Approvato',
    revision: 'Revisione richiesta',
  };
}
