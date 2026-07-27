import { Component, inject, signal, computed } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TitleCasePipe } from '@angular/common';
import { CatalogApiService } from '../../catalog/catalog-api.service';
import { TelegramSegmentsPanelComponent } from '../catalog/telegram-segments-panel.component';
import { IconComponent } from '../../shared/icon.component';

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
  imports: [TelegramSegmentsPanelComponent, TitleCasePipe, IconComponent],
  styles: [`
    :host { display: block; }

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
  `],
  template: `
    <div class="page">
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
    </div>
  `,
})
export class OnboardingComponent {
  private readonly api = inject(CatalogApiService);

  readonly query = signal('');
  readonly selectedClientId = signal<number | null>(null);

  readonly catalogResource = rxResource({
    stream: () => this.api.getCatalog(),
  });

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
}
