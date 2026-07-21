import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AuthService } from '../../auth/auth.service';
import { CommissionApiService, CommissionDto } from '../../commissions/commission-api.service';
import { SetterApiService } from '../../setter/setter-api.service';
import { Seller } from '../../models';
import { IconComponent } from '../../shared/icon.component';
import { AvatarComponent } from '../../shared/avatar.component';
import { StatCardComponent } from '../../shared/stat-card.component';
import { ProgressBarComponent } from '../../shared/progress-bar.component';
import { BarChartComponent, AreaChartComponent, DonutChartComponent } from '../../shared/charts.component';
import { SalesStateService } from '../../sales-state.service';
import { MonthNavComponent } from './month-nav.component';
import { eur, fmtDate } from '../../utils';

type CommFilterType = 'all' | 'seller' | 'setter';

const SELLER_COLORS = ['#4f46e5', '#0d9488', '#db8c0e', '#be185d', '#059669'];
const SETTER_COLORS = ['#7c3aed', '#9333ea', '#a855f7', '#6d28d9', '#8b5cf6'];
const IT_MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const IT_MONTHS_LONG = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

const COMM_TYPE: Record<string, { label: string; color: string }> = {
  percentuale: { label: '% fissa',       color: '#4f46e5' },
  scaglione:   { label: '% a scaglioni', color: '#0d9488' },
  fisso:       { label: 'Importo fisso', color: '#db8c0e' },
};

interface DealRow {
  id: string;
  personId: string;
  personType: 'seller' | 'setter' | 'mixed';
  sellerId: string | null;
  setterId: string | null;
  client: string;
  value: number;
  commType: string;
  rate: number | null;
  commission: number;
  date: string;
  month: string;
  comms: CommissionDto[];
}

interface LeaderboardEntry {
  seller: Seller;
  total: number;
}

function isoMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function isoCurrentMonth(): string {
  return isoMonth(new Date());
}

function last6Months(): Array<{ iso: string; label: string }> {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return { iso: isoMonth(d), label: IT_MONTHS[d.getMonth()] };
  });
}

function makeDisplaySeller(c: CommissionDto, colorIdx: number): Seller {
  const s = c.seller ?? c.setter;
  const name = [s?.name, s?.lastName].filter(Boolean).join(' ') || '—';
  const initials = ((s?.name ?? '').charAt(0) + (s?.lastName ?? '').charAt(0)).toUpperCase() || '??';
  const role = c.setter ? 'Setter' : 'Venditore';
  return { id: String(s?.id ?? 0), name, initials, color: SELLER_COLORS[colorIdx % SELLER_COLORS.length], role };
}

function makeSellerOnly(s: CommissionDto['seller'], colorIdx: number): Seller {
  const name = [s?.name, s?.lastName].filter(Boolean).join(' ') || '—';
  const initials = ((s?.name ?? '').charAt(0) + (s?.lastName ?? '').charAt(0)).toUpperCase() || '??';
  return { id: String(s?.id ?? 0), name, initials, color: SELLER_COLORS[colorIdx % SELLER_COLORS.length], role: 'Venditore' };
}

function makeSetterOnly(s: CommissionDto['setter'], colorIdx: number): Seller {
  const name = [s?.name, s?.lastName].filter(Boolean).join(' ') || '—';
  const initials = ((s?.name ?? '').charAt(0) + (s?.lastName ?? '').charAt(0)).toUpperCase() || '??';
  return { id: String(s?.id ?? 0), name, initials, color: SETTER_COLORS[colorIdx % SETTER_COLORS.length], role: 'Setter' };
}

