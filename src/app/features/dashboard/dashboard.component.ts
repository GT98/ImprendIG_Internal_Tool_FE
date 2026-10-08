import { Component, computed, inject, linkedSignal, signal, type ResourceRef } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { LeadsService } from '../../leads/lead.service';
import { SaleApiService } from '../../sales/sale-api.service';
import { CommissionApiService } from '../../commissions/commission-api.service';
import { Lead } from '../../leads/lead.model';
import { Seller } from '../../models';
import { AvatarComponent } from '../../shared/avatar.component';
import { StatCardComponent } from '../../shared/stat-card.component';
import { StatusBadgeComponent } from '../../shared/badge.component';
import { DonutChartComponent } from '../../shared/charts.component';
import { eur, fmtDate, fmtDateISO, type DateRange } from '../../utils';

const SELLER_COLORS = ['#4f46e5', '#0d9488', '#db8c0e', '#be185d', '#059669', '#3b82f6'];

const DA_FARE  = new Set(['novo', 'nuovo', 'in-corso', 'da-fare', 'programmata', '']);
const NO_SHOW  = new Set(['no-show', 'no_show']);
const ESCLUSI  = new Set(['annullato', 'non-qualificato', 'no-show', 'no_show']);

function leadCode(lead: Lead): string {
  return (lead.statusOption?.code ?? lead.status ?? '').toLowerCase().trim().replace(/_/g, '-');
}

function isExcluded(lead: Lead): boolean {
  return ESCLUSI.has(leadCode(lead));
}

function callCategory(lead: Lead): 'da-fare' | 'no-show' | 'fatta' {
  const code = leadCode(lead);
  if (DA_FARE.has(code)) return 'da-fare';
  if (NO_SHOW.has(code)) return 'no-show';
  return 'fatta';
}

interface SellerStats {
  seller: Seller;
  leads: number;
  fatte: number;
  sales: number;
  dealValue: number;
  commission: number;
}

function makeSeller(
  s: NonNullable<Lead['seller']>,
  idx: number,
): Seller {
  const name = [s.name, s.lastName].filter(Boolean).join(' ') || '—';
  const initials = ((s.name ?? '').charAt(0) + (s.lastName ?? '').charAt(0)).toUpperCase() || '??';
  return { id: String(s.id), name, initials, color: SELLER_COLORS[idx % SELLER_COLORS.length], role: 'Venditore' };
}

function isoCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

type Preset = 'month' | 'all';

function presetRange(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'month':
      return { from: fmtDateISO(new Date(y, m, 1)), to: fmtDateISO(new Date(y, m + 1, 0)) };
    case 'all':
      return { from: '', to: '' };
  }
}

/** Day (local, YYYY-MM-DD) of an ISO timestamp falls within [from, to]. */
function inRange(iso: string | null | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (!iso) return false;
  const day = fmtDateISO(new Date(iso));
  return (!from || day >= from) && (!to || day <= to);
}

/**
 * Keeps the last loaded value while the resource reloads for a new range,
 * so the dashboard doesn't flash empty. `undefined` only before the first load.
 */
function keepLast<T>(res: ResourceRef<T[] | undefined>) {
  return linkedSignal<T[] | undefined, T[] | undefined>({
    source: () => (res.hasValue() ? res.value() : undefined),
    computation: (value, prev) => value ?? (res.error() ? [] : prev?.value),
  });
}

