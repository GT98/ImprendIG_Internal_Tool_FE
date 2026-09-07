import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { SalesStateService } from '../../sales-state.service';
import { AuthService } from '../../auth/auth.service';
import { LeadsService, SellerBasicDto, CreateLeadDto } from '../../leads/lead.service';
import { type Lead } from '../../leads/lead.model';
import { type Call, type Seller } from '../../models';
import { IconComponent } from '../../shared/icon.component';
import { AvatarComponent } from '../../shared/avatar.component';
import { StatCardComponent } from '../../shared/stat-card.component';
import { StatusBadgeComponent, CALL_STATUS } from '../../shared/badge.component';
import { SegmentedComponent } from '../../shared/segmented.component';
import { CallDrawerComponent } from './call-drawer.component';
import { DateNavComponent } from './date-nav.component';
import { ToastService } from '../../shared/toast.service';
import { addDays, addMonths, dayKey, eur, fmtDate, fmtDateISO, fmtMonthISO, fmtTime, getMonday, isSameDay, startOfDay, startOfMonth } from '../../utils';

// ── Adapter helpers ──────────────────────────────────────────────────────────

const SELLER_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6'];

const DA_FARE = new Set(['nuovo', 'in-corso', 'da-fare', 'programmata', '']);
const NO_SHOW = new Set(['no-show', 'no_show']);

function toDisplayStatus(raw: string): 'da-fare' | 'fatta' | 'no-show' {
  const v = (raw ?? '').toLowerCase().trim().replace(/_/g, '-');
  if (DA_FARE.has(v)) return 'da-fare';
  if (NO_SHOW.has(v)) return 'no-show';
  return 'fatta';
}

export const UNKNOWN_SELLER: Seller = {
  id: '0',
  name: 'N/D',
  initials: '?',
  color: '#9498a8',
  role: 'venditore',
};

function makeSellerFromApi(s: NonNullable<Lead['seller']>): Seller {
  const initials =
    [(s.name?.[0] ?? ''), (s.lastName?.[0] ?? '')].join('').toUpperCase() || '?';
  return {
    id: String(s.id),
    name: [s.name, s.lastName].filter(Boolean).join(' ') || 'Sconosciuto',
    initials,
    color: SELLER_COLORS[Number(s.id) % SELLER_COLORS.length],
    role: 'venditore',
  };
}

function leadToCall(lead: Lead): Call {
  return {
    id: String(lead.id),
    sellerId: String(lead.seller?.id ?? ''),
    setterId: lead.setter ? String(lead.setter.id) : null,
    client: [lead.name, lead.surname].filter(Boolean).join(' ') || '—',
    company: lead.client?.name ?? '—',
    type: 'demo',
    status: toDisplayStatus(lead.statusOption?.code ?? ''),
    statusCode: lead.statusOption?.code ?? null,
    statusOptionId: lead.statusOption?.id ?? null,
    value: 0,
    when: lead.callStartDate!,
    link: '',
    notes: lead.notes ?? null,
    sellerNotes: lead.sellerNotes ?? null,
    formCliente: lead.formCliente ?? null,
  };
}

function groupByDay(calls: Call[]): { day: string; items: Call[] }[] {
  const sorted = [...calls].sort(
    (a, b) => new Date(a.when).getTime() - new Date(b.when).getTime(),
  );
  const map = new Map<string, Call[]>();
  sorted.forEach(c => {
    const k = dayKey(c.when);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(c);
  });
  return Array.from(map.entries()).map(([day, items]) => ({ day, items }));
}

function sellerDisplayName(s: { name: string | null; lastName: string | null } | null): string {
  return [s?.name, s?.lastName].filter(Boolean).join(' ') || '—';
}

