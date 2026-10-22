import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AreaClienteApiService, ClientSaleDto } from './area-cliente-api.service';
import { IconComponent } from '../../shared/icon.component';
import { SegmentedComponent, SegOption } from '../../shared/segmented.component';
import { formatEuro } from '../../shared/format';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  // start_date è "YYYY-MM-DD": lo formattiamo senza passare da Date per evitare slittamenti di fuso
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtEuro(v: number): string {
  return formatEuro(v, Number.isInteger(v) ? 0 : 2);
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  balance_active: { label: 'Attivo', cls: 'active' },
  deposit_paid: { label: 'Acconto pagato', cls: 'deposit' },
  completed: { label: 'Saldato', cls: 'completed' },
};

const INST_STATUS: Record<string, { label: string; cls: string }> = {
  paid: { label: 'Pagata', cls: 'paid' },
  pending: { label: 'In attesa', cls: 'pending' },
  draft: { label: 'Da pagare', cls: 'draft' },
  failed: { label: 'Fallita', cls: 'failed' },
};

interface CustomerRow {
  sale: ClientSaleDto;
  name: string;
  email: string | null;
  phone: string | null;
  course: string;
  seller: string;
  startDate: string | null;
  unlockInstallment: number | null;
  paid: number;
  total: number;
  paidCount: number;
  rateCount: number;
}

type DateFilter = 'all' | 'upcoming' | 'missing' | 'past';
type SortKey = 'start' | 'purchase' | 'name';

