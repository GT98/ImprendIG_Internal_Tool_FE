import { Component, computed, inject, input, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AuthService } from '../../auth/auth.service';
import { SaleApiService, SaleDto, InstallmentDto } from '../../sales/sale-api.service';
import { Client, Seller } from '../../models';
import { IconComponent } from '../../shared/icon.component';
import { AvatarComponent } from '../../shared/avatar.component';
import { StatCardComponent } from '../../shared/stat-card.component';
import { StatusBadgeComponent } from '../../shared/badge.component';
import { SegmentedComponent } from '../../shared/segmented.component';
import { CreateSaleModalComponent } from './create-sale-modal.component';
import { eur, fmtDate } from '../../utils';

const SELLER_COLORS = ['#4f46e5', '#0d9488', '#db8c0e', '#be185d', '#059669'];

function makeDisplaySeller(s: SaleDto['seller'], colorIdx: number): Seller {
  const name = [s?.name, s?.lastName].filter(Boolean).join(' ') || '—';
  const initials = ((s?.name ?? '').charAt(0) + (s?.lastName ?? '').charAt(0)).toUpperCase() || '??';
  return { id: String(s?.id ?? 0), name, initials, color: SELLER_COLORS[colorIdx % SELLER_COLORS.length], role: 'Venditore' };
}

function derivePayStatus(installments: InstallmentDto[]): 'pagato' | 'pending' | 'fallito' {
  const bal = installments.filter(i => i.type === 'balance');
  if (bal.some(i => i.status === 'failed')) return 'fallito';
  if (bal.some(i => i.status === 'paid')) return 'pagato';
  // sale con solo acconto (deposit_paid): nessun balance, controlla il deposit
  if (bal.length === 0) {
    const deposit = installments.find(i => i.type === 'deposit');
    if (deposit?.status === 'paid') return 'pagato';
    if (deposit?.status === 'failed') return 'fallito';
  }
  return 'pending';
}

function saleToClient(sale: SaleDto): Client {
  const paid = sale.installments.filter(i => i.status === 'paid');
  const nextDraft = sale.installments
    .filter(i => i.status === 'draft' && i.type === 'balance')
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))[0];
  const lastPaid = [...paid].sort((a, b) => (b.paymentDate ?? '').localeCompare(a.paymentDate ?? ''))[0];
  return {
    id: String(sale.id),
    sellerId: String(sale.seller?.id ?? ''),
    name: [sale.customer?.name, sale.customer?.surname].filter(Boolean).join(' ') || '—',
    contact: sale.customer?.email ?? '—',
    plan: sale.pricePlan?.name ?? '—',
    mrr: Number(sale.pricePlan?.installmentAmount ?? 0),
    payStatus: derivePayStatus(sale.installments),
    lastPay: lastPaid?.paymentDate ?? '',
    nextPay: nextDraft?.dueDate ?? '',
    stripe: sale.stripeSubscriptionId ?? '',
    totalPaid: paid.reduce((s, i) => s + Number(i.amount ?? 0), 0),
    method: '',
  };
}

function sortedInstallments(installments: InstallmentDto[]): InstallmentDto[] {
  return [...installments].sort((a, b) => {
    if (a.type === 'deposit' && b.type !== 'deposit') return -1;
    if (b.type === 'deposit' && a.type !== 'deposit') return 1;
    return a.installmentNumber - b.installmentNumber;
  });
}

function isoCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function isCurrentMonthInst(inst: InstallmentDto): boolean {
  const m = isoCurrentMonth();
  return !!(inst.dueDate?.startsWith(m) || inst.paymentDate?.startsWith(m));
}

function balanceTotal(installments: InstallmentDto[]): number {
  return installments.filter(i => i.type === 'balance').length;
}

function instStatusLabel(status: string): string {
  if (status === 'paid') return 'Pagata';
  if (status === 'failed') return 'Fallita';
  return 'In attesa';
}