function commsToDeal(saleId: number, salComms: CommissionDto[]): DealRow {
  const first = salComms[0];
  const commission = salComms.reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const value = Number(first.sale?.pricePlan?.totalAmount ?? 0);
  const clientName = [first.sale?.customer?.name, first.sale?.customer?.surname].filter(Boolean).join(' ') || '—';
  const date = first.sale?.createdAt ?? first.createdAt;
  const monthIdx = new Date(date).getMonth();
  const sorted = [...salComms].sort((a, b) => {
    const ai = a.installment;
    const bi = b.installment;
    if (ai?.type === 'deposit' && bi?.type !== 'deposit') return -1;
    if (bi?.type === 'deposit' && ai?.type !== 'deposit') return 1;
    return (ai?.installmentNumber ?? 0) - (bi?.installmentNumber ?? 0);
  });

  const hasSeller = salComms.some(c => !!c.seller);
  const hasSetter = salComms.some(c => !!c.setter);
  const personType: DealRow['personType'] = hasSeller && hasSetter ? 'mixed' : hasSetter ? 'setter' : 'seller';
  const primaryPerson = first.setter ?? first.seller;
  const sellerComm = salComms.find(c => !!c.seller);
  const setterComm = salComms.find(c => !!c.setter);

  const sellerPct = Number(sellerComm?.percentage ?? 0);
  const setterPct = Number(setterComm?.percentage ?? 0);
  const combinedPct = sellerPct + setterPct;

  return {
    id: String(saleId),
    personId: String(primaryPerson?.id ?? ''),
    personType,
    sellerId: sellerComm?.seller ? String(sellerComm.seller.id) : null,
    setterId: setterComm?.setter ? String(setterComm.setter.id) : null,
    client: clientName,
    value,
    commType: 'percentuale',
    rate: combinedPct > 0 ? combinedPct / 100 : null,
    commission,
    date,
    month: IT_MONTHS[monthIdx] ?? '',
    comms: sorted,
  };
}

function isCurrentMonth(inst: CommissionDto['installment']): boolean {
  const m = isoCurrentMonth();
  return !!(inst?.dueDate?.startsWith(m) || inst?.paymentDate?.startsWith(m));
}

// Returns the first balance installment (non-deposit, lowest installmentNumber) for a set of commissions
function firstBalanceInstOf(comms: CommissionDto[]): NonNullable<CommissionDto['installment']> | null {
  return comms
    .filter(c => c.installment?.type !== 'deposit' && c.installment != null)
    .sort((a, b) => (a.installment!.installmentNumber) - (b.installment!.installmentNumber))
    [0]?.installment ?? null;
}

function buildSaleMap(comms: CommissionDto[]): Map<number, CommissionDto[]> {
  const map = new Map<number, CommissionDto[]>();
  for (const c of comms) {
    if (!c.sale) continue;
    const id = c.sale.id;
    if (!map.has(id)) map.set(id, []);
    map.get(id)!.push(c);
  }
  return map;
}

function instStatusLabel(status: string): string {
  if (status === 'paid') return 'Pagata';
  if (status === 'failed') return 'Fallita';
  return 'In attesa';
}

function monthLongLabel(isoM: string): string {
  const [, mon] = isoM.split('-').map(Number);
  return IT_MONTHS_LONG[mon - 1] ?? isoM;
}