@Component({
  selector: 'app-dashboard',
  imports: [AvatarComponent, StatCardComponent, StatusBadgeComponent, DonutChartComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  private readonly leadsService = inject(LeadsService);
  private readonly saleApiService = inject(SaleApiService);
  private readonly commissionApi = inject(CommissionApiService);

  // ── Date range filter (applied server-side) ─────────────────────────
  /** Applied range: drives the API calls. Changes only when both dates are set (or on reset). */
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  /** Values in the inputs; follow the applied range on preset/reset. */
  readonly draftFrom = linkedSignal(() => this.dateFrom());
  readonly draftTo = linkedSignal(() => this.dateTo());
  readonly draftIncomplete = computed(() => !this.draftFrom() !== !this.draftTo());
  readonly hasRange = computed(() => !!(this.dateFrom() || this.dateTo()));
  private readonly range = computed<DateRange>(() => ({
    from: this.dateFrom() || undefined,
    to: this.dateTo() || undefined,
  }));

  readonly presets: { value: Preset; label: string }[] = [
    { value: 'all', label: 'Tutto' },
    { value: 'month', label: 'Mese attuale' },
  ];

  readonly activePreset = computed<Preset | null>(() => {
    const from = this.dateFrom();
    const to = this.dateTo();
    return this.presets.find((p) => {
      const r = presetRange(p.value);
      return r.from === from && r.to === to;
    })?.value ?? null;
  });

  /** Human-readable active period; empty when no filter is set. */
  readonly rangeLabel = computed(() => {
    const from = this.dateFrom();
    const to = this.dateTo();
    if (!from && !to) return '';
    if (!to) return `Dal ${fmtDate(from)}`;
    if (!from) return `Fino al ${fmtDate(to)}`;
    return `${fmtDate(from)} – ${fmtDate(to)}`;
  });

  clearRange(): void {
    this.setPreset('all');
  }

  setDraft(field: 'from' | 'to', value: string): void {
    (field === 'from' ? this.draftFrom : this.draftTo).set(value);
    const from = this.draftFrom();
    const to = this.draftTo();
    if (from && to && from <= to) {
      this.dateFrom.set(from);
      this.dateTo.set(to);
    }
  }

  setPreset(preset: Preset): void {
    const r = presetRange(preset);
    this.dateFrom.set(r.from);
    this.dateTo.set(r.to);
  }

  readonly leadsResource = rxResource({
    params: () => this.range(),
    stream: ({ params }) => this.leadsService.getAll(params),
  });
  readonly salesResource = rxResource({
    params: () => this.range(),
    stream: ({ params }) => this.saleApiService.getAll(params),
  });
  readonly commissionsResource = rxResource({
    params: () => this.range(),
    stream: ({ params }) => this.commissionApi.getAll(undefined, params),
  });

  private readonly leadsData = keepLast(this.leadsResource);
  private readonly salesData = keepLast(this.salesResource);
  private readonly commissionsData = keepLast(this.commissionsResource);

  readonly isLoading = computed(
    () =>
      this.leadsResource.isLoading() ||
      this.salesResource.isLoading() ||
      this.commissionsResource.isLoading(),
  );

  /** Full-page loader only on the first load; range changes keep the current data visible. */
  readonly isFirstLoad = computed(
    () => !this.leadsData() || !this.salesData() || !this.commissionsData(),
  );

  readonly leadsError = computed(() => !!this.leadsResource.error());
  readonly leads = computed(() => this.leadsData() ?? []);
  /** Includes older sales returned only because an installment falls in the range. */
  private readonly allSales = computed(() => this.salesData() ?? []);
  /** Sales closed within the selected range. */
  readonly sales = computed(() =>
    this.allSales().filter((s) => inRange(s.createdAt, this.dateFrom(), this.dateTo())),
  );
  readonly commissions = computed(() => this.commissionsData() ?? []);

  readonly eurFmt = eur;
  readonly fmtDate = fmtDate;

  // ── Call outcome stats ─────────────────────────────────────────────
  readonly callsByCategory = computed(() => {
    const valid = this.leads().filter((l) => !isExcluded(l));
    return {
      daFare: valid.filter((l) => callCategory(l) === 'da-fare').length,
      fatta: valid.filter((l) => callCategory(l) === 'fatta').length,
      noShow: valid.filter((l) => callCategory(l) === 'no-show').length,
      total: valid.length,
    };
  });

  readonly callDonutSlices = computed(() => [
    { v: this.callsByCategory().fatta, color: '#10b981' },
    { v: this.callsByCategory().daFare, color: '#f59e0b' },
    { v: this.callsByCategory().noShow, color: '#ef4444' },
  ]);

  readonly callsByOutcome = computed(() => {
    const done = this.leads().filter((l) => callCategory(l) === 'fatta');
    const map = new Map<string, number>();
    for (const l of done) {
      const label = l.statusOption?.label ?? 'Senza esito';
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  });

  callOutcomeBarWidth(count: number): string {
    const max = Math.max(...this.callsByOutcome().map((o) => o.count), 1);
    return (count / max) * 100 + '%';
  }

  callPct(n: number): string {
    const tot = this.callsByCategory().total || 1;
    return Math.round((n / tot) * 100) + '%';
  }

  // ── Payment stats ──────────────────────────────────────────────────
  readonly installmentStats = computed(() => {
    const from = this.dateFrom();
    const to = this.dateTo();
    // Paid installments match on paymentDate, the others on dueDate (same rule as the BE).
    const allInst = this.allSales()
      .flatMap((s) => s.installments)
      .filter((i) => inRange(i.status === 'paid' ? i.paymentDate : i.dueDate, from, to));
    const paid = allInst.filter((i) => i.status === 'paid');
    const draft = allInst.filter((i) => i.status === 'draft');
    const failed = allInst.filter((i) => i.status === 'failed');
    const sumOf = (arr: typeof allInst) => arr.reduce((s, i) => s + Number(i.amount ?? 0), 0);
    return {
      paidCount: paid.length,
      paidAmount: sumOf(paid),
      draftCount: draft.length,
      draftAmount: sumOf(draft),
      failedCount: failed.length,
      failedAmount: sumOf(failed),
      total: allInst.length,
      totalAmount: sumOf(allInst),
    };
  });

  payBarWidth(amount: number): string {
    const tot = this.installmentStats().totalAmount || 1;
    return (amount / tot) * 100 + '%';
  }

  // ── KPIs ───────────────────────────────────────────────────────────
  readonly mrrTotal = computed(() =>
    this.sales().reduce((s, sale) => s + Number(sale.pricePlan?.installmentAmount ?? 0), 0),
  );

  readonly incassatoMese = computed(() => {
    if (this.hasRange()) return this.installmentStats().paidAmount;
    const m = isoCurrentMonth();
    return this.sales()
      .flatMap((s) => s.installments)
      .filter((i) => i.status === 'paid' && i.paymentDate?.startsWith(m))
      .reduce((s, i) => s + Number(i.amount ?? 0), 0);
  });

  readonly conversionRate = computed(() => {
    const fatte = this.callsByCategory().fatta;
    const deals = this.sales().length;
    return fatte ? Math.min(100, Math.round((deals / fatte) * 100)) : 0;
  });

  // ── Team performance ───────────────────────────────────────────────
  readonly teamStats = computed<SellerStats[]>(() => {
    const leads = this.leads();
    const sales = this.sales();
    const commissions = this.commissions();

    const sellerMap = new Map<number, { raw: Lead['seller']; idx: number }>();
    for (const l of leads) {
      if (l.seller && !sellerMap.has(l.seller.id)) {
        sellerMap.set(l.seller.id, { raw: l.seller, idx: sellerMap.size });
      }
    }
    for (const s of sales) {
      if (s.seller && !sellerMap.has(s.seller.id)) {
        sellerMap.set(s.seller.id, { raw: s.seller as Lead['seller'], idx: sellerMap.size });
      }
    }

    return [...sellerMap.entries()]
      .map(([id, { raw, idx }]) => {
        const sellerLeads = leads.filter((l) => l.seller?.id === id && !isExcluded(l));
        const sellerFatte = sellerLeads.filter((l) => callCategory(l) === 'fatta').length;
        const sellerSales = sales.filter((s) => s.seller?.id === id);
        const dealValue = sellerSales.reduce(
          (s, sale) => s + Number(sale.pricePlan?.totalAmount ?? 0),
          0,
        );
        const commission = commissions
          .filter((c) => c.seller?.id === id)
          .reduce((s, c) => s + Number(c.amount ?? 0), 0);
        return {
          seller: makeSeller(raw!, idx),
          leads: sellerLeads.length,
          fatte: sellerFatte,
          sales: sellerSales.length,
          dealValue,
          commission,
        };
      })
      .sort((a, b) => b.sales - a.sales);
  });

  conversionClass(sales: number, fatte: number): string {
    const rate = fatte ? sales / fatte : 0;
    if (rate >= 0.25) return 'good';
    if (rate >= 0.1) return 'mid';
    return 'low';
  }

  conversionLabel(sales: number, fatte: number): string {
    return fatte ? Math.round((sales / fatte) * 100) + '%' : '—';
  }

  // ── Recent deals ───────────────────────────────────────────────────
  readonly recentDeals = computed(() =>
    [...this.sales()]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6),
  );

  payStatus(sale: ReturnType<typeof this.sales>[number]): 'pagato' | 'pending' | 'fallito' {
    if (sale.status === 'completed') return 'pagato';
    const bal = sale.installments.filter((i) => i.type === 'balance');
    if (bal.some((i) => i.status === 'failed')) return 'fallito';
    if (bal.some((i) => i.status === 'paid')) return 'pagato';
    return 'pending';
  }
}