// ---- CLIENT DRAWER ----------------------------------------------
@Component({
  selector: 'app-client-drawer',
  imports: [IconComponent, AvatarComponent, StatusBadgeComponent],
  styleUrl: './clients.component.css',
  template: `
    <div class="drawer-overlay" (click)="closedChange.emit()" role="dialog" aria-modal="true">
      <div class="drawer" (click)="$event.stopPropagation()">
        <div class="drawer-head">
          <span class="client-mono lg">{{ client().name.slice(0, 2).toUpperCase() }}</span>
          <div>
            <h2>{{ client().name }}</h2>
            <div class="drawer-sub">
              {{ client().contact }} · <span class="plan-tag">{{ client().plan }}</span>
            </div>
          </div>
          <button class="icon-btn" (click)="closedChange.emit()" aria-label="Chiudi">
            <app-icon name="x" [size]="20" />
          </button>
        </div>

        <div class="drawer-banner" [attr.data-st]="client().payStatus">
          <app-status-badge [status]="client().payStatus" kind="pay" />
          <span>{{ bannerText() }}</span>
          @if (client().payStatus === 'fallito') {
            <button class="btn-recover">Sollecita pagamento</button>
          }
        </div>

        <div class="drawer-grid">
          @if (serviceName()) {
            <div class="dg-service">
              <span class="dg-label">Servizio</span>
              <span class="dg-val">{{ serviceName() }}</span>
              @if (variantName()) {
                <span class="dg-variant">{{ variantName() }}</span>
              }
            </div>
          }
          <div>
            <span class="dg-label">Piano acquistato</span>
            <span class="dg-val">{{ client().plan }}</span>
          </div>
          @if (isAdmin()) {
            <div>
              <span class="dg-label">MRR</span>
              <span class="dg-val">{{ eurFmt(client().mrr) }}</span>
            </div>
            <div>
              <span class="dg-label">Totale incassato</span>
              <span class="dg-val">{{ eurFmt(client().totalPaid) }}</span>
            </div>
            @if (client().stripe) {
              <div>
                <span class="dg-label">Subscription ID</span>
                <span class="dg-val sm mono">{{ client().stripe }}</span>
              </div>
            }
          }
          @if (client().nextPay) {
            <div>
              <span class="dg-label">Prossimo addebito</span>
              <span class="dg-val sm">{{ fmtDate(client().nextPay) }}</span>
            </div>
          }
        </div>

        <div class="drawer-section">
          <div class="ds-title">Venditore</div>
          <div class="kv">
            <span>Assegnato a</span>
            <span class="td-seller">
              <app-avatar [seller]="seller()" [size]="22" />
              {{ seller().name }}
            </span>
          </div>
          <div class="kv">
            <span>Ultimo pagamento</span>
            <span>{{ fmtDate(client().lastPay) }}</span>
          </div>
        </div>

        @if (installments().length > 0) {
          <div class="drawer-section">
            <button class="inst-head" (click)="instExpanded.set(!instExpanded())" [attr.aria-expanded]="instExpanded()">
              <span class="ds-title">Rateizzazione</span>
              <span class="inst-count">
                @if (balanceCount() > 0) { {{ balanceCount() }} rate } @else { Acconto }
              </span>
              <app-icon name="chevronD" [size]="16" class="inst-chevron" [class.open]="instExpanded()" />
            </button>
            @if (instExpanded()) {
              <div class="inst-list">
                @for (inst of sortedInstallments(); track inst.id) {
                  <div class="inst-row" [class.deposit]="inst.type === 'deposit'">
                    <span class="inst-label">
                      @if (inst.type === 'deposit') { Acconto }
                      @else { Rata {{ inst.installmentNumber }}/{{ totalBalanceCount() }} }
                    </span>
                    <span class="inst-badge" [attr.data-status]="inst.status">{{ instStatusLabelFn(inst.status) }}</span>
                    <span class="inst-amount">{{ eurFmt(+(inst.amount ?? 0)) }}</span>
                    <span class="inst-date">
                      @if (inst.status === 'paid' && inst.paymentDate) { Pag. {{ fmtDate(inst.paymentDate) }} }
                      @else if (inst.dueDate) { Scad. {{ fmtDate(inst.dueDate) }} }
                    </span>
                  </div>
                }
              </div>
            }
          </div>
        }

        <div class="drawer-actions">
          @if (client().stripe) {
            <a class="btn-primary full" [href]="'https://dashboard.stripe.com/subscriptions/' + client().stripe" target="_blank" rel="noreferrer">
              <app-icon name="external" [size]="16" />Apri in Stripe
            </a>
          }
          <button class="btn-ghost full">
            <app-icon name="phone" [size]="16" />Prenota follow-up
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ClientDrawerComponent {
  readonly client = input.required<Client>();
  readonly seller = input.required<Seller>();
  readonly installments = input<InstallmentDto[]>([]);
  readonly serviceName = input<string | null>(null);
  readonly variantName = input<string | null>(null);
  readonly isAdmin = input<boolean>(false);
  readonly closedChange = output<void>();

  readonly instExpanded = signal(true);
  readonly eurFmt = eur;
  readonly fmtDate = fmtDate;
  readonly instStatusLabelFn = instStatusLabel;

  readonly sortedInstallments = computed(() => sortedInstallments(this.installments()));
  readonly balanceCount = computed(() => this.installments().filter(i => i.type === 'balance').length);
  readonly totalBalanceCount = computed(() => {
    const bal = this.installments().filter(i => i.type === 'balance');
    return bal[0]?.totalInstallment || bal.length;
  });

  bannerText(): string {
    const s = this.client().payStatus;
    if (s === 'pagato') return 'Pagamenti regolari';
    if (s === 'pending') return 'Fattura in attesa di addebito';
    return 'Ultimo addebito non riuscito — da recuperare';
  }
}

// ---- CLIENTS PAGE -----------------------------------------------
@Component({
  selector: 'app-clients',
  imports: [IconComponent, AvatarComponent, StatCardComponent, StatusBadgeComponent, SegmentedComponent, ClientDrawerComponent, CreateSaleModalComponent],
  styleUrl: './clients.component.css',
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>
            Vendite
            @if (isAdmin()) { <span class="muted-pill">team</span> }
          </h1>
          <p class="page-sub">
            {{ isAdmin() ? 'Tutte le vendite gestite dal team' : 'Le tue vendite' }}
            · pagamenti sincronizzati da <span class="stripe-tag">Stripe</span>
          </p>
        </div>
        <div style="display:flex;gap:8px">
          @if (isAdmin()) {
            <button class="btn-primary" (click)="showCreateModal.set(true)">
              <app-icon name="plus" [size]="15" />Nuova vendita
            </button>
          }
          <button class="btn-ghost">
            <app-icon name="external" [size]="16" />Apri Stripe
          </button>
        </div>
      </div>

      <div class="stat-grid">
        <app-stat-card icon="check" label="Incassato (MRR)" [value]="eurIncassato()" [trend]="6" [accent]="true" />
        <app-stat-card icon="clock" label="In attesa" [value]="eurAttesa()" [sub]="pendingCount() + ' fatture'" />
        <app-stat-card icon="x" label="Pagamenti falliti" [value]="fallitiCount()" sub="da recuperare" />
        <app-stat-card icon="card" label="MRR totale" [value]="eurMrr()" [sub]="allClients().length + ' clienti attivi'" />
      </div>

      <div class="toolbar">
        <div class="search-box">
          <app-icon name="search" [size]="17" />
          <input
            placeholder="Cerca cliente o referente…"
            [value]="q()"
            (input)="q.set($any($event.target).value)"
            aria-label="Cerca"
          />
        </div>
        <app-segmented [value]="payF()" [options]="payOptions" (changed)="payF.set($event)" />
      </div>

      @if (salesResource.isLoading()) {
        <div class="empty"><span>Caricamento…</span></div>
      } @else if (filteredRows().length === 0) {
        <div class="empty">
          <app-icon name="search" [size]="28" />
          <span>Nessun cliente trovato</span>
        </div>
      } @else {
        <div class="card">
          <div class="table-scroll">
            <div class="table table-clients" [class.adm]="isAdmin()">
              <!-- header -->
              <div class="tr th">
                <span>Cliente</span>
                @if (isAdmin()) { <span>Venditore</span> }
                <span>Servizio</span>
                <span>Piano</span>
                <span class="r">MRR</span>
                <span class="r">Tot. incassato</span>
                <span class="r">Stato</span>
              </div>

              <!-- rows -->
              @for (row of filteredRows(); track row.client.id) {
                <div class="tr-group">
                  <!-- main row — click opens drawer, chevron button expands tree -->
                  <div
                    class="tr tr-click"
                    role="button"
                    tabindex="0"
                    (click)="openSale.set(row.sale)"
                    (keydown.enter)="openSale.set(row.sale)"
                    (keydown.space)="$event.preventDefault(); openSale.set(row.sale)"
                  >
                    <span class="td-client">
                      <button
                        class="expand-btn"
                        (click)="$event.stopPropagation(); toggleRow(row.client.id)"
                        [attr.aria-expanded]="isExpanded(row.client.id)"
                        [attr.aria-label]="isExpanded(row.client.id) ? 'Comprimi rate' : 'Espandi rate'"
                      >
                        <span class="expand-icon" [class.open]="isExpanded(row.client.id)">
                          <app-icon name="chevron" [size]="13" />
                        </span>
                      </button>
                      <span class="client-mono">{{ row.client.name.slice(0, 2).toUpperCase() }}</span>
                      <span>
                        <span class="td-strong">{{ row.client.name }}</span>
                        <span class="td-contact">{{ row.client.contact }}</span>
                      </span>
                    </span>
                    @if (isAdmin()) {
                      <span class="td-seller">
                        <app-avatar [seller]="displaySellersById()[row.client.sellerId]" [size]="24" />
                        {{ (displaySellersById()[row.client.sellerId]?.name ?? '—').split(' ')[0] }}
                      </span>
                    }
                    <span class="td-service">
                      <span class="td-service-name">{{ row.sale.pricePlan?.serviceVariant?.service?.name ?? '—' }}</span>
                      @if (row.sale.pricePlan?.serviceVariant?.name) {
                        <span class="td-service-variant">{{ row.sale.pricePlan!.serviceVariant!.name }}</span>
                      }
                    </span>
                    <span>
                      <span class="plan-tag">{{ row.client.plan }}</span>
                    </span>
                    <span class="r mono strong">{{ eurFmt(row.client.mrr) }}</span>
                    <span class="r mono muted">{{ eurFmt(row.client.totalPaid) }}</span>
                    <span class="r"><app-status-badge [status]="row.client.payStatus" kind="pay" /></span>
                  </div>

                  <!-- expandable installment sub-rows -->
                  @if (isExpanded(row.client.id) && row.sale.installments.length > 0) {
                    <div class="inst-panel" role="region" [attr.aria-label]="'Rate di ' + row.client.name">
                      @for (inst of sortedInstsFn(row.sale.installments); track inst.id) {
                        <div class="inst-summary-row" [class.inst-current]="isCurrentMonthInstFn(inst)">
                          <span class="inst-label">
                            @if (inst.type === 'deposit') {
                              Acconto
                            } @else {
                              Rata {{ inst.installmentNumber }}/{{ balanceTotalFn(row.sale.installments) }}
                            }
                            @if (isCurrentMonthInstFn(inst)) {
                              <span class="current-tag">Questo mese</span>
                            }
                          </span>
                          <span class="inst-badge" [attr.data-status]="inst.status">
                            {{ instStatusLabelFn(inst.status) }}
                          </span>
                          <span class="inst-amount">{{ eurFmt(+(inst.amount ?? 0)) }}</span>
                          <span class="inst-date">
                            @if (inst.status === 'paid' && inst.paymentDate) {
                              Pag. {{ fmtDate(inst.paymentDate) }}
                            } @else if (inst.dueDate) {
                              Scad. {{ fmtDate(inst.dueDate) }}
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
      }
    </div>

    <app-create-sale-modal
      [visible]="showCreateModal()"
      (closed)="showCreateModal.set(false)"
      (created)="onSaleCreated()"
    />

    @if (openSale(); as sale) {
      <app-client-drawer
        [client]="saleToClientFn(sale)"
        [seller]="displaySellersById()[String(sale.seller?.id ?? '')] ?? fallbackSeller"
        [installments]="sale.installments"
        [serviceName]="sale.pricePlan?.serviceVariant?.service?.name ?? null"
        [variantName]="sale.pricePlan?.serviceVariant?.name ?? null"
        [isAdmin]="isAdmin()"
        (closedChange)="openSale.set(null)"
      />
    }
  `,
})
export class ClientsComponent {
  private readonly auth = inject(AuthService);
  private readonly saleApiService = inject(SaleApiService);

  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');
  readonly salesResource = rxResource({ stream: () => this.saleApiService.getAll() });

