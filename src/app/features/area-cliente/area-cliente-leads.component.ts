import { Component, computed, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { inject } from '@angular/core';
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
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              @for (lead of leads(); track lead.id) {
                <tr>
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
                  <td class="muted note-cell">{{ lead.notes ?? '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="count-footer">{{ leads().length }} lead trovati</div>
      }
    </div>
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
    .name-cell { font-weight: 600; }
    .muted { color: var(--ink-3); }
    .sm { font-size: 0.82rem; }
    .note-cell { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .status-pill { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 0.78rem; font-weight: 600; background: var(--surface-2); color: var(--ink-2); }
    .count-footer { padding: 12px 24px; font-size: 0.82rem; color: var(--ink-3); }
    .loading-state { display: flex; align-items: center; gap: 10px; padding: 40px 24px; color: var(--ink-3); }
    .error-banner { display: flex; align-items: center; gap: 8px; margin: 20px 24px 0; padding: 12px 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; color: #dc2626; }
    .empty-page { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 24px; color: var(--ink-3); }
  `],
})
export class AreaClienteLeadsComponent {
  private readonly api = inject(AreaClienteApiService);

  readonly selectedMonth = signal(currentIsoMonth());

  readonly leadsResource = rxResource({
    params: () => this.selectedMonth(),
    stream: ({ params: month }) => this.api.getLeads(month),
  });

  readonly leads = computed<ClientLeadDto[]>(() =>
    [...(this.leadsResource.value() ?? [])].sort((a, b) =>
      (b.callStartDate ?? '').localeCompare(a.callStartDate ?? ''),
    ),
  );

  fullName(lead: ClientLeadDto): string {
    return [lead.name, lead.surname].filter(Boolean).join(' ') || '—';
  }

  statusLabel(status: string): string {
    return STATUS_LABEL[status] ?? status;
  }

  readonly fmtDateTime = fmtDateTime;
}