@Component({
  selector: 'app-area-cliente-clienti',
  imports: [IconComponent, SegmentedComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="header-left">
          <app-icon name="users" [size]="20" />
          <h1>Le mie clienti</h1>
        </div>
        <span class="count-badge">{{ rows().length }} clienti</span>
      </div>

      @if (salesResource.isLoading()) {
        <div class="loading-state"><span class="spinner"></span> Caricamento…</div>
      } @else if (salesResource.error()) {
        <div class="error-banner"><app-icon name="alertTriangle" [size]="16" /> Errore nel caricamento</div>
      } @else {
        <div class="summary">
          <div class="summary-item">
            <span class="summary-value">{{ counts().upcoming }}</span>
            <span class="summary-label">Affiancamenti in programma</span>
          </div>
          <div class="summary-item">
            <span class="summary-value">{{ counts().missing }}</span>
            <span class="summary-label">In attesa della rata di sblocco</span>
          </div>
          <div class="summary-item">
            <span class="summary-value">{{ counts().past }}</span>
            <span class="summary-label">Affiancamenti già iniziati</span>
          </div>
        </div>

        <div class="toolbar-row">
          <label class="search-box">
            <app-icon name="search" [size]="15" />
            <span class="sr-only">Cerca cliente</span>
            <input
              type="search"
              placeholder="Cerca per nome, email, telefono o venditrice"
              [value]="query()"
              (input)="query.set($any($event.target).value)"
            />
          </label>
          <app-segmented [value]="dateFilter()" [options]="filterOptions" (changed)="dateFilter.set($any($event))" />
          <label class="sort-select">
            <span>Ordina per</span>
            <select [value]="sortKey()" (change)="sortKey.set($any($event.target).value)">
              <option value="start">Data affiancamento</option>
              <option value="purchase">Data acquisto</option>
              <option value="name">Nome</option>
            </select>
          </label>
        </div>

        @if (visibleRows().length === 0) {
          <div class="empty-page">
            <app-icon name="users" [size]="32" />
            <p>Nessuna cliente trovata</p>
          </div>
        } @else {
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th scope="col">Cliente</th>
                  <th scope="col">Telefono</th>
                  <th scope="col">Percorso</th>
                  <th scope="col">Venditrice</th>
                  <th scope="col">Acquisto</th>
                  <th scope="col">Inizio affiancamento</th>
                  <th scope="col" class="text-right">Pagato</th>
                  <th scope="col">Stato</th>
                </tr>
              </thead>
              <tbody>
                @for (row of visibleRows(); track row.sale.id) {
                  <tr class="main-row" [class.open]="openId() === row.sale.id" (click)="toggle(row.sale.id)">
                    <td>
                      <button
                        type="button"
                        class="name-btn"
                        [attr.aria-expanded]="openId() === row.sale.id"
                        (click)="$event.stopPropagation(); toggle(row.sale.id)"
                      >
                        <app-icon [name]="openId() === row.sale.id ? 'chevronD' : 'chevron'" [size]="14" />
                        <span class="name-block">
                          <span class="name">{{ row.name }}</span>
                          <span class="sub">{{ row.email ?? '—' }}</span>
                        </span>
                      </button>
                    </td>
                    <td class="nowrap">
                      @if (row.phone) {
                        <a class="phone-link" [href]="'tel:' + row.phone" (click)="$event.stopPropagation()">{{ row.phone }}</a>
                      } @else {
                        <span class="muted">—</span>
                      }
                    </td>
                    <td>{{ row.course }}</td>
                    <td class="nowrap">{{ row.seller }}</td>
                    <td class="nowrap muted">{{ fmtDate(row.sale.createdAt) }}</td>
                    <td class="nowrap">
                      @if (row.startDate) {
                        <span class="start-date" [class.future]="row.startDate >= today">{{ fmtDate(row.startDate) }}</span>
                      } @else {
                        <span class="pill missing">{{ row.unlockInstallment ? 'Alla rata ' + row.unlockInstallment : 'Da definire' }}</span>
                      }
                    </td>
                    <td class="text-right nowrap">
                      <span class="mono strong">€ {{ fmtEuro(row.paid) }}</span>
                      <span class="sub">su € {{ fmtEuro(row.total) }} · {{ row.paidCount }}/{{ row.rateCount }} rate</span>
                    </td>
                    <td>
                      @if (STATUS_BADGE[row.sale.status]; as s) {
                        <span class="pill" [class]="s.cls">{{ s.label }}</span>
                      } @else {
                        <span class="pill">{{ row.sale.status }}</span>
                      }
                    </td>
                  </tr>
                  @if (openId() === row.sale.id) {
                    <tr class="detail-row">
                      <td colspan="8">
                        <div class="detail">
                          <dl class="detail-grid">
                            <div><dt>Email</dt><dd>{{ row.email ?? '—' }}</dd></div>
                            <div><dt>Telefono</dt><dd>{{ row.phone ?? '—' }}</dd></div>
                            <div><dt>Venditrice</dt><dd>{{ row.seller }}</dd></div>
                            <div><dt>Piano</dt><dd>{{ row.sale.pricePlan?.name ?? '—' }}</dd></div>
                            <div><dt>Metodo di pagamento</dt><dd>{{ row.sale.paymentMethod }}</dd></div>
                            <div><dt>Inizio affiancamento</dt><dd>{{ row.startDate ? fmtDate(row.startDate) : (row.unlockInstallment ? 'Al pagamento della rata ' + row.unlockInstallment : 'Da definire') }}</dd></div>
                          </dl>

                          @if (row.sale.installments.length) {
                            <table class="inst-table">
                              <caption class="inst-title">Pagamenti</caption>
                              <thead>
                                <tr>
                                  <th scope="col">Rata</th>
                                  <th scope="col">Scadenza</th>
                                  <th scope="col">Pagata il</th>
                                  <th scope="col" class="text-right">Importo</th>
                                  <th scope="col">Stato</th>
                                </tr>
                              </thead>
                              <tbody>
                                @for (inst of sortedInstallments(row.sale); track inst.id) {
                                  <tr>
                                    <td>{{ inst.type === 'deposit' ? 'Acconto' : 'Rata ' + inst.installmentNumber }}</td>
                                    <td class="muted">{{ fmtDate(inst.dueDate) }}</td>
                                    <td class="muted">{{ fmtDate(inst.paymentDate) }}</td>
                                    <td class="text-right mono">€ {{ fmtEuro(+(inst.amount ?? 0)) }}</td>
                                    <td>
                                      @if (INST_STATUS[inst.status]; as s) {
                                        <span class="pill" [class]="s.cls">{{ s.label }}</span>
                                      }
                                    </td>
                                  </tr>
                                }
                              </tbody>
                            </table>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
          <div class="count-footer">{{ visibleRows().length }} di {{ rows().length }} clienti</div>
        }
      }
    </div>
  `,
  styles: [`
    .page-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 20px 24px 0; }
    .header-left { display: flex; align-items: center; gap: 10px; }
    .header-left h1 { font-size: 1.25rem; font-weight: 700; margin: 0; }
    .count-badge { font-size: 0.8rem; color: var(--ink-2); background: var(--surface-2); padding: 4px 10px; border-radius: 20px; }

    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; padding: 16px 24px 0; }
    .summary-item { display: flex; flex-direction: column; gap: 2px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; }
    .summary-value { font-size: 1.5rem; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; }
    .summary-label { font-size: 0.82rem; color: var(--ink-2); font-weight: 600; }
    .summary-item.warn { border-color: var(--accent); background: var(--accent-soft); }

    .toolbar-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 16px 24px 0; }
    .sort-select { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; color: var(--ink-2); }
    .sort-select select { background: var(--surface); color: var(--ink); border: 1px solid var(--border); border-radius: 8px; padding: 7px 10px; font-size: 0.85rem; }

    .table-wrap { margin: 16px 24px 0; overflow-x: auto; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
    .data-table { width: 100%; border-collapse: collapse; min-width: 960px; }
    .data-table th { padding: 10px 14px; background: var(--surface-2); font-size: 0.74rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--ink-2); text-align: left; white-space: nowrap; }
    .data-table td { padding: 12px 14px; border-top: 1px solid var(--border); font-size: 0.88rem; color: var(--ink); vertical-align: middle; }
    .main-row { cursor: pointer; }
    .main-row:hover td, .main-row.open td { background: var(--surface-2); }

    .name-btn { display: flex; align-items: center; gap: 8px; background: none; border: none; padding: 0; color: inherit; text-align: left; cursor: pointer; font: inherit; }
    .name-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px; }
    .name-block { display: flex; flex-direction: column; }
    .name { font-weight: 700; }
    .sub { display: block; font-size: 0.78rem; color: var(--ink-2); }
    .phone-link { color: var(--ink); text-decoration: none; }
    .phone-link:hover { text-decoration: underline; }
    .start-date { font-weight: 700; color: var(--ink-2); font-variant-numeric: tabular-nums; }
    .start-date.future { color: var(--accent); }

    .pill { display: inline-block; padding: 3px 9px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; background: var(--surface-2); color: var(--ink-2); white-space: nowrap; }
    .pill.missing { background: var(--accent-soft); color: var(--accent); }
    .pill.active, .pill.paid { background: color-mix(in srgb, #16a34a 16%, transparent); color: #15803d; }
    .pill.deposit, .pill.pending { background: color-mix(in srgb, #ca8a04 18%, transparent); color: #a16207; }
    .pill.completed { background: color-mix(in srgb, #4f46e5 16%, transparent); color: #4338ca; }
    .pill.failed { background: color-mix(in srgb, #dc2626 16%, transparent); color: #b91c1c; }
    :host-context([data-theme="dark"]) .pill.active, :host-context([data-theme="dark"]) .pill.paid { color: #4ade80; }
    :host-context([data-theme="dark"]) .pill.deposit, :host-context([data-theme="dark"]) .pill.pending { color: #facc15; }
    :host-context([data-theme="dark"]) .pill.completed { color: #a5b4fc; }
    :host-context([data-theme="dark"]) .pill.failed { color: #f87171; }

    .detail-row td { background: var(--surface-2); padding: 0; }
    .detail { padding: 14px 18px 18px 40px; }
    .detail-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px 20px; margin: 0 0 14px; }
    .detail-grid dt { font-size: 0.74rem; color: var(--ink-2); text-transform: uppercase; letter-spacing: .04em; font-weight: 600; }
    .detail-grid dd { margin: 2px 0 0; font-size: 0.88rem; color: var(--ink); word-break: break-word; }
    .inst-title { text-align: left; font-size: 0.78rem; font-weight: 700; color: var(--ink-2); text-transform: uppercase; letter-spacing: .04em; padding-bottom: 6px; }
    .inst-table { width: 100%; max-width: 720px; border-collapse: collapse; font-size: 0.85rem; background: var(--surface); border-radius: 8px; overflow: hidden; }
    .inst-table th { text-align: left; padding: 7px 10px; background: var(--surface); border-bottom: 1px solid var(--border); font-size: 0.74rem; color: var(--ink-2); }
    .inst-table td { padding: 7px 10px; border-top: 1px solid var(--border); }

    .muted { color: var(--ink-2); }
    .mono { font-variant-numeric: tabular-nums; }
    .strong { font-weight: 700; }
    .nowrap { white-space: nowrap; }
    .text-right { text-align: right; }
    .count-footer { padding: 12px 24px 24px; font-size: 0.82rem; color: var(--ink-2); }
    .loading-state { display: flex; align-items: center; gap: 10px; padding: 40px 24px; color: var(--ink-2); }
    .error-banner { display: flex; align-items: center; gap: 8px; margin: 20px 24px 0; padding: 12px 16px; background: color-mix(in srgb, #dc2626 12%, transparent); border: 1px solid color-mix(in srgb, #dc2626 35%, transparent); border-radius: 8px; color: #dc2626; }
    .empty-page { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 24px; color: var(--ink-2); }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

    @media (max-width: 640px) {
      .page-header, .summary, .toolbar-row { padding-left: 16px; padding-right: 16px; }
      .table-wrap { margin-left: 16px; margin-right: 16px; }
      .count-footer { padding-left: 16px; padding-right: 16px; }
    }
  `],
})
export class AreaClienteClientiComponent {
  private readonly api = inject(AreaClienteApiService);

  readonly STATUS_BADGE = STATUS_BADGE;
  readonly INST_STATUS = INST_STATUS;
  readonly fmtDate = fmtDate;
  readonly fmtEuro = fmtEuro;
  readonly today = todayIso();

  readonly query = signal('');
  readonly dateFilter = signal<DateFilter>('all');
  readonly sortKey = signal<SortKey>('start');
  readonly openId = signal<number | null>(null);

  readonly filterOptions: SegOption[] = [
    { value: 'all', label: 'Tutte' },
    { value: 'upcoming', label: 'In programma' },
    { value: 'missing', label: 'In attesa' },
    { value: 'past', label: 'Già iniziati' },
  ];

  readonly salesResource = rxResource({
    stream: () => this.api.getSales(),
  });

  readonly rows = computed<CustomerRow[]>(() =>
    (this.salesResource.value() ?? []).map((sale) => {
      const c = sale.customer;
      const inst = (sale.installments ?? []).filter((i) => i.status !== 'failed');
      const paidInst = inst.filter((i) => i.status === 'paid');
      const sum = (arr: typeof inst) => arr.reduce((s, i) => s + Number(i.amount ?? 0), 0);
      // Data del proprio percorso (il BE restituisce solo quelle del cliente)
      const aff = sale.affiancamenti?.[0];
      const svc = sale.pricePlan?.serviceVariant?.service?.name;
      const variant = sale.pricePlan?.serviceVariant?.name;
      return {
        sale,
        name: [c?.name, c?.surname].filter(Boolean).join(' ') || c?.email || `Vendita #${sale.id}`,
        email: c?.email ?? null,
        phone: c?.phone ?? null,
        course: svc ? (variant ? `${svc} · ${variant}` : svc) : (sale.pricePlan?.name ?? '—'),
        seller: [sale.seller?.name, sale.seller?.lastName].filter(Boolean).join(' ') || '—',
        startDate: aff?.startDate ?? null,
        unlockInstallment: aff?.unlockInstallment ?? null,
        paid: sum(paidInst),
        total: sum(inst),
        paidCount: paidInst.length,
        rateCount: inst.length,
      };
    }),
  );

  readonly counts = computed(() => {
    const rows = this.rows();
    return {
      upcoming: rows.filter((r) => r.startDate && r.startDate >= this.today).length,
      missing: rows.filter((r) => !r.startDate).length,
      past: rows.filter((r) => r.startDate && r.startDate < this.today).length,
    };
  });

  readonly visibleRows = computed<CustomerRow[]>(() => {
    const q = this.query().toLowerCase().trim();
    const f = this.dateFilter();
    const filtered = this.rows().filter((r) => {
      if (f === 'upcoming' && !(r.startDate && r.startDate >= this.today)) return false;
      if (f === 'missing' && r.startDate) return false;
      if (f === 'past' && !(r.startDate && r.startDate < this.today)) return false;
      if (!q) return true;
      return [r.name, r.email, r.phone, r.seller].some((v) => (v ?? '').toLowerCase().includes(q));
    });
    return this.sortRows(filtered, this.sortKey());
  });

  toggle(id: number): void {
    this.openId.update((cur) => (cur === id ? null : id));
  }

  sortedInstallments(sale: ClientSaleDto) {
    return [...sale.installments].sort((a, b) => a.installmentNumber - b.installmentNumber);
  }

  private sortRows(rows: CustomerRow[], key: SortKey): CustomerRow[] {
    const byPurchase = (a: CustomerRow, b: CustomerRow) => b.sale.createdAt.localeCompare(a.sale.createdAt);
    return [...rows].sort((a, b) => {
      if (key === 'name') return a.name.localeCompare(b.name, 'it');
      if (key === 'purchase') return byPurchase(a, b);
      // Data affiancamento: prima le prossime (più vicine), poi quelle senza data, poi le passate (più recenti prima)
      const rank = (r: CustomerRow) => (!r.startDate ? 1 : r.startDate >= this.today ? 0 : 2);
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      if (ra === 0) return a.startDate!.localeCompare(b.startDate!);
      if (ra === 2) return b.startDate!.localeCompare(a.startDate!);
      return byPurchase(a, b);
    });
  }
}
