import { Component, inject, signal, computed } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CatalogApiService, CatalogVariant } from '../../catalog/catalog-api.service';
import { TelegramSegmentsPanelComponent } from '../catalog/telegram-segments-panel.component';

interface VariantEntry {
  variantId: number;
  variantName: string;
  serviceName: string;
  clientName: string | null;
}

@Component({
  selector: 'app-onboarding',
  imports: [TelegramSegmentsPanelComponent],
  styles: [`
    :host { display: block; padding: 1.5rem; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 1.2rem; font-weight: 700; margin: 0 0 .25rem; }
    .subtitle { font-size: 13px; color: var(--ink-3, #888); margin: 0 0 1.5rem; }
    .search-wrap { margin-bottom: 1rem; }
    .search-input { width: 100%; max-width: 360px; padding: 6px 10px; border: 1px solid var(--border, #ddd); border-radius: 6px; font-size: 13px; }
    .variant-card { background: #fff; border: 1px solid var(--border, #e5e7eb); border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: .75rem; }
    .variant-header { display: flex; align-items: baseline; gap: .5rem; margin-bottom: .1rem; }
    .variant-name { font-weight: 600; font-size: 14px; }
    .variant-meta { font-size: 12px; color: var(--ink-3, #888); }
    .empty { color: var(--ink-3, #888); font-size: 14px; padding: 2rem 0; text-align: center; }
  `],
  template: `
    <h1>Onboarding Telegram</h1>
    <p class="subtitle">Configura gli sblocchi automatici dei canali Telegram per ogni variante di percorso.</p>

    <div class="search-wrap">
      <input
        class="search-input"
        type="search"
        placeholder="Cerca variante o percorso…"
        [value]="query()"
        (input)="query.set($any($event.target).value)"
      />
    </div>

    @if (catalogResource.isLoading()) {
      <div class="empty">Caricamento…</div>
    } @else if (filtered().length === 0) {
      <div class="empty">Nessuna variante trovata</div>
    } @else {
      @for (entry of filtered(); track entry.variantId) {
        <div class="variant-card">
          <div class="variant-header">
            <span class="variant-name">{{ entry.variantName }}</span>
            <span class="variant-meta">· {{ entry.serviceName }}
              @if (entry.clientName) { · {{ entry.clientName }} }
            </span>
          </div>
          <app-telegram-segments-panel [variantId]="entry.variantId" />
        </div>
      }
    }
  `,
})
export class OnboardingComponent {
  private readonly api = inject(CatalogApiService);

  readonly query = signal('');

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
        });
      }
    }
    return entries;
  });

  readonly filtered = computed(() => {
    const q = this.query().toLowerCase().trim();
    if (!q) return this.allVariants();
    return this.allVariants().filter(e =>
      e.variantName.toLowerCase().includes(q) ||
      e.serviceName.toLowerCase().includes(q) ||
      (e.clientName ?? '').toLowerCase().includes(q)
    );
  });
}
