import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  CustomerApiService,
  CustomerDto,
  CustomerSeller,
  OnboardingFormApiService,
  OnboardingSubmissionDto,
} from '../../customers/customer-api.service';
import { IconComponent } from '../../shared/icon.component';

interface CustomerRow {
  customer: CustomerDto;
  submission: OnboardingSubmissionDto | null;
}

@Component({
  selector: 'app-customers-list',
  imports: [IconComponent],
  styleUrl: './customers-list.component.css',
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Clienti</h1>
          <p class="page-sub">Clienti registrati con dati di onboarding e vendita.</p>
        </div>
        @if (!isLoading()) {
          <span class="muted-pill">{{ filtered().length }}</span>
        }
      </div>

      <!-- Toolbar -->
      <div class="toolbar">
        <div class="search-box">
          <app-icon name="search" [size]="16" />
          <input
            type="search"
            placeholder="Cerca per nome, email, telefono…"
            [value]="searchQuery()"
            (input)="searchQuery.set($any($event.target).value)"
            aria-label="Cerca cliente"
          />
        </div>

        <!-- Status filter -->
        <select class="filter-select" [value]="statusFilter()" (change)="statusFilter.set($any($event.target).value)">
          <option value="">Tutti gli stati</option>
          <option value="completed">Onboarding completato</option>
          <option value="pending">Onboarding in attesa</option>
          <option value="no_form">Nessun form</option>
        </select>
      </div>

      @if (isLoading()) {
        <div class="empty"><span class="spinner"></span> Caricamento…</div>
      } @else if (filtered().length === 0) {
        <div class="empty">
          <app-icon name="users" [size]="32" />
          <span>{{ searchQuery() ? 'Nessun risultato per "' + searchQuery() + '"' : 'Nessun cliente trovato' }}</span>
        </div>
      } @else {
        <div class="table-scroll">
          <div class="table customers-table" role="table" aria-label="Elenco clienti">
            <div class="tr th" role="row">
              <span role="columnheader">Cliente</span>
              <span role="columnheader">Contatti</span>
              <span role="columnheader">Venditore</span>
              <span role="columnheader">Prodotto</span>
              <span role="columnheader">Stato vendita</span>
              <span role="columnheader">Onboarding</span>
            </div>

            @for (row of filtered(); track row.customer.id) {
              <div class="tr" role="row" [class.expanded]="expandedId() === row.customer.id">

                <!-- Cliente -->
                <div class="td-client">
                  <div class="client-mono" aria-hidden="true">{{ initials(row.customer) }}</div>
                  <div class="client-info">
                    <span class="td-strong">{{ fullName(row.customer) }}</span>
                    @if (row.customer.codiceFiscale) {
                      <span class="td-sub">CF: {{ row.customer.codiceFiscale }}</span>
                    }
                  </div>
                </div>

                <!-- Contatti -->
                <div class="td-contacts">
                  <span class="td-contact">{{ row.customer.email || '—' }}</span>
                  <span class="td-sub">{{ row.customer.phone || '—' }}</span>
                  @if (hasAddress(row.customer)) {
                    <button class="addr-toggle" (click)="toggleExpand(row.customer.id)" [attr.aria-expanded]="expandedId() === row.customer.id">
                      <app-icon name="home" [size]="12" />
                      {{ row.customer.city || 'Indirizzo' }}{{ row.customer.province ? ' (' + row.customer.province + ')' : '' }}
                    </button>
                  }
                </div>

                <!-- Venditore -->
                <span class="td-seller-name">{{ sellerName(row.customer.sale?.seller ?? null) }}</span>

                <!-- Prodotto -->
                <span class="td-product">{{ productName(row.customer) }}</span>

                <!-- Stato vendita -->
                <span>
                  @if (row.customer.sale) {
                    <span
                      class="badge"
                      [style.background]="saleStatusBadge(row.customer.sale.status).bg"
                      [style.color]="saleStatusBadge(row.customer.sale.status).color"
                    >{{ saleStatusBadge(row.customer.sale.status).label }}</span>
                  } @else {
                    <span class="muted">—</span>
                  }
                </span>

                <!-- Onboarding -->
                <div class="td-onboarding">
                  @if (row.submission) {
                    <span
                      class="badge"
                      [style.background]="onboardingBadge(row.submission.status).bg"
                      [style.color]="onboardingBadge(row.submission.status).color"
                    >{{ onboardingBadge(row.submission.status).label }}</span>
                    @if (row.submission.submittedAt) {
                      <span class="td-sub">{{ formatDate(row.submission.submittedAt) }}</span>
                    } @else if (row.submission.formLinkSentAt) {
                      <span class="td-sub">inviato {{ formatDate(row.submission.formLinkSentAt) }}</span>
                    }
                  } @else {
                    <span class="muted">—</span>
                  }
                </div>

              </div>

              <!-- Address expansion row -->
              @if (expandedId() === row.customer.id && hasAddress(row.customer)) {
                <div class="addr-row" role="row">
                  <div class="addr-content">
                    <app-icon name="home" [size]="13" />
                    <span>{{ addrStr(row.customer) }}</span>
                    @if (row.customer.startDate) {
                      <span class="addr-start">
                        <app-icon name="calendar" [size]="13" />
                        Affiancamento dal {{ row.customer.startDate }}
                      </span>
                    }
                  </div>
                </div>
              }
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class CustomersListComponent {
  private readonly api = inject(CustomerApiService);
  private readonly onboardingApi = inject(OnboardingFormApiService);

  readonly searchQuery = signal('');
  readonly statusFilter = signal('');
  readonly expandedId = signal<number | null>(null);

  readonly customersResource = rxResource({
    stream: () => this.api.getAll(),
  });

  readonly submissionsResource = rxResource({
    stream: () => this.onboardingApi.getSubmissions(),
  });

  readonly isLoading = computed(
    () => this.customersResource.isLoading() || this.submissionsResource.isLoading(),
  );

  readonly rows = computed((): CustomerRow[] => {
    const customers = this.customersResource.value() ?? [];
    const submissions = this.submissionsResource.value() ?? [];
    return customers.map(c => ({
      customer: c,
      submission: submissions.find(s => s.customer?.id === Number(c.id)) ?? null,
    }));
  });

  readonly filtered = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const sf = this.statusFilter();
    return this.rows().filter(row => {
      const c = row.customer;
      if (q) {
        const match =
          (c.name ?? '').toLowerCase().includes(q) ||
          (c.surname ?? '').toLowerCase().includes(q) ||
          (c.email ?? '').toLowerCase().includes(q) ||
          (c.phone ?? '').toLowerCase().includes(q);
        if (!match) return false;
      }
      if (sf === 'completed') return row.submission?.status === 'completed';
      if (sf === 'pending') return row.submission?.status === 'pending';
      if (sf === 'no_form') return !row.submission;
      return true;
    });
  });

  toggleExpand(id: number): void {
    this.expandedId.update(cur => (cur === id ? null : id));
  }

  fullName(c: CustomerDto): string {
    return [c.name, c.surname].filter(v => !!v).join(' ') || '—';
  }

  initials(c: CustomerDto): string {
    const n = (c.name ?? '').charAt(0).toUpperCase();
    const l = (c.surname ?? '').charAt(0).toUpperCase();
    return (n + l) || '?';
  }

  sellerName(s: CustomerSeller | null): string {
    if (!s) return '—';
    return [s.name, s.lastName].filter(v => !!v).join(' ') || '—';
  }

  productName(c: CustomerDto): string {
    const svc = c.sale?.pricePlan?.serviceVariant?.service?.name;
    const variant = c.sale?.pricePlan?.serviceVariant?.name;
    if (!svc) return '—';
    return variant ? `${svc} · ${variant}` : svc;
  }

  addrStr(c: CustomerDto): string {
    return [c.address, c.city, c.province, c.cap].filter(v => !!v).join(', ');
  }

  hasAddress(c: CustomerDto): boolean {
    return !!(c.address || c.city || c.province || c.cap);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
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

  onboardingBadge(status: 'pending' | 'completed'): { bg: string; color: string; label: string } {
    return status === 'completed'
      ? { bg: '#d1fae5', color: '#065f46', label: 'Completato' }
      : { bg: '#fef3c7', color: '#92400e', label: 'In attesa' };
  }
}
