import { Component, inject, signal, computed } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TitleCasePipe, DatePipe } from '@angular/common';
import { CatalogApiService } from '../../catalog/catalog-api.service';
import { OnboardingFormApiService } from '../../customers/customer-api.service';
import { TelegramSegmentsPanelComponent } from '../catalog/telegram-segments-panel.component';
import { IconComponent } from '../../shared/icon.component';

type Tab = 'channels' | 'forms';

interface VariantEntry {
  variantId: number;
  variantName: string;
  serviceName: string;
  clientName: string | null;
  clientId: number | null;
}

interface ClientGroup {
  clientId: number | null;
  clientName: string;
  variants: VariantEntry[];
}

@Component({
  selector: 'app-onboarding',
  imports: [TelegramSegmentsPanelComponent, TitleCasePipe, DatePipe, IconComponent],
  styles: [`
    :host { display: block; }

    .tab-bar { display: flex; gap: 4px; margin-bottom: 1.5rem; border-bottom: 1.5px solid var(--border, #e5e7eb); padding-bottom: 0; }
    .tab-btn { padding: 8px 16px; border: none; background: none; font-size: 14px; font-weight: 500; color: var(--ink-2, #6b7280); cursor: pointer; border-bottom: 2.5px solid transparent; margin-bottom: -1.5px; transition: color .15s, border-color .15s; }
    .tab-btn:hover { color: var(--ink, #111827); }
    .tab-btn.active { color: var(--accent, #4f46e5); border-bottom-color: var(--accent, #4f46e5); font-weight: 600; }

    .filter-bar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 1rem; }
    .chip { padding: 6px 14px; border-radius: 20px; border: 1.5px solid var(--border, #e5e7eb); background: var(--surface, #fff); color: var(--ink-2, #6b7280); font-size: 13px; font-weight: 500; cursor: pointer; transition: background .15s, color .15s, border-color .15s; }
    .chip:hover { border-color: var(--accent); color: var(--accent); }
    .chip.active { background: var(--accent); border-color: var(--accent); color: #fff; }

    .search-wrap { position: relative; margin-bottom: 1.5rem; }
    .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--ink-3, #9ca3af); pointer-events: none; display: flex; }
    .search-input { width: 100%; max-width: 360px; padding: 8px 12px 8px 34px; border: 1.5px solid var(--border, #e5e7eb); border-radius: 8px; font-size: 14px; outline: none; transition: border-color .15s; background: var(--surface, #fff); color: var(--ink, #111827); }
    .search-input:focus { border-color: var(--accent); }
    .search-input::placeholder { color: var(--ink-3, #9ca3af); }

    .client-group { margin-bottom: 2rem; }
    .group-header { display: flex; align-items: center; gap: 10px; margin-bottom: .75rem; }
    .group-name { font-size: 12px; font-weight: 700; color: var(--ink-2, #6b7280); text-transform: uppercase; letter-spacing: .07em; white-space: nowrap; }
    .group-count { font-size: 11px; font-weight: 600; color: var(--ink-3, #9ca3af); background: var(--surface-2, #f9fafb); border: 1px solid var(--border, #e5e7eb); border-radius: 20px; padding: 1px 8px; white-space: nowrap; }
    .group-line { flex: 1; height: 1px; background: var(--border, #e5e7eb); }

    .variant-card { background: var(--surface, #fff); border: 1px solid var(--border, #e5e7eb); border-radius: var(--radius, 14px); overflow: hidden; margin-bottom: 8px; }
    .variant-header { display: flex; align-items: baseline; gap: .5rem; padding: 14px 18px; border-bottom: 1px solid var(--border, #e5e7eb); background: var(--surface-alt, #f9fafb); }
    .variant-name { font-weight: 600; font-size: 15px; color: var(--ink, #111827); }
    .variant-meta { font-size: 12px; color: var(--ink-3, #888); }

    .page-sub { font-size: 13px; color: var(--ink-3, #888); margin: 0 0 1.5rem; }

    .empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 64px 24px; color: var(--ink-3, #9ca3af); font-size: 14px; }

    /* Form submissions table */
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 8px 12px; font-size: 11px; font-weight: 700; color: var(--ink-3, #9ca3af); text-transform: uppercase; letter-spacing: .06em; border-bottom: 1.5px solid var(--border, #e5e7eb); white-space: nowrap; }
    td { padding: 10px 12px; border-bottom: 1px solid var(--border, #e5e7eb); color: var(--ink, #111827); vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--surface-alt, #f9fafb); }
    .name { font-weight: 500; }
    .secondary { font-size: 12px; color: var(--ink-3, #9ca3af); }
    .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .badge-ok { background: #d1fae5; color: #065f46; }
    .badge-pending { background: #fef3c7; color: #92400e; }
    .sent { color: #059669; font-size: 12px; }
    .not-sent { color: var(--ink-3, #9ca3af); font-size: 18px; line-height: 1; }
  `],
  template: `
    <div class="page">
      <nav class="tab-bar" role="tablist" aria-label="Sezioni onboarding">
        <button class="tab-btn" [class.active]="activeTab() === 'channels'"
          role="tab" [attr.aria-selected]="activeTab() === 'channels'"
          (click)="activeTab.set('channels')">
          Canali Telegram
        </button>
        <button class="tab-btn" [class.active]="activeTab() === 'forms'"
          role="tab" [attr.aria-selected]="activeTab() === 'forms'"
          (click)="activeTab.set('forms')">
          Form onboarding
          @if (pendingCount() > 0) {
            <span style="margin-left:6px;background:#fef3c7;color:#92400e;border-radius:20px;padding:1px 7px;font-size:11px;font-weight:700;">
              {{ pendingCount() }} in attesa
            </span>
          }
        </button>
      </nav>

      @switch (activeTab()) {
        @case ('channels') {
          <p class="page-sub">Configura gli sblocchi automatici dei canali Telegram per ogni variante di percorso.</p>

          @if (clients().length > 1) {
            <div class="filter-bar" role="group" aria-label="Filtra per cliente">
              <button class="chip" [class.active]="selectedClientId() === null" (click)="selectedClientId.set(null)">
                Tutti
              </button>
              @for (c of clients(); track c.id) {
                <button class="chip" [class.active]="selectedClientId() === c.id" (click)="selectedClientId.set(c.id)">
                  {{ c.name | titlecase }}
                </button>
              }
            </div>
          }

          <div class="search-wrap">
            <span class="search-icon" aria-hidden="true"><app-icon name="search" [size]="16" /></span>
            <input
              class="search-input"
              type="search"
              placeholder="Cerca variante o percorso…"
              [value]="query()"
              (input)="query.set($any($event.target).value)"
              aria-label="Cerca variante o percorso"
            />
          </div>

          @if (catalogResource.isLoading()) {
            <div class="empty">Caricamento…</div>
          } @else if (filteredGroups().length === 0) {
            <div class="empty">
              <app-icon name="send" [size]="32" />
              <span>{{ query() ? 'Nessun risultato per "' + query() + '"' : 'Nessuna variante trovata' }}</span>
            </div>
          } @else {
            @for (group of filteredGroups(); track group.clientId) {
              <div class="client-group">
                <div class="group-header">
                  <span class="group-name">{{ group.clientName }}</span>
                  <span class="group-count">{{ group.variants.length }} {{ group.variants.length === 1 ? 'variante' : 'varianti' }}</span>
                  <span class="group-line" aria-hidden="true"></span>
                </div>
                @for (entry of group.variants; track entry.variantId) {
                  <div class="variant-card">
                    <div class="variant-header">
                      <span class="variant-name">{{ entry.variantName }}</span>
                      <span class="variant-meta">· {{ entry.serviceName }}</span>
                    </div>
                    <app-telegram-segments-panel [variantId]="entry.variantId" />
                  </div>
                }
              </div>
            }
          }
        }

        @case ('forms') {
          <p class="page-sub">Tracciamento degli invii: link form e sblocchi Telegram inviati ai venditori.</p>

          @if (submissionsResource.isLoading()) {
            <div class="empty">Caricamento…</div>
          } @else if (!submissionsResource.value()?.length) {
            <div class="empty">
              <app-icon name="inbox" [size]="32" />
              <span>Nessun form ancora inviato</span>
            </div>
          } @else {
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Cliente</th>
                    <th scope="col">Venditore</th>
                    <th scope="col">Rata</th>
                    <th scope="col">Stato form</th>
                    <th scope="col">Link inviato</th>
                    <th scope="col">Sblocco inviato</th>
                    <th scope="col">Compilato il</th>
                  </tr>
                </thead>
                <tbody>
                  @for (sub of submissionsResource.value()!; track sub.id) {
                    <tr>
                      <td>
                        <div class="name">{{ customerLabel(sub) }}</div>
                        @if (sub.customer?.email) {
                          <div class="secondary">{{ sub.customer!.email }}</div>
                        }
                      </td>
                      <td>{{ sellerLabel(sub) }}</td>
                      <td>{{ rataLabel(sub) }}</td>
                      <td>
                        <span class="badge" [class.badge-ok]="sub.status === 'completed'" [class.badge-pending]="sub.status === 'pending'">
                          {{ sub.status === 'completed' ? 'Compilato' : 'In attesa' }}
                        </span>
                      </td>
                      <td>
                        @if (sub.formLinkSentAt) {
                          <span class="sent" [title]="sub.formLinkSentAt | date:'dd/MM/yyyy HH:mm'">
                            ✓ {{ sub.formLinkSentAt | date:'dd/MM HH:mm' }}
                          </span>
                        } @else {
                          <span class="not-sent" title="Non ancora inviato">—</span>
                        }
                      </td>
                      <td>
                        @if (sub.unlockSentAt) {
                          <span class="sent" [title]="sub.unlockSentAt | date:'dd/MM/yyyy HH:mm'">
                            ✓ {{ sub.unlockSentAt | date:'dd/MM HH:mm' }}
                          </span>
                        } @else {
                          <span class="not-sent" title="Non ancora inviato">—</span>
                        }
                      </td>
                      <td>
                        @if (sub.submittedAt) {
                          {{ sub.submittedAt | date:'dd/MM/yyyy HH:mm' }}
                        } @else {
                          <span class="secondary">—</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
      }
    </div>
  `,
})
export class OnboardingComponent {
  private readonly catalogApi = inject(CatalogApiService);
  private readonly formApi = inject(OnboardingFormApiService);