  readonly allClients = computed(() => (this.salesResource.value() ?? []).map(saleToClient));

  readonly displaySellersById = computed<Record<string, Seller>>(() => {
    const sales = this.salesResource.value() ?? [];
    const seen = new Map<number, number>();
    const result: Record<string, Seller> = {};
    for (const sale of sales) {
      if (!sale.seller) continue;
      const id = sale.seller.id;
      if (!seen.has(id)) seen.set(id, seen.size);
      result[String(id)] = makeDisplaySeller(sale.seller, seen.get(id)!);
    }
    return result;
  });

  readonly fallbackSeller: Seller = { id: '0', name: '—', initials: '—', color: '#9ca3af', role: '' };

  readonly q = signal('');
  readonly payF = signal('tutti');
  readonly openSale = signal<SaleDto | null>(null);
  readonly expandedRows = signal(new Set<string>());
  readonly showCreateModal = signal(false);

  onSaleCreated(): void {
    this.showCreateModal.set(false);
    this.salesResource.reload();
  }

  readonly saleToClientFn = saleToClient;
  readonly sortedInstsFn = sortedInstallments;
  readonly isCurrentMonthInstFn = isCurrentMonthInst;
  readonly balanceTotalFn = balanceTotal;
  readonly instStatusLabelFn = instStatusLabel;
  readonly eurFmt = eur;
  readonly fmtDate = fmtDate;
  readonly String = String;

