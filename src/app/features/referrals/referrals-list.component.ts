import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ReferralApiService, ReferralDto, ReferrerDto } from '../../referral/referral-api.service';
import { CustomerApiService, CustomerDto } from '../../customers/customer-api.service';
import { AuthApiService } from '../../auth/auth-api.service';
import { ToastService } from '../../shared/toast.service';
import { IconComponent } from '../../shared/icon.component';

type Tab = 'referrers' | 'referrals';
type StatusFilter = 'all' | 'pending' | 'converted' | 'paid';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#f97316'];

function initials(name: string | null, surname: string | null): string {
  return ((name?.[0] ?? '') + (surname?.[0] ?? '')).toUpperCase() || '?';
}

function fullName(name: string | null, surname: string | null): string {
  return [name, surname].filter(Boolean).join(' ') || '—';
}

@Component({
  selector: 'app-referrals-list',
  imports: [FormsModule, IconComponent],
  templateUrl: './referrals-list.component.html',
  styleUrl: './referrals-list.component.css',
})
export class ReferralsListComponent {
  protected readonly COLORS = COLORS;
  protected readonly initials = initials;
  protected readonly fullName = fullName;
  protected readonly String = String;

  private readonly api = inject(ReferralApiService);
  private readonly customerApi = inject(CustomerApiService);
  private readonly authApi = inject(AuthApiService);
  private readonly toast = inject(ToastService);

  // ── Tab ─────────────────────────────────────────────────────────────────
  readonly activeTab = signal<Tab>('referrers');

  // ── Resources ────────────────────────────────────────────────────────────
  readonly customersResource = rxResource({
    params: () => true,
    stream: () => this.customerApi.getAll(),
  });

  readonly referrersResource = rxResource({
    params: () => true,
    stream: () => this.api.getReferrers(),
  });

  readonly referralsResource = rxResource({
    params: () => true,
    stream: () => this.api.getAll(),
  });

  readonly summaryResource = rxResource({
    params: () => true,
    stream: () => this.api.getSummary(),
  });

  readonly customers = computed(() => this.customersResource.value() ?? []);
  readonly referrers = computed(() => this.referrersResource.value() ?? []);
  readonly summary = computed(() => this.summaryResource.value());

  // Mappa customerId (stringa) → referrer per sapere chi ha già l'account
  readonly referrerByCustomerId = computed(() => {
    const map = new Map<string, ReferrerDto>();
    for (const r of this.referrers()) {
      if (r.customer) map.set(String(r.customer.id), r);
    }
    return map;
  });

  // ── Referrer tab: search ─────────────────────────────────────────────────
  readonly customerSearch = signal('');

  readonly filteredCustomers = computed(() => {
    const q = this.customerSearch().toLowerCase();
    if (!q) return this.customers();
    return this.customers().filter(c => {
      const text = `${c.name ?? ''} ${c.surname ?? ''} ${c.email ?? ''}`.toLowerCase();
      return text.includes(q);
    });
  });

  shareLink(token: string): string {
    return `${window.location.origin}/r/${token}`;
  }