  readonly activeTab = signal<Tab>('channels');
  readonly query = signal('');
  readonly selectedClientId = signal<number | null>(null);

  readonly catalogResource = rxResource({
    stream: () => this.catalogApi.getCatalog(),
  });

  readonly submissionsResource = rxResource({
    stream: () => this.formApi.getSubmissions(),
  });

  readonly pendingCount = computed(() =>
    (this.submissionsResource.value() ?? []).filter(s => s.status === 'pending').length,
  );

  readonly allVariants = computed<VariantEntry[]>(() => {
    const services = (this.catalogResource.value() as any[]) ?? [];
    const entries: VariantEntry[] = [];
    for (const svc of services) {
      for (const variant of svc.variants ?? []) {
        entries.push({
          variantId: Number(variant.id),
          variantName: variant.name ?? '—',
          serviceName: svc.name ?? '—',
          clientName: svc.client?.name ?? null,
          clientId: svc.client?.id ?? null,
        });
      }
    }
    return entries;
  });

  readonly clients = computed(() => {
    const map = new Map<number | null, string>();
    for (const e of this.allVariants()) {
      if (!map.has(e.clientId)) {
        map.set(e.clientId, e.clientName ?? 'Senza cliente');
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => {
        if (a.id === null) return 1;
        if (b.id === null) return -1;
        return a.name.localeCompare(b.name);
      });
  });

  readonly filteredGroups = computed<ClientGroup[]>(() => {
    const q = this.query().toLowerCase().trim();
    const clientId = this.selectedClientId();

    const filtered = this.allVariants().filter(e => {
      const matchesClient = clientId === null || e.clientId === clientId;
      const matchesQuery = !q ||
        e.variantName.toLowerCase().includes(q) ||
        e.serviceName.toLowerCase().includes(q) ||
        (e.clientName ?? '').toLowerCase().includes(q);
      return matchesClient && matchesQuery;
    });

    const groupMap = new Map<number | null, ClientGroup>();
    for (const e of filtered) {
      if (!groupMap.has(e.clientId)) {
        groupMap.set(e.clientId, { clientId: e.clientId, clientName: e.clientName ?? 'Senza cliente', variants: [] });
      }
      groupMap.get(e.clientId)!.variants.push(e);
    }
    return [...groupMap.values()].sort((a, b) => {
      if (a.clientId === null) return 1;
      if (b.clientId === null) return -1;
      return a.clientName.localeCompare(b.clientName);
    });
  });

  customerLabel(sub: { customer: { name: string | null; surname: string | null; email: string | null } | null }): string {
    if (!sub.customer) return '—';
    return [sub.customer.name, sub.customer.surname].filter(Boolean).join(' ') || sub.customer.email || '—';
  }

  sellerLabel(sub: { installment: { sale: { seller: { name: string | null; lastName: string | null } | null } | null } | null }): string {
    const seller = sub.installment?.sale?.seller;
    if (!seller) return '—';
    return [seller.name, seller.lastName].filter(Boolean).join(' ') || '—';
  }

  rataLabel(sub: { installment: { installmentNumber: number } | null }): string {
    const n = sub.installment?.installmentNumber;
    if (n == null) return '—';
    return n === 0 ? 'acconto' : `rata ${n}`;
  }
}