// ── List view ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-list-view',
  imports: [IconComponent, AvatarComponent, StatusBadgeComponent],
  template: `
    <div class="list-view">
      @for (group of groups(); track group.day) {
        <div class="day-group">
          <div class="day-header">
            <span>{{ group.day }}</span>
            <span class="day-count">{{ group.items.length }}</span>
          </div>
          <div class="call-list">
            @for (c of group.items; track c.id) {
              <div class="call-row" role="button" tabindex="0"
                   (click)="openCall.emit(c)"
                   (keydown.enter)="openCall.emit(c)"
                   (keydown.space)="$event.preventDefault(); openCall.emit(c)">
                <div class="call-time">
                  <span class="ct-hour">{{ fmt(c.when) }}</span>
                </div>
                <div class="call-main">
                  <div class="call-client">{{ c.client }}</div>
                  <div class="call-company">{{ c.company }}</div>
                </div>
                @if (isAdmin()) {
                  <div class="call-seller">
                    <app-avatar [seller]="sellersById()[c.sellerId] ?? unknownSeller" [size]="28" />
                  </div>
                }
                <div class="call-status"><app-status-badge [status]="c.statusCode ?? c.status" /></div>
                <div class="row-quick-actions" (click)="$event.stopPropagation()">
                  <button class="rqa-btn" (click)="quickTransfer.emit(c)"
                          aria-label="Trasferisci chiamata">
                    <app-icon name="swap" [size]="14" />
                    <span class="rqa-label">Trasferisci</span>
                  </button>
                  <button class="rqa-btn" (click)="quickReschedule.emit(c)"
                          aria-label="Riprogramma chiamata">
                    <app-icon name="calendar" [size]="14" />
                    <span class="rqa-label">Riprogramma</span>
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class ListViewComponent {
  readonly calls = input.required<Call[]>();
  readonly isAdmin = input.required<boolean>();
  readonly sellersById = input.required<Record<string, Seller>>();
  readonly openCall = output<Call>();
  readonly quickTransfer = output<Call>();
  readonly quickReschedule = output<Call>();
  readonly unknownSeller = UNKNOWN_SELLER;
  readonly fmt = fmtTime;
  readonly groups = computed(() => groupByDay(this.calls()));
}

// ── Kanban view ──────────────────────────────────────────────────────────────

@Component({
  selector: 'app-kanban-view',
  imports: [IconComponent, AvatarComponent],
  template: `
    <div class="kanban">
      @for (col of cols; track col.key) {
        <div class="kanban-col">
          <div class="kanban-head">
            <span class="kanban-dot" [style.background]="statusDot(col.key)"></span>
            <span class="kanban-title">{{ col.label }}</span>
            <span class="kanban-count">{{ colItems(col.key).length }}</span>
          </div>
          <div class="kanban-cards">
            @for (c of colItems(col.key); track c.id) {
              <div class="kanban-card" role="button" tabindex="0"
                   (click)="openCall.emit(c)"
                   (keydown.enter)="openCall.emit(c)"
                   (keydown.space)="$event.preventDefault(); openCall.emit(c)">
                <div class="kc-top">
                  <span class="kc-val">{{ fmt(c.when) }}</span>
                  <div class="kc-actions" (click)="$event.stopPropagation()">
                    <button class="rqa-btn sm" (click)="quickTransfer.emit(c)"
                            title="Trasferisci" aria-label="Trasferisci chiamata">
                      <app-icon name="swap" [size]="12" />
                    </button>
                    <button class="rqa-btn sm" (click)="quickReschedule.emit(c)"
                            title="Riprogramma" aria-label="Riprogramma chiamata">
                      <app-icon name="calendar" [size]="12" />
                    </button>
                  </div>
                </div>
                <div class="kc-client">{{ c.client }}</div>
                <div class="kc-company">{{ c.company }}</div>
                @if (isAdmin()) {
                  <div class="kc-foot">
                    <app-avatar [seller]="sellersById()[c.sellerId] ?? unknownSeller" [size]="22" />
                  </div>
                }
              </div>
            }
            @if (colItems(col.key).length === 0) {
              <div class="kanban-empty">Nessuna</div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class KanbanViewComponent {
  readonly calls = input.required<Call[]>();
  readonly isAdmin = input.required<boolean>();
  readonly sellersById = input.required<Record<string, Seller>>();
  readonly openCall = output<Call>();
  readonly quickTransfer = output<Call>();
  readonly quickReschedule = output<Call>();
  readonly unknownSeller = UNKNOWN_SELLER;
  readonly fmt = fmtTime;

  readonly cols = [
    { key: 'da-fare', label: 'Da fare' },
    { key: 'fatta', label: 'Completate' },
    { key: 'no-show', label: 'No-show' },
  ];

  statusDot(key: string): string {
    return CALL_STATUS[key]?.dot ?? '#ccc';
  }

  colItems(key: string): Call[] {
    return this.calls()
      .filter(c => c.status === key)
      .sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime());
  }
}

// ── Agenda view ──────────────────────────────────────────────────────────────

@Component({
  selector: 'app-agenda-view',
  imports: [AvatarComponent, StatusBadgeComponent],
  template: `
    <div class="agenda">
      @for (group of groups(); track group.day) {
        <div class="agenda-day">
          <div class="agenda-daycol">
            <div class="agenda-dayname">{{ group.day }}</div>
            <div class="agenda-daycount">{{ group.items.length }} chiamate</div>
          </div>
          <div class="agenda-track">
            @for (c of group.items; track c.id) {
              <button class="agenda-item" (click)="openCall.emit(c)">
                <div class="agenda-time">{{ fmt(c.when) }}</div>
                <div class="agenda-line" [style.background]="statusDot(c.status)"></div>
                <div class="agenda-body">
                  <div class="agenda-row1">
                    <span class="agenda-client">{{ c.client }}</span>
                    <app-status-badge [status]="c.statusCode ?? c.status" />
                  </div>
                  <div class="agenda-row2">
                    <span>{{ c.company }}</span>
                    @if (isAdmin()) {
                      <app-avatar
                        [seller]="sellersById()[c.sellerId] ?? unknownSeller"
                        [size]="22"
                      />
                    }
                  </div>
                </div>
              </button>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class AgendaViewComponent {
  readonly calls = input.required<Call[]>();
  readonly isAdmin = input.required<boolean>();
  readonly sellersById = input.required<Record<string, Seller>>();
  readonly openCall = output<Call>();
  readonly unknownSeller = UNKNOWN_SELLER;
  readonly fmt = fmtTime;
  readonly groups = computed(() => groupByDay(this.calls()));

  statusDot(status: string): string {
    return CALL_STATUS[status]?.dot ?? '#ccc';
  }
}

// ── Quick action modal (transfer / reschedule without opening the drawer) ─────

@Component({
  selector: 'app-call-quick-action',
  imports: [IconComponent],
  template: `
    <div class="modal-overlay" role="dialog" aria-modal="true"
         [attr.aria-label]="type() === 'transfer' ? 'Trasferisci chiamata' : 'Riprogramma chiamata'"
         (click)="closed.emit()"
         (keydown.escape)="closed.emit()">
      <div class="modal-card" (click)="$event.stopPropagation()">

        <div class="modal-head">
          <div>
            <div class="modal-title">
              @if (type() === 'transfer') { Trasferisci chiamata }
              @else { Riprogramma chiamata }
            </div>
            <div class="modal-sub">{{ call().client }}</div>
          </div>
          <button class="icon-btn" (click)="closed.emit()" aria-label="Chiudi">
            <app-icon name="x" [size]="18" />
          </button>
        </div>

        @if (type() === 'transfer') {
          <div class="modal-field">
            <label class="ap-label" for="qm-seller">Venditore</label>
            @if (sellersResource.isLoading()) {
              <div class="esito-loading">Caricamento…</div>
            } @else {
              <select id="qm-seller" class="modal-select"
                      [value]="transferSellerId() ?? ''"
                      (change)="transferSellerId.set(+$any($event.target).value || null)">
                <option value="">— Seleziona venditore —</option>
                @for (s of otherSellers(); track s.id) {
                  <option [value]="s.id">{{ displayName(s) }}</option>
                }
              </select>
            }
          </div>
          <div class="modal-field">
            <label class="ap-label" for="qm-tnote">Nota (opzionale)</label>
            <input id="qm-tnote" class="modal-input" type="text"
                   placeholder="Es: cliente preferisce chiamate mattutine"
                   [value]="note()" (input)="note.set($any($event.target).value)" />
          </div>
        } @else {
          <div class="modal-field">
            <label class="ap-label" for="qm-date">Nuova data e ora</label>
            <input id="qm-date" class="modal-input" type="datetime-local"
                   [min]="minDateTime()" [value]="rescheduleDate()"
                   (input)="rescheduleDate.set($any($event.target).value)" />
          </div>
          <div class="modal-field">
            <label class="ap-label" for="qm-rnote">Nota (opzionale)</label>
            <input id="qm-rnote" class="modal-input" type="text"
                   placeholder="Es: accordo privato con la cliente"
                   [value]="note()" (input)="note.set($any($event.target).value)" />
          </div>
        }

        <div class="modal-footer">
          <button class="btn-ghost" (click)="closed.emit()">Annulla</button>
          <button class="btn-primary" [disabled]="!canSubmit() || acting()" (click)="submit()">
            @if (acting()) { Salvataggio… }
            @else if (type() === 'transfer') { Conferma trasferimento }
            @else { Conferma data }
          </button>
        </div>

      </div>
    </div>
  `,
})
export class CallQuickActionModalComponent {
  readonly call = input.required<Call>();
  readonly type = input.required<'transfer' | 'reschedule'>();
  readonly done = output<void>();
  readonly closed = output<void>();

  private readonly leadsService = inject(LeadsService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly sellersResource = rxResource({ stream: () => this.leadsService.getSellers() });

  readonly transferSellerId = signal<number | null>(null);
  readonly rescheduleDate = signal('');
  readonly note = signal('');
  readonly acting = signal(false);

  readonly minDateTime = computed(() => new Date().toISOString().slice(0, 16));

  readonly otherSellers = computed(() =>
    (this.sellersResource.value() ?? []).filter(s => String(s.id) !== this.call().sellerId),
  );

  readonly canSubmit = computed(() =>
    this.type() === 'transfer' ? !!this.transferSellerId() : !!this.rescheduleDate(),
  );

  private readonly currentSellerId = computed(() => this.auth.currentUser()?.sellerId ?? null);

  readonly displayName = (s: SellerBasicDto) =>
    [s.name, s.lastName].filter(Boolean).join(' ') || '—';

  ngOnInit(): void {
    this.rescheduleDate.set(this.call().when.slice(0, 16));
  }

  submit(): void {
    if (this.type() === 'transfer') {
      this.submitTransfer();
    } else {
      this.submitReschedule();
    }
  }

  private submitTransfer(): void {
    const toId = this.transferSellerId();
    if (!toId) return;

    const allSellers = this.sellersResource.value() ?? [];
    const fromSeller = allSellers.find(s => Number(s.id) === Number(this.call().sellerId)) ?? null;
    const toSeller = allSellers.find(s => Number(s.id) === Number(toId)) ?? null;

    const payload = JSON.stringify({
      fromSellerId: Number(this.call().sellerId),
      fromName: sellerDisplayName(fromSeller),
      toSellerId: toId,
      toName: sellerDisplayName(toSeller),
    });

    this.acting.set(true);
    this.leadsService.patch(this.call().id, { sellerId: toId }).pipe(
      switchMap(() => this.leadsService.createEvent(this.call().id, {
        type: 'transfer',
        payload,
        note: this.note().trim() || undefined,
        createdBySellerId: this.currentSellerId() ?? undefined,
      })),
    ).subscribe({
      next: () => {
        this.acting.set(false);
        this.toast.success('Chiamata trasferita correttamente');
        this.done.emit();
        this.closed.emit();
      },
      error: () => {
        this.acting.set(false);
        this.toast.error('Impossibile trasferire la chiamata. Riprova.');
      },
    });
  }

  private submitReschedule(): void {
    const dateStr = this.rescheduleDate();
    if (!dateStr) return;

    const oldDate = this.call().when;
    const newDate = new Date(dateStr).toISOString();
    const payload = JSON.stringify({ oldDate, newDate });

    this.acting.set(true);
    this.leadsService.patch(this.call().id, { callStartDate: newDate }).pipe(
      switchMap(() => this.leadsService.createEvent(this.call().id, {
        type: 'reschedule',
        payload,
        note: this.note().trim() || undefined,
        createdBySellerId: this.currentSellerId() ?? undefined,
      })),
    ).subscribe({
      next: () => {
        this.acting.set(false);
        this.toast.success('Chiamata riprogrammata correttamente');
        this.done.emit();
        this.closed.emit();
      },
      error: () => {
        this.acting.set(false);
        this.toast.error('Impossibile riprogrammare la chiamata. Riprova.');
      },
    });
  }
}

// ── New call modal ───────────────────────────────────────────────────────────

@Component({
  selector: 'app-new-call-modal',
  imports: [IconComponent],
  template: `
    <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Nuova chiamata"
         (click)="closed.emit()" (keydown.escape)="closed.emit()">
      <div class="modal-card modal-card--wide" (click)="$event.stopPropagation()">

        <div class="modal-head">
          <div class="modal-title">Nuova chiamata</div>
          <button class="icon-btn" (click)="closed.emit()" aria-label="Chiudi">
            <app-icon name="x" [size]="18" />
          </button>
        </div>

        <div class="modal-grid2">
          <div class="modal-field">
            <label class="ap-label" for="nc-name">Nome</label>
            <input id="nc-name" class="modal-input" type="text" placeholder="Nome"
                   [value]="name()" (input)="name.set($any($event.target).value)" />
          </div>
          <div class="modal-field">
            <label class="ap-label" for="nc-surname">Cognome</label>
            <input id="nc-surname" class="modal-input" type="text" placeholder="Cognome"
                   [value]="surname()" (input)="surname.set($any($event.target).value)" />
          </div>
          <div class="modal-field">
            <label class="ap-label" for="nc-email">Email</label>
            <input id="nc-email" class="modal-input" type="email" placeholder="email@esempio.com"
                   [value]="email()" (input)="email.set($any($event.target).value)" />
          </div>
          <div class="modal-field">
            <label class="ap-label" for="nc-phone">Telefono</label>
            <input id="nc-phone" class="modal-input" type="tel" placeholder="+39 000 000 0000"
                   [value]="phone()" (input)="phone.set($any($event.target).value)" />
          </div>
          <div class="modal-field">
            <label class="ap-label" for="nc-date">Data e ora</label>
            <input id="nc-date" class="modal-input" type="datetime-local"
                   [value]="callDate()" (input)="callDate.set($any($event.target).value)" />
          </div>
          <div class="modal-field">
            <label class="ap-label" for="nc-seller">Venditore</label>
            @if (isAdmin()) {
              @if (sellersResource.isLoading()) {
                <div class="esito-loading">Caricamento…</div>
              } @else {
                <select id="nc-seller" class="modal-select"
                        [value]="sellerId() ?? ''"
                        (change)="sellerId.set(+$any($event.target).value || null)">
                  <option value="">— Seleziona venditore —</option>
                  @for (s of sellersResource.value() ?? []; track s.id) {
                    <option [value]="s.id">{{ displayName(s) }}</option>
                  }
                </select>
              }
            } @else {
              <input id="nc-seller" class="modal-input" type="text"
                     [value]="currentSellerName()" readonly aria-readonly="true" />
            }
          </div>
        </div>

        <div class="modal-field">
          <label class="ap-label" for="nc-notes">Note (opzionale)</label>
          <textarea id="nc-notes" class="modal-input modal-textarea" placeholder="Aggiungi una nota…"
                    [value]="notes()" (input)="notes.set($any($event.target).value)"></textarea>
        </div>

        <div class="modal-footer">
          <button class="btn-ghost" (click)="closed.emit()">Annulla</button>
          <button class="btn-primary" [disabled]="!canSubmit() || saving()" (click)="submit()">
            @if (saving()) { Salvataggio… }
            @else { Crea chiamata }
          </button>
        </div>

      </div>
    </div>
  `,
})
export class NewCallModalComponent {
  readonly initialDate = input<string>('');
  readonly done = output<void>();
  readonly closed = output<void>();

  private readonly leadsService = inject(LeadsService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');

  readonly sellersResource = rxResource({ stream: () => this.leadsService.getSellers() });

  readonly name = signal('');
  readonly surname = signal('');
  readonly email = signal('');
  readonly phone = signal('');
  readonly callDate = signal('');
  readonly notes = signal('');
  readonly sellerId = signal<number | null>(null);
  readonly saving = signal(false);

  readonly currentSellerName = computed(() => {
    const id = this.auth.currentUser()?.sellerId;
    if (id == null) return '—';
    const s = (this.sellersResource.value() ?? []).find(x => Number(x.id) === Number(id));
    return s ? this.displayName(s) : '—';
  });

  readonly canSubmit = computed(() => {
    const hasDate = !!this.callDate();
    const hasSeller = this.isAdmin() ? !!this.sellerId() : !!this.auth.currentUser()?.sellerId;
    return hasDate && hasSeller;
  });

  readonly displayName = (s: SellerBasicDto) =>
    [s.name, s.lastName].filter(Boolean).join(' ') || '—';

  ngOnInit(): void {
    this.callDate.set(this.initialDate().slice(0, 16));
    if (!this.isAdmin()) {
      const id = this.auth.currentUser()?.sellerId;
      if (id != null) this.sellerId.set(id);
    }
  }

  submit(): void {
    if (!this.canSubmit()) return;

    const dto: CreateLeadDto = {
      ...(this.name().trim() ? { name: this.name().trim() } : {}),
      ...(this.surname().trim() ? { surname: this.surname().trim() } : {}),
      ...(this.email().trim() ? { email: this.email().trim() } : {}),
      ...(this.phone().trim() ? { phone: this.phone().trim() } : {}),
      ...(this.notes().trim() ? { notes: this.notes().trim() } : {}),
      callStartDate: new Date(this.callDate()).toISOString(),
      sellerId: this.sellerId() ?? undefined,
    };

    this.saving.set(true);
    this.leadsService.create(dto).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Chiamata creata correttamente');
        this.done.emit();
        this.closed.emit();
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Impossibile creare la chiamata. Riprova.');
      },
    });
  }
}

// ── Month calendar view ──────────────────────────────────────────────────────

const DAYS_HEADER = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const MESI_FULL = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

interface CalCell { date: Date; inMonth: boolean; isToday: boolean }

@Component({
  selector: 'app-month-calendar-view',
  imports: [IconComponent],
  styles: [`
    :host { display: block; }
    .cal-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .cal-nav-title { font-size: 15px; font-weight: 700; color: var(--ink); }
    .cal-nav-arrow { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 9px; color: var(--ink-3); transition: background .12s, color .12s; }
    .cal-nav-arrow:hover { background: var(--surface-2); color: var(--ink); }
    .cal-header { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 4px; }
    .cal-header-day { text-align: center; font-size: 10.5px; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: .05em; padding: 4px 0; }
    .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
    .cal-cell {
      min-height: 80px; border: 1px solid var(--border); border-radius: var(--radius);
      padding: 6px; background: var(--surface); transition: background .12s;
      cursor: pointer; display: flex; flex-direction: column; gap: 3px; text-align: left;
    }
    .cal-cell:hover:not(.out-month) { background: var(--surface-2); }
    .cal-cell.out-month { background: transparent; border-color: transparent; cursor: default; }
    .cal-cell.out-month .cal-day-num { opacity: .3; }
    .cal-cell.is-today { border-color: var(--accent); }
    .cal-cell.is-today .cal-day-num { color: var(--accent); font-weight: 800; }
    .cal-day-num { font-size: 12px; font-weight: 600; color: var(--ink-2); line-height: 1; }
    .cal-dots { display: flex; flex-wrap: wrap; gap: 2px; margin-top: 2px; }
    .cal-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .cal-event {
      font-size: 10px; font-weight: 600; color: var(--ink); background: var(--surface-2);
      border-radius: 4px; padding: 2px 4px; white-space: nowrap; overflow: hidden;
      text-overflow: ellipsis; width: 100%;
    }
    .cal-event:hover { opacity: .75; }
    .cal-more { font-size: 9px; font-weight: 700; color: var(--ink-3); }
    @media (max-width: 600px) {
      .cal-cell { min-height: 48px; padding: 4px; }
      .cal-event { display: none; }
      .cal-more { display: none; }
    }
  `],
  template: `
    <div class="cal-nav">
      <button class="cal-nav-arrow" (click)="prevMonth()" aria-label="Mese precedente">
        <app-icon name="chevronL" [size]="16" [stroke]="2.5" />
      </button>
      <span class="cal-nav-title">{{ monthTitle() }}</span>
      <button class="cal-nav-arrow" (click)="nextMonth()" aria-label="Mese successivo">
        <app-icon name="chevron" [size]="16" [stroke]="2.5" />
      </button>
    </div>
    <div class="cal-header" role="row">
      @for (d of daysHeader; track d) {
        <div class="cal-header-day" role="columnheader">{{ d }}</div>
      }
    </div>
    <div class="cal-grid" role="grid">
      @for (cell of flatGrid(); track cell.date.getTime()) {
        <button
          class="cal-cell"
          [class.out-month]="!cell.inMonth"
          [class.is-today]="cell.isToday"
          [disabled]="!cell.inMonth"
          (click)="selectDay(cell.date)"
          [attr.aria-label]="cell.inMonth ? cell.date.getDate() + ' ' + monthTitle() : null"
          role="gridcell"
        >
          <span class="cal-day-num">{{ cell.date.getDate() }}</span>
          @let dayCalls = cellCalls(cell.date);
          @if (dayCalls.length > 0) {
            <div class="cal-dots" aria-hidden="true">
              @for (c of dayCalls.slice(0, 4); track c.id) {
                <span class="cal-dot" [style.background]="statusDot(c.status)"></span>
              }
            </div>
            <span class="cal-event" role="button" tabindex="-1"
                  (click)="$event.stopPropagation(); openCall.emit(dayCalls[0])">
              {{ dayCalls[0].client }}
            </span>
            @if (dayCalls.length > 1) {
              <span class="cal-more">+{{ dayCalls.length - 1 }} altri</span>
            }
          }
        </button>
      }
    </div>
  `,
})
export class MonthCalendarViewComponent {
  readonly calls = input.required<Call[]>();
  readonly isAdmin = input.required<boolean>();
  readonly sellersById = input.required<Record<string, Seller>>();
  readonly month = model.required<Date>();
  readonly daySelected = output<Date>();
  readonly openCall = output<Call>();

  readonly daysHeader = DAYS_HEADER;

  readonly monthTitle = computed(() => {
    const m = this.month();
    return `${MESI_FULL[m.getMonth()]} ${m.getFullYear()}`;
  });

  readonly flatGrid = computed<CalCell[]>(() => {
    const m = this.month();
    const firstDay = new Date(m.getFullYear(), m.getMonth(), 1);
    const gridStart = getMonday(firstDay);
    const now = new Date();
    return Array.from({ length: 42 }, (_, i) => {
      const date = addDays(gridStart, i);
      return { date, inMonth: date.getMonth() === m.getMonth(), isToday: isSameDay(date, now) };
    });
  });

  readonly callsByDay = computed(() => {
    const map = new Map<string, Call[]>();
    this.calls().forEach(c => {
      const k = fmtDateISO(new Date(c.when));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(c);
    });
    return map;
  });

  cellCalls(date: Date): Call[] {
    return this.callsByDay().get(fmtDateISO(date)) ?? [];
  }

  statusDot(status: string): string {
    return CALL_STATUS[status]?.dot ?? '#ccc';
  }

  prevMonth(): void { this.month.update(m => addMonths(m, -1)); }
  nextMonth(): void { this.month.update(m => addMonths(m, 1)); }
  selectDay(date: Date): void { this.daySelected.emit(startOfDay(date)); }
}

// ── Calls page ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-calls',
  imports: [
    IconComponent,
    StatCardComponent,
    SegmentedComponent,
    CallDrawerComponent,
    CallQuickActionModalComponent,
    NewCallModalComponent,
    DateNavComponent,
    ListViewComponent,
    KanbanViewComponent,
    AgendaViewComponent,
    MonthCalendarViewComponent,
  ],
  templateUrl: './calls.component.html',
})
export class CallsComponent {
  private readonly state = inject(SalesStateService);
  private readonly auth = inject(AuthService);
  private readonly leadsService = inject(LeadsService);

  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');
  readonly layout = this.state.layout;

  readonly selectedDate = signal<Date>(startOfDay(new Date()));
  readonly monthViewDate = signal<Date>(startOfMonth(new Date()));

  readonly leadsResource = rxResource<Lead[], string>({
    params: () => fmtDateISO(this.selectedDate()),
    stream: ({ params: date }) => this.leadsService.getByDate(date),
  });

  readonly monthLeadsResource = rxResource<Lead[], string | null>({
    params: () => this.layout() === 'mese' ? fmtMonthISO(this.monthViewDate()) : null,
    stream: ({ params }) => params ? this.leadsService.getByMonth(params) : of([]),
  });

  readonly monthCalls = computed<Call[]>(() =>
    (this.monthLeadsResource.value() ?? [])
      .filter(l => l.callStartDate !== null)
      .map(leadToCall),
  );

  readonly monthTodo = computed(() => this.monthCalls().filter(c => c.status === 'da-fare').length);
  readonly monthDone = computed(() => this.monthCalls().filter(c => c.status === 'fatta').length);
  readonly monthNoShow = computed(() => this.monthCalls().filter(c => c.status === 'no-show').length);

  readonly openCall = signal<Call | null>(null);
  readonly quickAction = signal<{ call: Call; type: 'transfer' | 'reschedule' } | null>(null);
  readonly showNewCallModal = signal(false);
  readonly q = signal('');
  readonly statusF = signal('tutti');

  readonly statusOptsResource = rxResource({
    stream: () => this.leadsService.getStatusOptions(),
  });

  readonly unknownSeller = UNKNOWN_SELLER;

  readonly sellersById = computed<Record<string, Seller>>(() => {
    const map: Record<string, Seller> = { ...this.state.sellersById() };
    (this.leadsResource.value() ?? []).forEach(l => {
      if (l.seller) map[String(l.seller.id)] = makeSellerFromApi(l.seller);
    });
    return map;
  });

  readonly callsForDate = computed<Call[]>(() =>
    (this.leadsResource.value() ?? [])
      .filter(l => l.callStartDate !== null)
      .map(leadToCall),
  );

  readonly filtered = computed(() => {
    const q = this.q().toLowerCase();
    const sf = this.statusF();
    const CAT = new Set(['da-fare', 'fatta', 'no-show']);
    return this.callsForDate().filter(c => {
      if (sf !== 'tutti') {
        if (CAT.has(sf)) {
          if (c.status !== sf) return false;
        } else {
          if (c.statusCode !== sf) return false;
        }
      }
      if (q && !(c.client + c.company).toLowerCase().includes(q)) return false;
      return true;
    });
  });

  readonly dayLabel = computed(() => {
    const sel = this.selectedDate();
    const now = new Date();
    if (isSameDay(sel, now)) return 'Oggi';
    const diff = Math.round(
      (startOfDay(sel).getTime() - startOfDay(now).getTime()) / 86_400_000,
    );
    if (diff === 1) return 'Domani';
    if (diff === -1) return 'Ieri';
    return fmtDate(sel.toISOString());
  });

  readonly todo = computed(() => this.callsForDate().filter(c => c.status === 'da-fare').length);
  readonly done = computed(() => this.callsForDate().filter(c => c.status === 'fatta').length);

  readonly statusOptions = computed(() => {
    const fixed = [
      { value: 'tutti', label: 'Tutti' },
    ];
    const fromDb = (this.statusOptsResource.value() ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(o => ({ value: o.code, label: o.label }));
    return [...fixed, ...fromDb];
  });

  readonly newCallInitialDate = computed(() => {
    const d = this.selectedDate();
    const now = new Date();
    const merged = new Date(d);
    merged.setHours(now.getHours(), now.getMinutes());
    return merged.toISOString();
  });

  onCallSaved(): void {
    this.openCall.set(null);
    this.leadsResource.reload();
  }

  onQuickActionDone(): void {
    this.quickAction.set(null);
    this.leadsResource.reload();
  }

  onNewCallDone(): void {
    this.showNewCallModal.set(false);
    this.leadsResource.reload();
  }

  onMonthDaySelected(date: Date): void {
    this.selectedDate.set(date);
    this.state.layout.set('lista');
  }
}