  copyLink(token: string) {
    navigator.clipboard.writeText(this.shareLink(token))
      .then(() => this.toast.success('Link copiato!'));
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => this.toast.success('Link copiato!'));
  }

  // ── Create account modal ─────────────────────────────────────────────────
  readonly accountTarget = signal<CustomerDto | null>(null);
  readonly accPassword = signal('Imprendig2026!');
  readonly creatingAcc = signal(false);
  readonly newAccountResult = signal<{ email: string; shareLink: string } | null>(null);

  openCreateAccount(c: CustomerDto) {
    this.accountTarget.set(c);
    this.accPassword.set('Imprendig2026!');
    this.newAccountResult.set(null);
  }

  closeAccountModal() {
    this.accountTarget.set(null);
    this.newAccountResult.set(null);
  }

  submitCreateAccount() {
    const c = this.accountTarget();
    if (!c || this.accPassword().length < 6) return;
    this.creatingAcc.set(true);
    this.api.createAccount({ customerId: Number(c.id), password: this.accPassword() }).subscribe({
      next: result => {
        this.creatingAcc.set(false);
        this.newAccountResult.set(result);
        this.toast.success(`Account referral attivato per ${fullName(c.name, c.surname)}`);
        this.referrersResource.reload();
      },
      error: (e: { error?: { message?: string } }) => {
        this.creatingAcc.set(false);
        this.toast.error(e.error?.message ?? 'Errore durante la creazione');
      },
    });
  }

  // ── Deactivate ────────────────────────────────────────────────────────────
  readonly actingId = signal<number | null>(null);

  deactivateReferrer(referrer: ReferrerDto) {
    this.actingId.set(referrer.id);
    this.authApi.deactivate(referrer.id).subscribe({
      next: () => {
        this.actingId.set(null);
        this.toast.success('Accesso disattivato');
        this.referrersResource.reload();
      },
      error: () => { this.actingId.set(null); this.toast.error('Impossibile disattivare'); },
    });
  }

  // ── Referrals tab ─────────────────────────────────────────────────────────
  readonly statusFilter = signal<StatusFilter>('all');
  readonly filterOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Tutti' },
    { value: 'pending', label: 'In attesa' },
    { value: 'converted', label: 'Convertiti' },
    { value: 'paid', label: 'Pagati' },
  ];

  readonly filtered = computed(() => {
    const f = this.statusFilter();
    const all = this.referralsResource.value() ?? [];
    return f === 'all' ? all : all.filter(r => r.status === f);
  });

  readonly linkingSaleId = signal<number | null>(null);
  readonly saleInputs = signal<Record<number, string>>({});

  setSaleInput(referralId: number, val: string) {
    this.saleInputs.update(m => ({ ...m, [referralId]: val }));
  }

  linkSale(referral: ReferralDto) {
    const raw = this.saleInputs()[referral.id];
    const saleId = raw ? Number(raw) : null;
    if (!saleId) return;
    this.linkingSaleId.set(referral.id);
    this.api.update(referral.id, { saleId }).subscribe({
      next: () => {
        this.linkingSaleId.set(null);
        this.saleInputs.update(m => { const n = { ...m }; delete n[referral.id]; return n; });
        this.toast.success('Vendita collegata');
        this.referralsResource.reload();
        this.summaryResource.reload();
      },
      error: () => { this.linkingSaleId.set(null); this.toast.error('Errore nel collegamento'); },
    });
  }

  readonly markingPaidId = signal<number | null>(null);

  markPaid(referral: ReferralDto) {
    this.markingPaidId.set(referral.id);
    this.api.markPaid(referral.id).subscribe({
      next: () => {
        this.markingPaidId.set(null);
        this.toast.success('Segnato come pagato');
        this.referralsResource.reload();
        this.summaryResource.reload();
      },
      error: () => { this.markingPaidId.set(null); this.toast.error('Errore'); },
    });
  }

  removeReferral(referral: ReferralDto) {
    const name = referral.referredName ?? referral.referredEmail ?? 'questa referral';
    if (!confirm(`Eliminare la referral di ${name}?`)) return;
    this.api.remove(referral.id).subscribe({
      next: () => {
        this.toast.success('Referral eliminata');
        this.referralsResource.reload();
        this.summaryResource.reload();
      },
      error: () => this.toast.error('Errore durante l\'eliminazione'),
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  referrerDisplayName(r: ReferralDto): string {
    if (!r.referrer.customer) return r.referrer.id ? `User #${r.referrer.id}` : '—';
    return fullName(r.referrer.customer.name, r.referrer.customer.surname) ||
      (r.referrer.customer.email ?? '—');
  }

  statusLabel(status: ReferralDto['status']): string {
    return { pending: 'In attesa', converted: 'Convertita', paid: 'Pagata' }[status] ?? status;
  }

  statusClass(status: ReferralDto['status']): string {
    return { pending: 'badge--pending', converted: 'badge--converted', paid: 'badge--paid' }[status] ?? '';
  }

  formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('it-IT');
  }
}