@Component({
  selector: 'app-commissions',
  imports: [
    IconComponent, AvatarComponent, StatCardComponent, ProgressBarComponent,
    BarChartComponent, AreaChartComponent, DonutChartComponent,
    MonthNavComponent,
  ],
  styleUrl: './commissions.component.css',
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>
            Provvigioni
            @if (isAdmin()) { <span class="muted-pill">team</span> }
          </h1>
          <p class="page-sub">
            {{ isAdmin() ? 'Provvigioni maturate dal team' : 'Le tue provvigioni maturate' }}
            · {{ monthLabel() }}
          </p>
        </div>
        <div class="head-actions">
          <div class="mode-toggle" role="group" aria-label="Modalità calcolo provvigioni">
            <button
              [class.active]="commMode() === 'per-rata'"
              (click)="commMode.set('per-rata')"
              aria-pressed="commMode() === 'per-rata'">
              Per rata
            </button>
            <button
              [class.active]="commMode() === 'prima-rata'"
              (click)="commMode.set('prima-rata')"
              aria-pressed="commMode() === 'prima-rata'">
              Prima rata
            </button>
          </div>
          <button class="btn-ghost">
            <app-icon name="external" [size]="16" />Esporta
          </button>
        </div>
      </div>

      @if (commMode() === 'prima-rata') {
        <div class="prima-rata-banner" role="status">
          <span class="prb-dot"></span>
          <span>
            Modalità <strong>Prima rata attiva</strong> — la provvigione totale è attribuita
            alla prima rata di ogni deal. Le rate successive mostrano €0.
          </span>
        </div>
      }

      <app-month-nav [(selected)]="selectedMonth" />

      @if (isAdmin()) {
        <div class="filter-bar">
          <div class="filter-tabs" role="tablist">
            <button role="tab" [class.active]="filterType() === 'all'" (click)="setFilter('all')">Tutti</button>
            <button role="tab" [class.active]="filterType() === 'seller'" (click)="setFilter('seller')">Venditori</button>
            <button role="tab" [class.active]="filterType() === 'setter'" (click)="setFilter('setter')">Setter</button>
          </div>
          @if (filterType() === 'seller') {
            <select class="filter-person-select"
              [value]="filterPersonId() ?? ''"
              (change)="filterPersonId.set(+$any($event.target).value || null)"
              aria-label="Filtra per venditore">
              <option value="">Tutti i venditori</option>
              @for (s of sellersList(); track s.id) {
                <option [value]="s.id">{{ [s.name, s.lastName].filter(Boolean).join(' ') }}</option>
              }
            </select>
          }
          @if (filterType() === 'setter') {
            <select class="filter-person-select"
              [value]="filterPersonId() ?? ''"
              (change)="filterPersonId.set(+$any($event.target).value || null)"
              aria-label="Filtra per setter">
              <option value="">Tutti i setter</option>
              @for (s of settersResource.value(); track s.id) {
                <option [value]="s.id">{{ [s.name, s.lastName].filter(Boolean).join(' ') }}</option>
              }
            </select>
          }
        </div>
      }

      <div class="stat-grid">
        <app-stat-card icon="euro" [label]="'Maturato — ' + monthLabel()" [value]="eurMaturato()" [trend]="9" [accent]="true" />
        <app-stat-card icon="clock" label="Da incassare" [value]="eurDaIncassare()" sub="pagamento in attesa" />
        <app-stat-card icon="chart" label="Totale anno" [value]="eurAnnoTot()" [trend]="14" />
        <app-stat-card icon="target" label="Tasso medio" [value]="tassoMedio()" sub="sul venduto" />
      </div>

      <!-- LEADERBOARD ADMIN -->
      @if (isAdmin() && leaderboard().length > 0) {
        <div class="card">
          <div class="card-head">
            <div class="card-title">Maturate dal team — {{ monthLabel() }}</div>
          </div>
          <div class="leaderboard">
            @for (entry of leaderboard(); track entry.seller.id) {
              <div class="lb-row">
                <app-avatar [seller]="entry.seller" [size]="34" />
                <div class="lb-name">{{ entry.seller.name }}<span>{{ entry.seller.role }}</span></div>
                <div class="lb-bar">
                  <div class="lb-fill"
                    [style.width]="lbWidth(entry.total)"
                    [style.background]="entry.seller.color">
                  </div>
                </div>
                <div class="lb-val">{{ eurFmt(entry.total) }}</div>
              </div>
            }
          </div>
        </div>
      }

      <!-- DEAL TABLE -->
      <div class="card">
        <div class="card-head">
          <div class="card-title">Dettaglio provvigioni — {{ monthLabel() }}</div>
          @if (commissionsResource.isLoading()) {
            <span class="card-sub">Caricamento…</span>
          } @else {
            <span class="card-sub">{{ filteredDeals().length }} deal</span>
          }
        </div>
        <div class="table-scroll">
          <div class="table table-deals" [class.adm]="isAdmin()">
            <div class="tr th">
              <span>Cliente</span>
              @if (isAdmin()) { <span>Venditore</span> }
              @if (isAdmin()) { <span>Setter</span> }
              <span>Tipo</span>
              <span class="r">Valore deal</span>
              <span class="r">Tasso</span>
              <span class="r">Provvigione</span>
            </div>

            @for (d of filteredDeals(); track d.id) {
              <div class="tr-group">
                <!-- main deal row -->
                <div
                  class="tr"
                  role="button"
                  tabindex="0"
                  (click)="toggleDeal(d.id)"
                  (keydown.enter)="toggleDeal(d.id)"
                  (keydown.space)="$event.preventDefault(); toggleDeal(d.id)"
                  [attr.aria-expanded]="isDealExpanded(d.id)"
                >
                  <span class="td-strong" style="display:flex;align-items:center;gap:6px">
                    <button
                      class="expand-btn"
                      (click)="$event.stopPropagation(); toggleDeal(d.id)"
                      [attr.aria-label]="isDealExpanded(d.id) ? 'Comprimi rate' : 'Espandi rate'"
                    >
                      <span class="expand-icon" [class.open]="isDealExpanded(d.id)">
                        <app-icon name="chevron" [size]="13" />
                      </span>
                    </button>
                    {{ d.client }}
                    @if (d.comms.length > 0) {
                      <span style="font-size:11px;color:var(--ink-3);font-weight:400">({{ d.comms.length }} rate)</span>
                    }
                  </span>
                  @if (isAdmin()) {
                    <span class="td-seller">
                      @if (d.sellerId && displaySellerOnlyById()[d.sellerId]) {
                        <app-avatar [seller]="displaySellerOnlyById()[d.sellerId]" [size]="24" />
                        {{ displaySellerOnlyById()[d.sellerId].name.split(' ')[0] }}
                      } @else {
                        <span class="td-empty">—</span>
                      }
                    </span>
                  }
                  @if (isAdmin()) {
                    <span class="td-seller">
                      @if (d.setterId && displaySetterOnlyById()[d.setterId]) {
                        <app-avatar [seller]="displaySetterOnlyById()[d.setterId]" [size]="24" />
                        {{ displaySetterOnlyById()[d.setterId].name.split(' ')[0] }}
                      } @else {
                        <span class="td-empty">—</span>
                      }
                    </span>
                  }
                  <span>
                    <span class="comm-tag"
                      [style.color]="commColor(d.commType)"
                      [style.background]="commColor(d.commType) + '14'">
                      {{ commLabel(d.commType) }}
                    </span>
                  </span>
                  <span class="r mono">{{ eurFmt(d.value) }}</span>
                  <span class="r mono muted">{{ d.rate ? (d.rate * 100).toFixed(0) + '%' : '—' }}</span>
                  <span class="r mono strong">{{ eurFmt(d.commission) }}</span>
                </div>

                <!-- expandable installment-commission sub-rows -->
                @if (isDealExpanded(d.id) && d.comms.length > 0) {
                  <div class="comm-panel" role="region" [attr.aria-label]="'Rate di ' + d.client">
                    @for (c of d.comms; track c.id) {
                      @let isPrimaRata = commMode() === 'prima-rata';
                      @let isFirstBal = isFirstBalanceInst(c);
                      @let isZeroRow = isPrimaRata && c.installment?.type !== 'deposit' && !isFirstBal;
                      <div
                        class="comm-inst-row"
                        [class.inst-current]="isCurrentMonthFn(c.installment) && !isPrimaRata"
                        [class.inst-deposit]="c.installment?.type === 'deposit' && !isCurrentMonthFn(c.installment)"
                        [class.inst-prima-rata]="isPrimaRata && isFirstBal"
                        [class.inst-zero]="isZeroRow"
                      >
                        <span class="inst-label">
                          @if (c.installment?.type === 'deposit') {
                            Acconto
                          } @else {
                            Rata {{ c.installment?.installmentNumber }}/{{ c.installment?.totalInstallment || d.comms.length }}
                          }
                          @if (!isPrimaRata && isCurrentMonthFn(c.installment)) {
                            <span class="current-tag">Questo mese</span>
                          }
                          @if (isPrimaRata && isFirstBal) {
                            <span class="prima-rata-tag">Commissione totale</span>
                          }
                          @if (isZeroRow) {
                            <span class="zero-tag">Inclusa in Rata 1</span>
                          }
                        </span>
                        <span class="inst-badge" [attr.data-status]="c.installment?.status">
                          {{ instStatusLabelFn(c.installment?.status ?? '') }}
                        </span>
                        @if (c.installment?.amount) {
                          <span class="inst-amount" [class.muted]="isZeroRow">
                            {{ eurFmt(+(c.installment!.amount ?? 0)) }}
                          </span>
                        } @else {
                          <span></span>
                        }
                        @if (isPrimaRata && c.installment?.type !== 'deposit') {
                          <span class="comm-amount" [class.comm-prima-rata-full]="isFirstBal" [class.comm-zero]="isZeroRow">
                            {{ eurFmt(primaRataCommDisplayAmount(c, d)) }}
                          </span>
                        } @else {
                          <span class="comm-amount">{{ eurFmt(+(c.amount ?? 0)) }}</span>
                        }
                        <span class="inst-date" [class.muted]="isZeroRow">
                          @if (c.installment?.status === 'paid' && c.installment?.paymentDate) {
                            Pag. {{ fmtDateFn(c.installment!.paymentDate!) }}
                          } @else if (c.installment?.dueDate) {
                            Scad. {{ fmtDateFn(c.installment!.dueDate!) }}
                          }
                        </span>
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class CommissionsComponent {
  private readonly auth = inject(AuthService);
  private readonly commissionApiService = inject(CommissionApiService);
  private readonly setterApi = inject(SetterApiService);
  private readonly state = inject(SalesStateService);

  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');
  readonly chartType = this.state.chartType;

  // Fetch ALL commissions — filtered client-side for deal table; chart always shows last 6 months
  readonly commissionsResource = rxResource({ stream: () => this.commissionApiService.getAll() });
  readonly settersResource = rxResource({ stream: () => this.setterApi.getAll() });

  private readonly comms = computed(() => this.commissionsResource.value() ?? []);

  readonly selectedMonth = signal(isoCurrentMonth());
  readonly commMode = signal<'per-rata' | 'prima-rata'>('per-rata');

  // ── Filtri seller / setter ────────────────────────────────────────
  readonly filterType = signal<CommFilterType>('all');
  readonly filterPersonId = signal<number | null>(null);

  setFilter(type: CommFilterType): void {
    this.filterType.set(type);
    this.filterPersonId.set(null);
  }

  readonly sellersList = computed(() => {
    const seen = new Set<number>();
    const result: { id: number; name: string | null; lastName: string | null }[] = [];
    for (const c of this.comms()) {
      if (!c.seller || seen.has(c.seller.id)) continue;
      seen.add(c.seller.id);
      result.push(c.seller);
    }
    return result;
  });

  readonly monthLabel = computed(() => monthLongLabel(this.selectedMonth()));

  readonly Math = Math;
  readonly Boolean = Boolean;
  readonly eurFmt = eur;
  readonly fmtDateFn = fmtDate;
  readonly isCurrentMonthFn = isCurrentMonth;
  readonly instStatusLabelFn = instStatusLabel;

  readonly displaySellersById = computed<Record<string, Seller>>(() => {
    const seen = new Map<string, number>();
    const result: Record<string, Seller> = {};
    for (const c of this.comms()) {
      const person = c.setter ?? c.seller;
      if (!person) continue;
      const key = (c.setter ? 'set' : 'sel') + String(person.id);
      if (!seen.has(key)) seen.set(key, seen.size);
      result[String(person.id)] = makeDisplaySeller(c, seen.get(key)!);
    }
    return result;
  });

  readonly displaySellerOnlyById = computed<Record<string, Seller>>(() => {
    const seen = new Map<number, number>();
    const result: Record<string, Seller> = {};
    for (const c of this.comms()) {
      if (!c.seller) continue;
      const id = c.seller.id;
      if (!seen.has(id)) seen.set(id, seen.size);
      result[String(id)] = makeSellerOnly(c.seller, seen.get(id)!);
    }
    return result;
  });

  readonly displaySetterOnlyById = computed<Record<string, Seller>>(() => {
    const seen = new Map<number, number>();
    const result: Record<string, Seller> = {};
    for (const c of this.comms()) {
      if (!c.setter) continue;
      const id = c.setter.id;
      if (!seen.has(id)) seen.set(id, seen.size);
      result[String(id)] = makeSetterOnly(c.setter, seen.get(id)!);
    }
    return result;
  });

  // Commissions filtered by selected month + type + person
  private readonly filteredComms = computed(() => {
    const m = this.selectedMonth();
    const type = this.filterType();
    const personId = this.filterPersonId();

    return this.comms().filter(c => {
      const inst = c.installment;
      const inMonth = inst
        ? (inst.dueDate?.startsWith(m) || inst.paymentDate?.startsWith(m))
        : c.createdAt?.startsWith(m);
      if (!inMonth) return false;

      if (type === 'seller' && !c.seller) return false;
      if (type === 'setter' && !c.setter) return false;

      if (personId) {
        if (type === 'setter') return Number(c.setter?.id) === personId;
        return Number(c.seller?.id) === personId;
      }
      return true;
    });
  });

  // ── Per-rata deal grouping (current mode) ─────────────────────────
  private readonly filteredDealsPerRata = computed<DealRow[]>(() => {
    const saleMap = new Map<number, CommissionDto[]>();
    for (const c of this.filteredComms()) {
      if (!c.sale) continue;
      const id = c.sale.id;
      if (!saleMap.has(id)) saleMap.set(id, []);
      saleMap.get(id)!.push(c);
    }
    return [...saleMap.entries()]
      .map(([id, salComms]) => commsToDeal(id, salComms))
      .sort((a, b) => b.commission - a.commission);
  });

  // ── Prima-rata deal grouping ───────────────────────────────────────
  // A deal belongs to the month of its first balance installment (not any installment)
  private readonly filteredDealsPrimaRata = computed<DealRow[]>(() => {
    const m = this.selectedMonth();
    const type = this.filterType();
    const personId = this.filterPersonId();

    const saleMap = new Map<number, CommissionDto[]>();
    for (const c of this.comms()) {
      if (!c.sale) continue;
      if (type === 'seller' && !c.seller) continue;
      if (type === 'setter' && !c.setter) continue;
      if (personId) {
        if (type === 'setter' && Number(c.setter?.id) !== personId) continue;
        if (type !== 'setter' && Number(c.seller?.id) !== personId) continue;
      }
      const id = c.sale.id;
      if (!saleMap.has(id)) saleMap.set(id, []);
      saleMap.get(id)!.push(c);
    }

    const deals: DealRow[] = [];
    for (const [id, salComms] of saleMap.entries()) {
      const firstBal = firstBalanceInstOf(salComms);
      // Fall back to deposit if no balance installment exists (deposit-only deal)
      const pivotInst = firstBal ?? salComms.find(c => c.installment)?.installment ?? null;
      if (!pivotInst) continue;
      const inMonth = pivotInst.dueDate?.startsWith(m) || pivotInst.paymentDate?.startsWith(m);
      if (!inMonth) continue;
      deals.push(commsToDeal(id, salComms));
    }
    return deals.sort((a, b) => b.commission - a.commission);
  });

  // Mode-aware deal list (used by template and other computeds)
  readonly filteredDeals = computed<DealRow[]>(() =>
    this.commMode() === 'prima-rata' ? this.filteredDealsPrimaRata() : this.filteredDealsPerRata()
  );

  // ── Chart ─────────────────────────────────────────────────────────
  private readonly seriesPerRata = computed(() =>
    last6Months().map(({ iso, label }) => ({
      m: label,
      v: this.comms()
        .filter(c => c.installment?.status === 'paid' && c.installment.paymentDate?.startsWith(iso))
        .reduce((s, c) => s + Number(c.amount ?? 0), 0),
    }))
  );

  private readonly seriesPrimaRata = computed(() => {
    const saleMap = buildSaleMap(this.comms());
    return last6Months().map(({ iso, label }) => {
      let v = 0;
      for (const salComms of saleMap.values()) {
        const firstBal = firstBalanceInstOf(salComms);
        if (firstBal?.status === 'paid' && firstBal.paymentDate?.startsWith(iso)) {
          v += salComms
            .filter(c => c.installment?.type !== 'deposit')
            .reduce((s, c) => s + Number(c.amount ?? 0), 0);
        }
      }
      return { m: label, v };
    });
  });

  readonly series = computed(() =>
    this.commMode() === 'prima-rata' ? this.seriesPrimaRata() : this.seriesPerRata()
  );

  // ── Stats per selected month ───────────────────────────────────────
  private readonly maturatoPR = computed(() =>
    this.filteredComms()
      .filter(c => c.installment?.status === 'paid')
      .reduce((s, c) => s + Number(c.amount ?? 0), 0)
  );

  private readonly maturatoPrimaRata = computed(() => {
    const m = this.selectedMonth();
    return this.filteredDealsPrimaRata().reduce((total, d) => {
      const firstBal = firstBalanceInstOf(d.comms);
      if (firstBal?.status === 'paid' && firstBal.paymentDate?.startsWith(m)) {
        total += d.comms
          .filter(c => c.installment?.type !== 'deposit')
          .reduce((s, c) => s + Number(c.amount ?? 0), 0);
      }
      // Deposit commissions follow per-rata even in prima-rata mode
      total += d.comms
        .filter(c => c.installment?.type === 'deposit' &&
          c.installment.status === 'paid' && c.installment.paymentDate?.startsWith(m))
        .reduce((s, c) => s + Number(c.amount ?? 0), 0);
      return total;
    }, 0);
  });

  readonly maturato = computed(() =>
    this.commMode() === 'prima-rata' ? this.maturatoPrimaRata() : this.maturatoPR()
  );

  private readonly daIncassarePR = computed(() =>
    this.filteredComms()
      .filter(c => c.installment?.status === 'draft')
      .reduce((s, c) => s + Number(c.amount ?? 0), 0)
  );

  private readonly daIncassarePrimaRata = computed(() =>
    this.filteredDealsPrimaRata().reduce((total, d) => {
      const firstBal = firstBalanceInstOf(d.comms);
      if (firstBal && firstBal.status !== 'paid') {
        total += d.comms
          .filter(c => c.installment?.type !== 'deposit')
          .reduce((s, c) => s + Number(c.amount ?? 0), 0);
      }
      total += d.comms
        .filter(c => c.installment?.type === 'deposit' && c.installment.status === 'draft')
        .reduce((s, c) => s + Number(c.amount ?? 0), 0);
      return total;
    }, 0)
  );

  readonly daIncassare = computed(() =>
    this.commMode() === 'prima-rata' ? this.daIncassarePrimaRata() : this.daIncassarePR()
  );

  // ── Year total ─────────────────────────────────────────────────────
  private readonly annoTotPR = computed(() => {
    const year = String(new Date().getFullYear());
    return this.comms()
      .filter(c => c.installment?.status === 'paid' && c.installment.paymentDate?.startsWith(year))
      .reduce((s, c) => s + Number(c.amount ?? 0), 0);
  });

  private readonly annoTotPrimaRata = computed(() => {
    const year = String(new Date().getFullYear());
    let total = 0;
    for (const salComms of buildSaleMap(this.comms()).values()) {
      const firstBal = firstBalanceInstOf(salComms);
      if (firstBal?.status === 'paid' && firstBal.paymentDate?.startsWith(year)) {
        total += salComms
          .filter(c => c.installment?.type !== 'deposit')
          .reduce((s, c) => s + Number(c.amount ?? 0), 0);
      }
    }
    return total;
  });

  readonly annoTot = computed(() =>
    this.commMode() === 'prima-rata' ? this.annoTotPrimaRata() : this.annoTotPR()
  );

  readonly totalCommission = computed(() => this.filteredDeals().reduce((s, d) => s + d.commission, 0));
  readonly dealVal = computed(() => this.filteredDeals().reduce((s, d) => s + d.value, 0));

  readonly tassoMedio = computed(() => {
    const v = this.dealVal();
    return v ? ((this.totalCommission() / v) * 100).toFixed(1) + '%' : '0%';
  });

  readonly target = computed(() => this.isAdmin() ? 18000 : 6000);
  readonly targetPct = computed(() => Math.round((this.maturato() / this.target()) * 100));
  readonly maxCommission = computed(() =>
    this.filteredDeals().length ? Math.max(...this.filteredDeals().map(d => d.commission)) : 0
  );

  readonly eurMaturato = computed(() => eur(this.maturato()));
  readonly eurDaIncassare = computed(() => eur(this.daIncassare()));
  readonly eurAnnoTot = computed(() => eur(this.annoTot()));

  readonly byType = computed(() =>
    Object.keys(COMM_TYPE)
      .map(k => ({
        key: k,
        label: COMM_TYPE[k].label,
        color: COMM_TYPE[k].color,
        v: this.filteredDeals().filter(d => d.commType === k).reduce((s, d) => s + d.commission, 0),
      }))
      .filter(s => s.v > 0)
  );

  readonly donutSlices = computed(() => this.byType().map(s => ({ v: s.v, color: s.color })));

  readonly leaderboard = computed<LeaderboardEntry[]>(() => {
    if (!this.isAdmin()) return [];
    const sellersById = this.displaySellersById();
    const totals = new Map<string, number>();
    for (const deal of this.filteredDeals()) {
      for (const c of deal.comms) {
        const person = c.seller ?? c.setter;
        if (!person) continue;
        totals.set(String(person.id), (totals.get(String(person.id)) ?? 0) + Number(c.amount ?? 0));
      }
    }
    return [...totals.entries()]
      .map(([pid, total]) => ({ seller: sellersById[pid], total }))
      .filter((e): e is LeaderboardEntry => e.seller !== undefined)
      .sort((a, b) => b.total - a.total);
  });

  // Tree expansion state
  readonly expandedDeals = signal(new Set<string>());

  toggleDeal(id: string): void {
    this.expandedDeals.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  isDealExpanded(id: string): boolean {
    return this.expandedDeals().has(id);
  }

  pct(v: number): number { return Math.round(v / (this.totalCommission() || 1) * 100); }
  commColor(type: string): string { return COMM_TYPE[type]?.color ?? '#666'; }
  commLabel(type: string): string { return COMM_TYPE[type]?.label ?? type; }

  lbWidth(total: number): string {
    const max = Math.max(...this.leaderboard().map(e => e.total), 1);
    return (total / max * 100) + '%';
  }

  // Returns the commission amount to display for a row in prima-rata mode.
  // First balance installment → full balance commission for that person.
  // Subsequent balance installments → 0 (included in the first).
  // Deposit installments → unchanged.
  primaRataCommDisplayAmount(c: CommissionDto, d: DealRow): number {
    if (c.installment?.type === 'deposit') return Number(c.amount ?? 0);
    const personId = c.seller?.id ?? c.setter?.id;
    const isSeller = !!c.seller;
    const personTotal = d.comms
      .filter(x =>
        x.installment?.type !== 'deposit' &&
        (isSeller ? x.seller?.id === personId : x.setter?.id === personId))
      .reduce((s, x) => s + Number(x.amount ?? 0), 0);
    return c.installment?.installmentNumber === 1 ? personTotal : 0;
  }

  isFirstBalanceInst(c: CommissionDto): boolean {
    return c.installment?.type !== 'deposit' && c.installment?.installmentNumber === 1;
  }
}
