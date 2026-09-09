import { Component, computed, signal, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AreaClienteApiService, ClientLeadDto } from './area-cliente-api.service';
import { IconComponent } from '../../shared/icon.component';
import { MonthNavComponent } from '../commissions/month-nav.component';

function currentIsoMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

const STATUS_LABEL: Record<string, string> = {
  'nuovo': 'Nuovo',
  'contattato': 'Contattato',
  'in-trattativa': 'In trattativa',
  'chiuso-vinto': 'Chiuso (vinto)',
  'chiuso-perso': 'Chiuso (perso)',
  'da-fare': 'Da fare',
  'fatta': 'Fatta',
  'no-show': 'No show',
};

@Component({
  selector: 'app-area-cliente-leads',
  imports: [IconComponent, MonthNavComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="header-left">
          <app-icon name="phone" [size]="20" />
          <h1>I miei lead</h1>
        </div>
      </div>

      <div class="month-nav-wrap">
        <app-month-nav [(selected)]="selectedMonth" />
      </div>

      @if (leadsResource.isLoading()) {
        <div class="loading-state"><span class="spinner"></span> Caricamento…</div>
      } @else if (leadsResource.error()) {
        <div class="error-banner"><app-icon name="alertTriangle" [size]="16" /> Errore nel caricamento</div>
      } @else if (leads().length === 0) {
        <div class="empty-page">
          <app-icon name="phone" [size]="32" />
          <p>Nessun lead per questo mese</p>
        </div>
      } @else {
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Telefono</th>
                <th>Data chiamata</th>
                <th>Stato</th>
              </tr>
            </thead>
            <tbody>
              @for (lead of leads(); track lead.id) {
                <tr class="clickable-row" (click)="openLead(lead)" [attr.aria-selected]="selectedLead()?.id === lead.id">
                  <td class="name-cell">{{ fullName(lead) }}</td>
                  <td class="muted">{{ lead.email ?? '—' }}</td>
                  <td class="muted">{{ lead.phone ?? '—' }}</td>
                  <td class="muted sm">{{ fmtDateTime(lead.callStartDate) }}</td>
                  <td>
                    @if (lead.statusOption) {
                      <span class="status-pill">{{ lead.statusOption.label }}</span>
                    } @else if (lead.status) {
                      <span class="status-pill muted">{{ statusLabel(lead.status) }}</span>
                    } @else {
                      <span class="muted">—</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="count-footer">{{ leads().length }} lead trovati</div>
      }
    </div>

    <!-- Drawer dettaglio lead -->
    @if (selectedLead(); as lead) {
      <div class="drawer-overlay" (click)="closeLead()" role="dialog" aria-modal="true" aria-label="Dettaglio lead">
        <div class="drawer" (click)="$event.stopPropagation()">
          <div class="drawer-head">
            <div class="drawer-head-info">
              <div class="lead-avatar">{{ avatarLetter(lead) }}</div>
              <div>
                <h2>{{ fullName(lead) }}</h2>
                @if (lead.email) { <div class="drawer-sub">{{ lead.email }}</div> }
              </div>
            </div>
            <button class="icon-btn" (click)="closeLead()" aria-label="Chiudi">
              <app-icon name="x" [size]="20" />
            </button>
          </div>

          <div class="info-list">
            <div class="info-row">
              <span class="info-label">Telefono</span>
              <span class="info-val">{{ lead.phone ?? '—' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Data chiamata</span>
              <span class="info-val">{{ fmtDateTime(lead.callStartDate) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Stato</span>
              <span class="info-val">
                @if (lead.statusOption) {
                  <span class="status-pill">{{ lead.statusOption.label }}</span>
                } @else if (lead.status) {
                  {{ statusLabel(lead.status) }}
                } @else { — }
              </span>
            </div>
            <div class="info-row">
              <span class="info-label">Venditore</span>
              <span class="info-val">{{ sellerName(lead) }}</span>
            </div>
          </div>

          @if (lead.notes) {
            <div class="drawer-section">
              <div class="ds-title">Dati onboarding</div>
              <div class="note-box">{{ lead.notes }}</div>
            </div>
          }

          @if (lead.sellerNotes) {
            <div class="drawer-section">
              <div class="ds-title">Note venditrice</div>
              <div class="note-box">{{ lead.sellerNotes }}</div>
            </div>
          }

          @if (lead.formCliente) {
            <div class="drawer-section">
              <div class="ds-title">Form cliente</div>
              <div class="note-box mono-text">{{ lead.formCliente }}</div>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .page-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 20px 24px 0; }
    .header-left { display: flex; align-items: center; gap: 10px; }
    .header-left h1 { font-size: 1.25rem; font-weight: 700; margin: 0; }
    .month-nav-wrap { padding: 16px 24px 0; }
    .table-wrap { margin: 16px 24px 0; overflow-x: auto; }
    .data-table { width: 100%; border-collapse: collapse; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
    .data-table th { padding: 10px 14px; background: var(--surface-2); font-size: 0.78rem; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--ink-3); text-align: left; }
    .data-table td { padding: 10px 14px; border-top: 1px solid var(--border); font-size: 0.88rem; }
    .clickable-row { cursor: pointer; }
    .clickable-row:hover td { background: var(--surface-2); }
    .clickable-row[aria-selected="true"] td { background: var(--accent-soft); }
    .name-cell { font-weight: 600; }
    .muted { color: var(--ink-3); }
    .sm { font-size: 0.82rem; }
    .status-pill { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 0.78rem; font-weight: 600; background: var(--surface-2); color: var(--ink-2); }
    .count-footer { padding: 12px 24px; font-size: 0.82rem; color: var(--ink-3); }
    .loading-state { display: flex; align-items: center; gap: 10px; padding: 40px 24px; color: var(--ink-3); }
    .error-banner { display: flex; align-items: center; gap: 8px; margin: 20px 24px 0; padding: 12px 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; color: #dc2626; }
    .empty-page { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 24px; color: var(--ink-3); }

    /* Drawer */
    .drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 200; display: flex; justify-content: flex-end; }
    .drawer { width: min(480px, 100vw); height: 100%; background: var(--surface); display: flex; flex-direction: column; overflow-y: auto; box-shadow: -4px 0 24px rgba(0,0,0,.12); }
    .drawer-head { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 20px 20px 16px; border-bottom: 1px solid var(--border); }
    .drawer-head-info { display: flex; align-items: center; gap: 14px; min-width: 0; }
    .lead-avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--accent); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.1rem; flex-shrink: 0; }
    .drawer-head h2 { margin: 0; font-size: 1.05rem; font-weight: 700; }
    .drawer-sub { font-size: 0.82rem; color: var(--ink-3); margin-top: 2px; }
    .info-list { padding: 4px 20px 4px; border-bottom: 1px solid var(--border); }
    .info-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 0.88rem; }
    .info-row:last-child { border-bottom: none; }
    .info-label { font-size: 0.73rem; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--ink-3); flex-shrink: 0; }
    .info-val { font-weight: 500; text-align: right; }
    .accent-date { color: var(--accent); font-weight: 700; }
    .drawer-section { padding: 16px 20px; border-top: 1px solid var(--border); }
    .ds-title { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-3); margin-bottom: 8px; }
    .note-box { background: var(--surface-2); border-radius: 8px; padding: 12px; font-size: 0.88rem; line-height: 1.5; color: var(--ink); white-space: pre-wrap; }
    .mono-text { font-family: monospace; font-size: 0.8rem; }
    .icon-btn { background: none; border: none; cursor: pointer; padding: 6px; border-radius: 6px; color: var(--ink-3); display: flex; align-items: center; flex-shrink: 0; }
    .icon-btn:hover { background: var(--surface-2); color: var(--ink); }
  `],
})
export class AreaClienteLeadsComponent {
  private readonly api = inject(AreaClienteApiService);

  readonly selectedMonth = signal(currentIsoMonth());
  readonly selectedLead = signal<ClientLeadDto | null>(null);

  readonly leadsResource = rxResource({
    params: () => this.selectedMonth(),
    stream: ({ params: month }) => this.api.getLeads(month),
  });

  readonly leads = computed<ClientLeadDto[]>(() =>
    [...(this.leadsResource.value() ?? [])].sort((a, b) =>
      (b.callStartDate ?? '').localeCompare(a.callStartDate ?? ''),
    ),
  );

  openLead(lead: ClientLeadDto): void { this.selectedLead.set(lead); }
  closeLead(): void { this.selectedLead.set(null); }

  fullName(lead: ClientLeadDto): string {
    return [lead.name, lead.surname].filter(Boolean).join(' ') || '—';
  }

  avatarLetter(lead: ClientLeadDto): string {
    return (lead.name ?? lead.email ?? '?').charAt(0).toUpperCase();
  }

  statusLabel(status: string): string {
    return STATUS_LABEL[status] ?? status;
  }

  sellerName(lead: ClientLeadDto): string {
    if (!lead.seller) return '—';
    return [lead.seller.name, lead.seller.lastName].filter(Boolean).join(' ') || '—';
  }

  readonly fmtDateTime = fmtDateTime;
  fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  }
}
