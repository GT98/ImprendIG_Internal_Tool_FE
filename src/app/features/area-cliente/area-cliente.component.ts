import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { AreaClienteApiService } from './area-cliente-api.service';
import { IconComponent } from '../../shared/icon.component';
import { StatCardComponent } from '../../shared/stat-card.component';
import { BarChartComponent } from '../../shared/charts.component';
import { CommissionPoint } from '../../models';

const IT_MONTHS_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
const IT_MONTHS_LONG  = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                          'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

function currentIsoMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmtMonth(iso: string): string {
  const [y, m] = iso.split('-');
  return `${IT_MONTHS_LONG[+m - 1]} ${y}`;
}

@Component({
  selector: 'app-area-cliente',
  imports: [IconComponent, StatCardComponent, BarChartComponent, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="header-left">
          <app-icon name="home" [size]="20" />
          <h1>Dashboard</h1>
        </div>
        <span class="month-label-badge">{{ fmtMonth(currentMonth) }}</span>
      </div>

      @if (revenueResource.isLoading()) {
        <div class="loading-state"><span class="spinner"></span> Caricamento…</div>
      } @else if (revenueResource.error()) {
        <div class="error-banner"><app-icon name="alertTriangle" [size]="16" /> Errore nel caricamento</div>
      } @else {
        <!-- Stat cards -->
        <div class="stats-row">
          <app-stat-card icon="euro" label="Fatturato {{ fmtMonth(currentMonth) }}" [value]="'€ ' + currentMonthRevenue()" [accent]="true" />
          <app-stat-card icon="chart" label="Fatturato totale" [value]="'€ ' + totalRevenue()" />
          <app-stat-card icon="phone" label="Lead attivi" [value]="leadCount()" />
          <app-stat-card icon="users" label="Vendite totali" [value]="salesCount()" />
        </div>

        <!-- Revenue chart -->
        @if (chartData().length > 1) {
          <div class="chart-card">
            <div class="chart-card-title">Fatturato mensile</div>
            <app-bar-chart [data]="chartData()" />
          </div>
        }

        <!-- Revenue table -->
        @if (sortedRevenue().length > 0) {
          <div class="table-wrap">
            <table class="summary-table">
              <thead>
                <tr>
                  <th>Mese</th>
                  <th class="text-right">Fatturato</th>
                </tr>
              </thead>
              <tbody>
                @for (r of sortedRevenue(); track r.month) {
                  <tr [class.current-month]="r.month === currentMonth">
                    <td>{{ fmtMonth(r.month) }}</td>
                    <td class="text-right mono font-600">€ {{ (+r.total).toFixed(2) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="empty-page">
            <app-icon name="chart" [size]="32" />
            <p>Nessun dato di fatturato disponibile</p>
          </div>
        }

        <!-- Quick links -->
        <div class="quick-links">
          <a class="quick-link-card" routerLink="/area-cliente/leads">
            <app-icon name="phone" [size]="20" />
            <span>Vedi tutti i lead</span>
            <app-icon name="chevron" [size]="16" />
          </a>
          <a class="quick-link-card" routerLink="/area-cliente/vendite">
            <app-icon name="users" [size]="20" />
            <span>Vedi tutte le vendite</span>
            <app-icon name="chevron" [size]="16" />
          </a>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 20px 24px 0; }
    .header-left { display: flex; align-items: center; gap: 10px; }
    .header-left h1 { font-size: 1.25rem; font-weight: 700; margin: 0; }
    .month-label-badge { font-size: 0.8rem; color: var(--ink-3); background: var(--surface-2); padding: 4px 10px; border-radius: 20px; }
    .stats-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; padding: 20px 24px 0; }
    .chart-card { margin: 20px 24px 0; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px; }
    .chart-card-title { font-size: 0.85rem; font-weight: 600; color: var(--ink-2); margin-bottom: 12px; }
    .table-wrap { margin: 20px 24px 0; }
    .empty-page { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 24px; color: var(--ink-3); }
    .quick-links { display: flex; gap: 12px; flex-wrap: wrap; padding: 20px 24px; }
    .quick-link-card { display: flex; align-items: center; gap: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 18px; text-decoration: none; color: var(--ink); font-size: 0.9rem; transition: background 0.15s; flex: 1; min-width: 200px; }
    .quick-link-card:hover { background: var(--surface-2); }
    .quick-link-card span { flex: 1; }
    .current-month td { background: var(--accent-soft); font-weight: 600; }
    .mono { font-variant-numeric: tabular-nums; }
    .font-600 { font-weight: 600; }
    .text-right { text-align: right; }
    .loading-state { display: flex; align-items: center; gap: 10px; padding: 40px 24px; color: var(--ink-3); }
    .error-banner { display: flex; align-items: center; gap: 8px; margin: 20px 24px 0; padding: 12px 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; color: #dc2626; }
    .summary-table { width: 100%; border-collapse: collapse; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
    .summary-table th { padding: 10px 14px; background: var(--surface-2); font-size: 0.78rem; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--ink-3); text-align: left; }
    .summary-table td { padding: 10px 14px; border-top: 1px solid var(--border); font-size: 0.9rem; }
  `],
})
export class AreaClienteComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(AreaClienteApiService);

  readonly currentMonth = currentIsoMonth();
  readonly fmtMonth = fmtMonth;

  private readonly clientId = computed(() => this.auth.currentUser()?.clientId ?? 0);

  readonly revenueResource = rxResource({
    params: () => this.clientId(),
    stream: ({ params: id }) => this.api.getRevenue(id),
  });

  readonly leadResource = rxResource({
    stream: () => this.api.getLeads(),
  });

  readonly salesResource = rxResource({
    stream: () => this.api.getSales(),
  });

  readonly sortedRevenue = computed(() =>
    [...(this.revenueResource.value() ?? [])].sort((a, b) => b.month.localeCompare(a.month)),
  );

  readonly currentMonthRevenue = computed(() => {
    const r = (this.revenueResource.value() ?? []).find(x => x.month === this.currentMonth);
    return (+( r?.total ?? 0)).toFixed(2);
  });

  readonly totalRevenue = computed(() =>
    (this.revenueResource.value() ?? []).reduce((s, r) => s + +(r.total), 0).toFixed(2),
  );

  readonly leadCount = computed(() => (this.leadResource.value() ?? []).length);
  readonly salesCount = computed(() => (this.salesResource.value() ?? []).length);

  readonly chartData = computed<CommissionPoint[]>(() => {
    const items = this.revenueResource.value() ?? [];
    return items
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12)
      .map(r => {
        const [, m] = r.month.split('-');
        return { m: IT_MONTHS_SHORT[+m - 1], v: +(r.total) };
      });
  });
}
