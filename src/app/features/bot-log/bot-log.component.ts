import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { IconComponent } from '../../shared/icon.component';
import { BotLogApiService, BotLogItem, BotLogPage, BotLogType } from '../../bot-log/bot-log-api.service';
import { SellerApiService } from '../../seller/seller-api.service';

const TYPE_META: Record<BotLogType, { label: string; color: string; icon: string }> = {
  seller_verified: { label: 'Venditore verificato',  color: 'green',  icon: 'check' },
  unlock_sent:     { label: 'Sblocco inviato',        color: 'blue',   icon: 'zap'   },
  join_approved:   { label: 'Accesso approvato',      color: 'green',  icon: 'check' },
  join_declined:   { label: 'Accesso rifiutato',      color: 'red',    icon: 'x'     },
  link_revoked:    { label: 'Link revocato',           color: 'gray',   icon: 'x'     },
};

const PAGE_SIZE = 50;

@Component({
  selector: 'app-bot-log',
  imports: [IconComponent],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1><app-icon name="activity" [size]="20" /> Attività Bot Telegram</h1>
          <p class="page-sub">Log automatico di ogni azione eseguita dal bot</p>
        </div>
      </div>

      <!-- Filters -->
      <div class="toolbar">
        <select class="filter-select" [value]="typeFilter()" (change)="onTypeChange($any($event.target).value)">
          <option value="">Tutti i tipi</option>
          @for (entry of typeEntries; track entry.value) {
            <option [value]="entry.value">{{ entry.label }}</option>
          }
        </select>

        <span class="total-badge">
          {{ logs.value()?.total ?? 0 }} eventi
        </span>
      </div>

      <!-- Content -->
      @if (logs.isLoading()) {
        <div class="empty"><span class="spinner"></span> Caricamento…</div>
      } @else if (logs.error()) {
        <div class="error-banner"><app-icon name="alertTriangle" [size]="16" /> Errore nel caricamento</div>
      } @else if (!items().length) {
        <div class="empty">
          <app-icon name="activity" [size]="32" />
          <span>Nessun evento registrato</span>
          <small>Gli eventi compaiono qui non appena il bot esegue azioni</small>
        </div>
      } @else {
        <div class="log-list card">
          @for (item of items(); track item.id) {
            <div class="log-row" [class]="'type-' + item.type">
              <div class="log-icon" [class]="colorFor(item.type)">
                <app-icon [name]="iconFor(item.type)" [size]="14" />
              </div>

              <div class="log-body">
                <div class="log-title">
                  <span class="log-type-badge" [class]="colorFor(item.type)">{{ labelFor(item.type) }}</span>
                  @if (item.customerName) {
                    <span class="log-customer">{{ item.customerName }}</span>
                  }
                  @if (item.segmentName) {
                    <span class="log-segment">· {{ item.segmentName }}</span>
                  }
                </div>
                <div class="log-meta">
                  @if (item.telegramUserId) {
                    <span class="meta-chip">
                      <app-icon name="phone" [size]="11" /> {{ item.telegramUserId }}
                    </span>
                  }
                  @if (sellerName(item.sellerId); as name) {
                    <span class="meta-chip seller-chip">
                      <app-icon name="users" [size]="11" /> {{ name }}
                    </span>
                  }
                  @if (item.channelId) {
                    <span class="meta-chip">
                      <app-icon name="users" [size]="11" /> canale {{ item.channelId }}
                    </span>
                  }
                  @if (item.saleId) {
                    <span class="meta-chip">vendita #{{ item.saleId }}</span>
                  }
                  @if (item.installmentId) {
                    <span class="meta-chip">rata #{{ item.installmentId }}</span>
                  }
                  @if (extraReason(item)) {
                    <span class="meta-chip warn">{{ extraReason(item) }}</span>
                  }
                </div>
              </div>

              <div class="log-time">{{ formatDate(item.createdAt) }}</div>
            </div>
          }
        </div>

        <!-- Pagination -->
        @if ((logs.value()?.total ?? 0) > PAGE_SIZE) {
          <div class="pagination">
            <button class="btn-outline" [disabled]="page() === 0" (click)="page.update(p => p - 1)">
              <app-icon name="chevronL" [size]="16" />
            </button>
            <span>Pagina {{ page() + 1 }} / {{ totalPages() }}</span>
            <button class="btn-outline" [disabled]="page() >= totalPages() - 1" (click)="page.update(p => p + 1)">
              <app-icon name="chevron" [size]="16" />
            </button>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    h1 { display: flex; align-items: center; gap: 8px; }

    .toolbar {
      display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;
    }

    .filter-select {
      height: 36px; padding: 0 10px;
      border: 1px solid var(--border); border-radius: 9px;
      background: var(--surface); color: var(--ink);
      font-size: 13px; font-family: inherit; font-weight: 500;
      cursor: pointer; outline: none;
    }
    .filter-select:focus { border-color: var(--accent); }

    .total-badge {
      font-size: 12.5px; font-weight: 600; color: var(--ink-3);
      margin-left: auto;
    }

    .log-list { padding: 0; overflow: hidden; }

    .log-row {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 13px 16px;
      border-bottom: 1px solid var(--border-2, #f3f4f6);
      transition: background .1s;
    }
    .log-row:last-child { border-bottom: none; }
    .log-row:hover { background: var(--surface-2); }

    .log-icon {
      flex-shrink: 0;
      width: 28px; height: 28px;
      border-radius: 8px;
      display: grid; place-items: center;
      margin-top: 1px;
    }
    .log-icon.green { background: #dcfce7; color: #15803d; }
    .log-icon.blue  { background: #ede9fe; color: #6d28d9; }
    .log-icon.red   { background: #fee2e2; color: #b91c1c; }
    .log-icon.gray  { background: #f3f4f6; color: #6b7280; }

    .log-body { flex: 1; min-width: 0; }

    .log-title {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      margin-bottom: 5px;
    }

    .log-type-badge {
      font-size: 11px; font-weight: 700; padding: 2px 8px;
      border-radius: 20px; white-space: nowrap;
    }
    .log-type-badge.green { background: #dcfce7; color: #15803d; }
    .log-type-badge.blue  { background: #ede9fe; color: #6d28d9; }
    .log-type-badge.red   { background: #fee2e2; color: #b91c1c; }
    .log-type-badge.gray  { background: #f3f4f6; color: #6b7280; }

    .log-customer { font-weight: 700; font-size: 13.5px; color: var(--ink); }
    .log-segment  { font-size: 12px; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px; }

    .log-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .meta-chip {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 11.5px; color: var(--ink-3);
      background: var(--surface-2); border: 1px solid var(--border);
      border-radius: 6px; padding: 1px 6px;
    }
    .meta-chip.warn { background: #fef3c7; border-color: #fcd34d; color: #92400e; }
    .meta-chip.seller-chip { background: #ede9fe; border-color: #c4b5fd; color: #5b21b6; font-weight: 600; }

    .log-time {
      flex-shrink: 0; font-size: 11.5px; color: var(--ink-3);
      white-space: nowrap; padding-top: 2px;
    }

    .pagination {
      display: flex; align-items: center; justify-content: center;
      gap: 12px; margin-top: 16px; font-size: 13px; color: var(--ink-3);
    }
    .btn-outline {
      display: flex; align-items: center; padding: 6px 10px;
      border: 1px solid var(--border); border-radius: 8px;
      background: var(--surface); cursor: pointer; color: var(--ink);
    }
    .btn-outline:disabled { opacity: .4; cursor: not-allowed; }
    .btn-outline:not(:disabled):hover { background: var(--surface-2); }

    .error-banner {
      display: flex; align-items: center; gap: 8px;
      padding: 14px 16px; background: #fee2e2; border-radius: 10px;
      color: #b91c1c; font-size: 13.5px; font-weight: 500; margin-bottom: 16px;
    }

    .spinner {
      display: inline-block; width: 18px; height: 18px;
      border: 2px solid #e5e7eb; border-top-color: var(--accent);
      border-radius: 50%; animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 760px) {
      .log-segment { display: none; }
      .log-time { font-size: 10.5px; }
    }
  `],
})
export class BotLogComponent {
  private readonly api = inject(BotLogApiService);
  private readonly sellerApi = inject(SellerApiService);

  readonly sellers = rxResource({ stream: () => this.sellerApi.getAll() });

  private readonly sellerMap = computed(() => {
    const map = new Map<number, string>();
    for (const s of this.sellers.value() ?? []) {
      map.set(Number(s.id), [s.name, s.lastName].filter(v => !!v).join(' ') || s.email || `#${s.id}`);
    }
    return map;
  });

  sellerName(id: number | null): string | null {
    if (!id) return null;
    return this.sellerMap().get(Number(id)) ?? null;
  }

  readonly typeFilter = signal<string>('');
  readonly page = signal(0);

  protected readonly PAGE_SIZE = PAGE_SIZE;

  readonly typeEntries = (Object.entries(TYPE_META) as [BotLogType, typeof TYPE_META[BotLogType]][])
    .map(([value, meta]) => ({ value, label: meta.label }));

  readonly logs = rxResource<BotLogPage, { type: string; page: number }>({
    params: () => ({ type: this.typeFilter(), page: this.page() }),
    stream: ({ params: r }) =>
      this.api.getAll({ type: r.type || undefined, limit: PAGE_SIZE, offset: r.page * PAGE_SIZE }),
  });

  readonly items = computed(() => this.logs.value()?.items ?? []);
  readonly totalPages = computed(() => Math.ceil((this.logs.value()?.total ?? 0) / PAGE_SIZE));

  onTypeChange(value: string) {
    this.typeFilter.set(value);
    this.page.set(0);
  }

  labelFor(type: BotLogType) { return TYPE_META[type]?.label ?? type; }
  colorFor(type: BotLogType) { return TYPE_META[type]?.color ?? 'gray'; }
  iconFor(type: BotLogType)  { return TYPE_META[type]?.icon  ?? 'activity'; }

  extraReason(item: BotLogItem): string | null {
    if (item.type === 'join_declined' && item.extra?.['reason']) {
      return item.extra['reason'] === 'link_not_found' ? 'link non trovato' : 'rata non pagata';
    }
    return null;
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const time = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `oggi ${time}`;
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) + ` ${time}`;
  }
}
