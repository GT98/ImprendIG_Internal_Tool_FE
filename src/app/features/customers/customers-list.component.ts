import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CustomerApiService, CustomerDto, CustomerSeller } from '../../customers/customer-api.service';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-customers-list',
  imports: [IconComponent],
  styleUrl: './customers-list.component.css',
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Clienti</h1>
          <p class="page-sub">Tutti i clienti registrati con il loro venditore di riferimento.</p>
        </div>
        @if (!customersResource.isLoading()) {
          <span class="muted-pill">{{ filtered().length }}</span>
        }
      </div>

      <div class="toolbar">
        <div class="search-box">
          <app-icon name="search" [size]="16" />
          <input
            type="search"
            placeholder="Cerca per nome o email…"
            [value]="searchQuery()"
            (input)="searchQuery.set($any($event.target).value)"
            aria-label="Cerca cliente"
          />
        </div>
      </div>

      @if (customersResource.isLoading()) {
        <div class="empty"><span>Caricamento…</span></div>
      } @else if (filtered().length === 0) {
        <div class="empty">
          <app-icon name="users" [size]="32" />
          <span>{{ searchQuery() ? 'Nessun risultato per "' + searchQuery() + '"' : 'Nessun cliente trovato' }}</span>
        </div>
      } @else {
        <div class="table customers-table" role="table" aria-label="Elenco clienti">
          <div class="tr th" role="row">
            <span role="columnheader">Nome</span>
            <span role="columnheader">Email</span>
            <span role="columnheader">Telefono</span>
            <span role="columnheader">Venditore</span>
            <span role="columnheader">Prodotto</span>
            <span role="columnheader">Inizio affiancamento</span>
            <span role="columnheader">Stato</span>
          </div>
          @for (c of filtered(); track c.id) {
            <div class="tr" role="row">
              <div class="td-client">
                <div class="client-mono" [attr.aria-hidden]="true">{{ initials(c) }}</div>
                <span>
                  <span class="td-strong">{{ fullName(c) }}</span>
                  @if (c.codiceFiscale) {
                    <span class="td-contact">CF: {{ c.codiceFiscale }}</span>
                  }
                </span>
              </div>
              <span class="td-contact">{{ c.email || '—' }}</span>
              <span class="td-contact">{{ c.phone || '—' }}</span>
              <span class="td-seller">{{ sellerName(c.sale?.seller ?? null) }}</span>
              <span class="small muted">{{ productName(c) }}</span>
              <span class="td-contact">{{ c.startDate || '—' }}</span>
              <span>
                @if (c.sale) {
                  <span
                    class="badge"
                    [style.background]="saleStatusBadge(c.sale.status).bg"
                    [style.color]="saleStatusBadge(c.sale.status).color"
                  >
                    {{ saleStatusBadge(c.sale.status).label }}
                  </span>
                } @else {
                  <span class="muted">—</span>
                }
              </span>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class CustomersListComponent {
  private readonly api = inject(CustomerApiService);

  readonly searchQuery = signal('');

  readonly customersResource = rxResource({
    stream: () => this.api.getAll(),
  });

  readonly filtered = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const all = this.customersResource.value() ?? [];
    if (!q) return all;
    return all.filter(c =>
      (c.name ?? '').toLowerCase().includes(q) ||
      (c.surname ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').toLowerCase().includes(q),
    );
  });

  fullName(c: CustomerDto): string {
    return [c.name, c.surname].filter(Boolean).join(' ') || '—';
  }

  initials(c: CustomerDto): string {
    const n = (c.name ?? '').charAt(0).toUpperCase();
    const l = (c.surname ?? '').charAt(0).toUpperCase();
    return (n + l) || '?';
  }

  sellerName(s: CustomerSeller | null): string {
    if (!s) return '—';
    return [s.name, s.lastName].filter(Boolean).join(' ') || '—';
  }

  productName(c: CustomerDto): string {
    const svc = c.sale?.pricePlan?.serviceVariant?.service?.name;
    const variant = c.sale?.pricePlan?.serviceVariant?.name;
    if (!svc) return '—';
    return variant ? `${svc} · ${variant}` : svc;
  }

  saleStatusBadge(status: string): { bg: string; color: string; label: string } {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      completed:      { bg: '#d1fae5', color: '#065f46', label: 'Completato' },
      balance_active: { bg: '#dbeafe', color: '#1e40af', label: 'Rate attive' },
      deposit_paid:   { bg: '#fef3c7', color: '#92400e', label: 'Acconto' },
      pending:        { bg: '#fef3c7', color: '#92400e', label: 'In corso' },
      failed:         { bg: '#fee2e2', color: '#b91c1c', label: 'Fallito' },
    };
    return map[status] ?? { bg: '#f3f4f6', color: '#6b7280', label: status };
  }
}
