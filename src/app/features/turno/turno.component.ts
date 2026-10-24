import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import {
  PROSPECT_STATUS,
  Prospect,
  ProspectStatus,
  ShiftApiService,
  ShiftView,
} from '../../shift/shift-api.service';
import { ToastService } from '../../shared/toast.service';
import { AuthService } from '../../auth/auth.service';
import { IconComponent } from '../../shared/icon.component';
import { addDays, romeDate, romeLongDay } from '../../booking/rome-time';
import { ProspectCardComponent } from './prospect-card.component';

type Tab = 'queue' | 'backlog' | 'followUp' | 'search';

// Pagina delle setter: turno attivo, coda dei lead ADS da chiamare e link personali
@Component({
  selector: 'app-turno',
  imports: [IconComponent, ProspectCardComponent],
  styleUrl: './turno.component.css',
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Turno</h1>
          <p class="page-sub">I lead ADS da chiamare, nell'ordine giusto. La pagina si aggiorna da sola ogni minuto.</p>
        </div>
        <button type="button" class="btn-ghost" (click)="board.reload()" [disabled]="board.isLoading()">
          <app-icon name="refresh" [size]="15" /> Aggiorna
        </button>
      </div>

      @if (board.error()) {
        <p class="muted">Non riesco a caricare il turno. Riprova tra poco.</p>
      } @else if (board.value(); as b) {
        <!-- Turno attivo -->
        <section class="shift-hero" [class.off]="!b.current" aria-live="polite">
          @if (b.current; as c) {
            <div class="hero-main">
              <span class="hero-kicker"><span class="live-dot" aria-hidden="true"></span> Turno in corso</span>
              <h2>{{ c.label }} turno · {{ c.start }}–{{ c.end }}</h2>
              <p class="hero-who">
                Di turno: <strong>{{ c.setter?.name ?? 'nessuna assegnata' }}</strong>
                @if (isMine(c)) { <span class="me">sei tu</span> }
              </p>
            </div>
            <div class="hero-side">
              <span class="hero-left">{{ remaining(c) }}</span>
              <div class="progress" role="progressbar" [attr.aria-valuenow]="progress(c)" aria-valuemin="0" aria-valuemax="100" aria-label="Avanzamento del turno">
                <span [style.width.%]="progress(c)"></span>
              </div>
              <span class="hero-next">Poi: {{ b.next.label }} turno, {{ dayLabel(b.next.date) }} alle {{ b.next.start }} · {{ b.next.setter?.name ?? 'nessuna setter' }}</span>
            </div>
          } @else {
            <div class="hero-main">
              <span class="hero-kicker">Fuori turno</span>
              <h2>Prossimo: {{ b.next.label }} turno, {{ dayLabel(b.next.date) }} alle {{ b.next.start }}</h2>
              <p class="hero-who">
                Di turno: <strong>{{ b.next.setter?.name ?? 'nessuna assegnata' }}</strong>
                @if (isMine(b.next)) { <span class="me">sei tu</span> }
              </p>
            </div>
            <div class="hero-side">
              <span class="hero-next">I lead che arrivano adesso finiscono nella coda del prossimo turno.</span>
            </div>
          }
        </section>

        <!-- Link personali -->
        @if (b.links.length) {
          <details class="card links">
            <summary>
              <app-icon name="copy" [size]="15" />
              <span>I tuoi link di prenotazione</span>
              <small>la call prenotata da questi link è attribuita a te</small>
            </summary>
            <div class="links-grid">
              @for (l of b.links; track l.slug) {
                <div class="link-row">
                  <span class="link-academy">{{ academyName(l.academy) }}</span>
                  <button type="button" class="btn-ghost sm" (click)="copy(l.ads, 'Link ADS copiato')">ADS</button>
                  <button type="button" class="btn-ghost sm" (click)="copy(l.organic, 'Link organico copiato')">Organico (IG)</button>
                </div>
              }
            </div>
          </details>
        }

        <!-- Schede -->
        <div class="tabs" role="tablist" aria-label="Elenchi lead">
          <button role="tab" type="button" [attr.aria-selected]="tab() === 'queue'" [class.on]="tab() === 'queue'" (click)="tab.set('queue')">
            {{ b.focus === 'current' ? 'Coda del turno' : 'Coda del prossimo turno' }}
            <span class="count">{{ openCount(b.queue) }}/{{ b.queue.length }}</span>
          </button>
          <button role="tab" type="button" [attr.aria-selected]="tab() === 'backlog'" [class.on]="tab() === 'backlog'" (click)="tab.set('backlog')">
            Arretrati <span class="count" [class.alert]="b.backlog.length">{{ b.backlog.length }}</span>
          </button>
          <button role="tab" type="button" [attr.aria-selected]="tab() === 'followUp'" [class.on]="tab() === 'followUp'" (click)="tab.set('followUp')">
            Da riprendere <span class="count">{{ b.followUp.length }}</span>
          </button>
          <button role="tab" type="button" [attr.aria-selected]="tab() === 'search'" [class.on]="tab() === 'search'" (click)="tab.set('search')">
            <app-icon name="search" [size]="14" /> Cerca
          </button>
        </div>

        <div role="tabpanel">
          @switch (tab()) {
            @case ('queue') {
              <p class="tab-hint">Prima i lead della fascia più vecchia (mattina presto, sera prima, notte), poi quelli arrivati nel turno.</p>
              @if (b.current?.slot === 3 && afterSeven()) {
                <p class="tab-hint note">Dopo le 19 i nuovi lead ADS vanno nella coda del primo turno di domani: ora si risponde ai messaggi organici.</p>
              }
              @for (p of b.queue; track p.id; let i = $index) {
                @if (i === 0 || b.queue[i - 1].arrivalGroup !== p.arrivalGroup) {
                  <h3 class="group">{{ p.arrivalGroup }}</h3>
                }
                <app-prospect-card [prospect]="p" (changed)="board.reload()" />
              } @empty {
                <p class="empty">Nessun lead in coda per questo turno. 🎉</p>
              }
            }
            @case ('backlog') {
              <p class="tab-hint">Lead di turni passati (ultimi 14 giorni) mai contattati. Vanno chiamati per primi.</p>
              @for (p of b.backlog; track p.id) {
                <app-prospect-card [prospect]="p" [showShift]="true" (changed)="board.reload()" />
              } @empty {
                <p class="empty">Nessun arretrato.</p>
              }
            }
            @case ('followUp') {
              <p class="tab-hint">Conversazioni aperte nei turni precedenti: chat in corso, non risponde, discovery fatta.</p>
              @for (p of b.followUp; track p.id) {
                <app-prospect-card [prospect]="p" [showShift]="true" (changed)="board.reload()" />
              } @empty {
                <p class="empty">Niente da riprendere.</p>
              }
            }
            @case ('search') {
              <div class="search-bar">
                <input type="search" placeholder="Nome, email o telefono…" aria-label="Cerca lead" [value]="text()" (input)="text.set($any($event.target).value)" />
                <select aria-label="Stato" (change)="status.set($any($event.target).value)">
                  <option value="">Tutti gli stati</option>
                  @for (s of statuses; track s.key) {
                    <option [value]="s.key" [selected]="status() === s.key">{{ s.label }}</option>
                  }
                </select>
              </div>
              @if (results.isLoading()) {
                <p class="muted">Ricerca…</p>
              } @else {
                @for (p of results.value() ?? []; track p.id) {
                  <app-prospect-card [prospect]="p" [showShift]="true" (changed)="results.reload()" />
                } @empty {
                  <p class="empty">Nessun lead trovato.</p>
                }
              }
            }
          }
        </div>
      } @else {
        <p class="muted">Caricamento…</p>
      }
    </div>
  `,
})
export class TurnoComponent {
  private readonly api = inject(ShiftApiService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly tab = signal<Tab>('queue');
  readonly text = signal('');
  readonly status = signal('');
  readonly now = signal(Date.now());

  readonly statuses = Object.entries(PROSPECT_STATUS).map(([key, v]) => ({
    key: key as ProspectStatus,
    label: v.label,
  }));

  readonly board = rxResource({ stream: () => this.api.board() });

  readonly results = rxResource({
    params: () => (this.tab() === 'search' ? { text: this.text().trim(), status: this.status() } : null),
    stream: ({ params }) => (params ? this.api.search(params) : of([])),
  });

  private readonly mySetterId = computed(() => {
    const id = this.auth.currentUser()?.setterId;
    return id != null ? Number(id) : null;
  });

  constructor() {
    // aggiornamento automatico e orologio del turno
    const refresh = setInterval(() => {
      if (document.visibilityState === 'visible') this.board.reload();
    }, 60_000);
    const tick = setInterval(() => this.now.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(refresh);
      clearInterval(tick);
    });
  }

  readonly afterSeven = computed(() => {
    const t = new Date(this.now()).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false });
    return Number(t.slice(0, 2)) >= 19;
  });

  isMine(s: ShiftView): boolean {
    return s.setter != null && s.setter.id === this.mySetterId();
  }

  progress(s: ShiftView): number {
    const start = Date.parse(s.startsAt);
    const end = Date.parse(s.endsAt);
    return Math.max(0, Math.min(100, Math.round(((this.now() - start) / (end - start)) * 100)));
  }

  remaining(s: ShiftView): string {
    const min = Math.max(0, Math.round((Date.parse(s.endsAt) - this.now()) / 60_000));
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h ? `mancano ${h} h ${m} min` : `mancano ${m} min`;
  }

  dayLabel(date: string): string {
    const today = romeDate(new Date(this.now()));
    if (date === today) return 'oggi';
    if (date === addDays(today, 1)) return 'domani';
    return romeLongDay(`${date}T12:00:00Z`);
  }

  academyName(title: string): string {
    return title.split(/\s[–-]\s/)[0];
  }

  openCount(list: Prospect[]): number {
    return list.filter(p => p.status === 'nuovo').length;
  }

  copy(text: string, msg: string): void {
    navigator.clipboard.writeText(text).then(
      () => this.toast.success(msg),
      () => this.toast.error('Copia non riuscita: ' + text),
    );
  }
}