  readonly payOptions = [
    { value: 'tutti', label: 'Tutti' },
    { value: 'pagato', label: 'Pagati' },
    { value: 'pending', label: 'In attesa' },
    { value: 'fallito', label: 'Falliti' },
  ];

  readonly filteredRows = computed(() => {
    const q = this.q().toLowerCase();
    return (this.salesResource.value() ?? [])
      .map(sale => ({ sale, client: saleToClient(sale) }))
      .filter(({ client: c }) => {
        if (this.payF() !== 'tutti' && c.payStatus !== this.payF()) return false;
        if (q && !(c.name + c.contact).toLowerCase().includes(q)) return false;
        return true;
      });
  });

  toggleRow(id: string): void {
    this.expandedRows.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  isExpanded(id: string): boolean {
    return this.expandedRows().has(id);
  }

  readonly eurIncassato = computed(() =>
    eur(this.allClients().filter(c => c.payStatus === 'pagato').reduce((s, c) => s + c.mrr, 0))
  );
  readonly eurAttesa = computed(() =>
    eur(this.allClients().filter(c => c.payStatus === 'pending').reduce((s, c) => s + c.mrr, 0))
  );
  readonly fallitiCount = computed(() => this.allClients().filter(c => c.payStatus === 'fallito').length);
  readonly pendingCount = computed(() => this.allClients().filter(c => c.payStatus === 'pending').length);
  readonly eurMrr = computed(() => eur(this.allClients().reduce((s, c) => s + c.mrr, 0)));
}
