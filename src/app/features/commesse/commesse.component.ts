import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { switchMap, catchError, EMPTY } from 'rxjs';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/toast.service';
import { AuthService } from '../../auth/auth.service';
import { CommesseApiService, CommessaDto, ClientDto, CreateCommessaPayload } from '../../commesse/commesse-api.service';
import { TimesheetApiService } from '../../timesheet/timesheet-api.service';

function currentMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

@Component({
  selector: 'app-commesse',
  imports: [IconComponent, FormsModule],
  templateUrl: './commesse.component.html',
  styleUrl: './commesse.component.css',
})
export class CommesseComponent {
  private readonly api = inject(CommesseApiService);
  private readonly timesheetApi = inject(TimesheetApiService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');
  readonly month = signal(currentMonthIso());

  // ── Catalog list ──────────────────────────────────────────────
  readonly items = signal<CommessaDto[]>([]);
  readonly loading = signal(true);
  readonly showInactive = signal(false);

  constructor() {
    toObservable(this.showInactive).pipe(
      switchMap(all => {
        this.loading.set(true);
        return this.api.findAll(all).pipe(catchError(() => {
          this.loading.set(false);
          return EMPTY;
        }));
      }),
      takeUntilDestroyed(),
    ).subscribe(data => {
      this.items.set(data);
      this.loading.set(false);
    });
  }

  reload() {
    this.loading.set(true);
    this.api.findAll(this.showInactive()).subscribe({
      next: data => { this.items.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  // ── Add to timesheet (employee) ───────────────────────────────
  readonly addingId = signal<number | null>(null);
  readonly baseAmountPendingItem = signal<CommessaDto | null>(null);
  baseAmountInput = '';

  addToTimesheet(item: CommessaDto) {
    if (this.addingId() !== null) return;
    if (item.type === 'percentage' && item.formulaType !== 'client_revenue') {
      this.baseAmountInput = '';
      this.baseAmountPendingItem.set(item);
      return;
    }
    this.doAddToTimesheet(item, undefined);
  }

  confirmBaseAmount() {
    const item = this.baseAmountPendingItem();
    if (!item) return;
    const v = parseFloat(this.baseAmountInput);
    if (isNaN(v) || v < 0) { this.toast.error('Inserisci un importo valido'); return; }
    this.baseAmountPendingItem.set(null);
    this.doAddToTimesheet(item, v);
  }

  private doAddToTimesheet(item: CommessaDto, baseAmount: number | undefined) {
    this.addingId.set(Number(item.id));
    this.timesheetApi.addItem(this.month(), Number(item.id), baseAmount).subscribe({
      next: () => {
        this.addingId.set(null);
        this.toast.success(`"${item.title}" aggiunta al tuo timesheet`);
      },
      error: (err) => {
        this.addingId.set(null);
        this.toast.error(err?.error?.message ?? 'Errore durante l\'aggiunta');
      },
    });
  }

  baseAmountPreview(): string {
    const item = this.baseAmountPendingItem();
    if (!item) return '0.00';
    return ((parseFloat(this.baseAmountInput) || 0) * Number(item.percentageRate ?? 0) / 100).toFixed(2);
  }

  // ── Admin: create / edit ──────────────────────────────────────
  readonly showForm = signal(false);
  readonly editingItem = signal<CommessaDto | null>(null);
  readonly saving = signal(false);
  readonly clients = signal<ClientDto[]>([]);

  form: CreateCommessaPayload & { isActive?: boolean } = {
    title: '',
    description: '',
    type: 'fixed',
    fixedAmount: undefined,
    percentageRate: undefined,
    baseAmount: undefined,
    formulaType: 'manual',
    formulaClientId: undefined,
  };

  openCreate() {
    this.editingItem.set(null);
    this.form = { title: '', description: '', type: 'fixed', fixedAmount: undefined, percentageRate: undefined, baseAmount: undefined, formulaType: 'manual', formulaClientId: undefined };
    this.loadClients();
    this.showForm.set(true);
  }

  openEdit(item: CommessaDto) {
    this.editingItem.set(item);
    this.form = {
      title: item.title,
      description: item.description ?? '',
      type: item.type,
      fixedAmount: item.fixedAmount ?? undefined,
      percentageRate: item.percentageRate ?? undefined,
      baseAmount: item.baseAmount ?? undefined,
      formulaType: item.formulaType ?? 'manual',
      formulaClientId: item.formulaClientId ?? undefined,
      isActive: item.isActive,
    };
    this.loadClients();
    this.showForm.set(true);
  }

  private loadClients() {
    if (this.clients().length > 0) return;
    this.api.findClients().subscribe({ next: list => this.clients.set(list) });
  }

  closeForm() { this.showForm.set(false); }

  save() {
    if (!this.form.title.trim()) { this.toast.error('Titolo obbligatorio'); return; }
    this.saving.set(true);
    const payload = { ...this.form };
    if (!payload.description) delete payload.description;

    const editing = this.editingItem();
    const obs = editing
      ? this.api.update(editing.id, payload)
      : this.api.create(payload as CreateCommessaPayload);

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.toast.success(editing ? 'Commessa aggiornata' : 'Commessa creata');
        this.reload();
      },
      error: () => { this.saving.set(false); this.toast.error('Errore durante il salvataggio'); },
    });
  }

  toggleActive(item: CommessaDto) {
    this.api.update(item.id, { isActive: !item.isActive }).subscribe({
      next: () => this.reload(),
      error: () => this.toast.error('Errore'),
    });
  }

  readonly deletingId = signal<number | null>(null);

  remove(item: CommessaDto) {
    if (!confirm(`Eliminare "${item.title}"?`)) return;
    this.deletingId.set(item.id);
    this.api.remove(item.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.toast.success('Commessa eliminata');
        this.reload();
      },
      error: () => { this.deletingId.set(null); this.toast.error('Errore durante l\'eliminazione'); },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────
  readonly Number = Number;

  computedPreview(): number {
    if (this.form.type === 'fixed') return this.form.fixedAmount ?? 0;
    return Math.round((this.form.baseAmount ?? 0) * (this.form.percentageRate ?? 0) / 100 * 100) / 100;
  }

  toFixed(n: number | null | undefined): string {
    return Number(n ?? 0).toFixed(2);
  }

  typeLabel(item: CommessaDto): string {
    if (item.type === 'fixed') return 'Fisso';
    if (item.formulaType === 'client_revenue') {
      const clientName = this.clients().find(c => Number(c.id) === Number(item.formulaClientId))?.name ?? `cliente #${item.formulaClientId}`;
      return `${item.percentageRate}% fatturato ${clientName}`;
    }
    return `${item.percentageRate}% di €${Number(item.baseAmount ?? 0).toFixed(2)}`;
  }
}
