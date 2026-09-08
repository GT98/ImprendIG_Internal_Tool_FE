import { Component, computed, signal, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AreaClienteApiService, ClientSaleDto } from './area-cliente-api.service';
import { IconComponent } from '../../shared/icon.component';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtAmount(v: string | number | null | undefined): string {
  return Number(v ?? 0).toFixed(2);
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  balance_active: { label: 'Attivo', cls: 'active' },
  deposit_paid:   { label: 'Acconto pagato', cls: 'deposit' },
  completed:      { label: 'Completato', cls: 'completed' },
};

const INST_STATUS: Record<string, { label: string; cls: string }> = {
  paid:    { label: 'Pagata', cls: 'paid' },
  pending: { label: 'In attesa', cls: 'pending' },
  draft:   { label: 'Bozza', cls: 'draft' },
};

@Component({
  selector: 'app-area-cliente-vendite',
  imports: [IconComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="header-left">
          <app-icon name="users" [size]="20" />
          <h1>Le mie vendite</h1>
        </div>
        <span class="count-badge">{{ sales().length }} vendite</span>
      </div>

      @if (salesResource.isLoading()) {
        <div class="loading-state"><span class="spinner"></span> Caricamento…</div>
      } @else if (salesResource.error()) {
        <div class="error-banner"><app-icon name="alertTriangle" [size]="16" /> Errore nel caricamento</div>
      } @else if (sales().length === 0) {
        <div class="empty-page">
          <app-icon name="users" [size]="32" />
          <p>Nessuna vendita trovata</p>
        </div>
      } @else {
        <div class="sale-list">
          @for (sale of sales(); track sale.id) {
            <div class="sale-card" [class.open]="openId() === sale.id">
              <div class="sale-card-header" (click)="toggle(sale.id)" role="button" [attr.aria-expanded]="openId() === sale.id">
                <div class="sale-main">
                  <div class="customer-name">{{ customerName(sale) }}</div>
                  <div class="sale-meta">
                    {{ serviceName(sale) }}
                    @if (sale.pricePlan?.installmentCount) {
                      · {{ sale.pricePlan!.installmentCount }} rate
                    }
                  </div>
                </div>
                <div class="sale-right">
                  <span class="sale-amount">€ {{ saleTotal(sale) }}</span>
                  @if (STATUS_BADGE[sale.status]; as s) {
                    <span class="status-chip" [class]="s.cls">{{ s.label }}</span>
                  }
                  <span class="sale-date">{{ fmtDate(sale.createdAt) }}</span>
                  <app-icon [name]="openId() === sale.id ? 'chevronUp' : 'chevron'" [size]="16" />
                </div>
              </div>

              @if (openId() === sale.id) {
                <div class="sale-detail">
                  <div class="detail-row"><span class="detail-label">Email cliente</span><span>{{ sale.customer?.email ?? '—' }}</span></div>
                  <div class="detail-row"><span class="detail-label">Piano</span><span>{{ sale.pricePlan?.name ?? '—' }}</span></div>
                  <div class="detail-row"><span class="detail-label">Metodo pagamento</span><span>{{ sale.paymentMethod }}</span></div>

                  @if (sale.installments?.length) {
                    <div class="inst-title">Rate</div>
                    <table class="inst-table">
                      <thead><tr><th>Tipo</th><th>N°</th><th>Scadenza</th><th>Pagata il</th><th class="text-right">Importo</th><th>Stato</th></tr></thead>
                      <tbody>
                        @for (inst of sale.installments; track inst.id) {
                          <tr>
                            <td>{{ inst.type === 'deposit' ? 'Acconto' : 'Rata' }}</td>
                            <td>{{ inst.installmentNumber }}</td>
                            <td class="muted">{{ fmtDate(inst.dueDate) }}</td>
                            <td class="muted">{{ fmtDate(inst.paymentDate) }}</td>
                            <td class="text-right mono">€ {{ fmtAmount(inst.amount) }}</td>
                            <td>
                              @if (INST_STATUS[inst.status]; as s) {
                                <span class="inst-badge" [class]="s.cls">{{ s.label }}</span>
                              }
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 20px 24px 0; }
    .header-left { display: flex; align-items: center; gap: 10px; }
    .header-left h1 { font-size: 1.25rem; font-weight: 700; margin: 0; }
    .count-badge { font-size: 0.8rem; color: var(--ink-3); background: var(--surface-2); padding: 4px 10px; border-radius: 20px; }
    .sale-list { padding: 16px 24px; display: flex; flex-direction: column; gap: 10px; }
    .sale-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .sale-card-header { display: flex; align-items: center; gap: 12px; padding: 14px 18px; cursor: pointer; }
    .sale-card-header:hover { background: var(--surface-2); }
    .sale-main { flex: 1; min-width: 0; }
    .customer-name { font-weight: 600; font-size: 0.95rem; }
    .sale-meta { font-size: 0.82rem; color: var(--ink-3); margin-top: 2px; }
    .sale-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    .sale-amount { font-size: 0.95rem; font-weight: 700; font-variant-numeric: tabular-nums; }
    .sale-date { font-size: 0.78rem; color: var(--ink-3); }
    .status-chip { padding: 2px 8px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
    .status-chip.active { background: #dcfce7; color: #15803d; }
    .status-chip.deposit { background: #fef9c3; color: #a16207; }
    .status-chip.completed { background: #e0e7ff; color: #3730a3; }
    .sale-detail { padding: 0 18px 16px; border-top: 1px solid var(--border); }
    .detail-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 0.88rem; }
    .detail-label { color: var(--ink-3); font-size: 0.8rem; }
    .inst-title { font-size: 0.82rem; font-weight: 600; color: var(--ink-2); margin: 14px 0 6px; text-transform: uppercase; letter-spacing: .04em; }
    .inst-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .inst-table th { text-align: left; padding: 6px 8px; background: var(--surface-2); font-size: 0.75rem; color: var(--ink-3); }
    .inst-table td { padding: 8px 8px; border-top: 1px solid var(--border); }
    .muted { color: var(--ink-3); }
    .mono { font-variant-numeric: tabular-nums; }
    .text-right { text-align: right; }
    .inst-badge { padding: 2px 7px; border-radius: 20px; font-size: 0.73rem; font-weight: 600; }
    .inst-badge.paid { background: #dcfce7; color: #15803d; }
    .inst-badge.pending { background: #fef9c3; color: #a16207; }
    .inst-badge.draft { background: var(--surface-2); color: var(--ink-3); }
    .loading-state { display: flex; align-items: center; gap: 10px; padding: 40px 24px; color: var(--ink-3); }
    .error-banner { display: flex; align-items: center; gap: 8px; margin: 20px 24px 0; padding: 12px 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; color: #dc2626; }
    .empty-page { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 24px; color: var(--ink-3); }
  `],
})
export class AreaClienteVenditeComponent {
  private readonly api = inject(AreaClienteApiService);

  readonly STATUS_BADGE = STATUS_BADGE;
  readonly INST_STATUS = INST_STATUS;
  readonly fmtDate = fmtDate;
  readonly fmtAmount = fmtAmount;

  readonly salesResource = rxResource({
    stream: () => this.api.getSales(),
  });

  readonly openId = signal<number | null>(null);

  readonly sales = computed<ClientSaleDto[]>(() =>
    [...(this.salesResource.value() ?? [])].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
  );

  toggle(id: number): void {
    this.openId.update(cur => cur === id ? null : id);
  }

  customerName(sale: ClientSaleDto): string {
    const c = sale.customer;
    return [c?.name, c?.surname].filter(Boolean).join(' ') || c?.email || `Vendita #${sale.id}`;
  }

  serviceName(sale: ClientSaleDto): string {
    return sale.pricePlan?.serviceVariant?.service?.name
      ?? sale.pricePlan?.serviceVariant?.name
      ?? sale.pricePlan?.name
      ?? '—';
  }

  saleTotal(sale: ClientSaleDto): string {
    const paid = sale.installments?.reduce((s, i) => s + Number(i.amount ?? 0), 0) ?? 0;
    return paid > 0 ? paid.toFixed(2) : (sale.pricePlan?.basePrice ? fmtAmount(sale.pricePlan.basePrice) : '—');
  }
}
