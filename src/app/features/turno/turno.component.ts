import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Prospect, ShiftApiService, ShiftBoard, ShiftView } from '../../shift/shift-api.service';
import { ToastService } from '../../shared/toast.service';
import { AuthService } from '../../auth/auth.service';
import { IconComponent } from '../../shared/icon.component';
import { addDays, romeDate, romeLongDay } from '../../booking/rome-time';
import { ProspectCardComponent } from './prospect-card.component';
import { ProspectTableComponent } from './prospect-table.component';

// Lead ADS: turno attivo, lead da chiamare adesso (vista predefinita) e tutti i lead in tabella
@Component({
  selector: 'app-turno',
  imports: [IconComponent, ProspectCardComponent, ProspectTableComponent],
  styleUrl: './turno.component.css',
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Lead ADS</h1>
          <p class="page-sub">I lead arrivati dai form Meta. Tutte vedono tutto: su ogni lead c'è chi lo segue, così nessuno viene contattato due volte.</p>
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

        <!-- Viste -->
        <div class="views" role="tablist" aria-label="Viste dei lead">
          <button role="tab" type="button" [attr.aria-selected]="view() === 'now'" [class.on]="view() === 'now'" (click)="view.set('now')">
            Da chiamare adesso <span class="count" [class.alert]="toCall(b) > 0">{{ toCall(b) }}</span>
          </button>
          <button role="tab" type="button" [attr.aria-selected]="view() === 'all'" [class.on]="view() === 'all'" (click)="view.set('all')">
            Tutti i lead
          </button>
        </div>

        @if (view() === 'now') {
          <div role="tabpanel">
            @if (b.backlog.length) {
              <section class="sec sec-alert">
                <h2>Rimasti indietro dai turni precedenti <span class="count alert">{{ b.backlog.length }}</span></h2>
                <p class="tab-hint">Mai contattati: vanno chiamati per primi, da chiunque sia di turno.</p>
                @for (p of b.backlog; track p.id) {
                  <app-prospect-card [prospect]="p" [showShift]="true" (changed)="refresh()" />
                }
              </section>
            }

            <section class="sec">
              <h2>{{ b.focus === 'current' ? 'Turno in corso' : 'Prossimo turno' }} <span class="count">{{ openCount(b.queue) }} da contattare su {{ b.queue.length }}</span></h2>
              <p class="tab-hint">Prima i lead della fascia più vecchia (mattina presto, sera prima, notte), poi quelli arrivati nel turno.</p>
              @if (b.current?.slot === 3 && afterSeven()) {
                <p class="tab-hint note">Dopo le 19 i nuovi lead ADS vanno nella coda del primo turno di domani: ora si risponde ai messaggi organici.</p>
              }
              @for (p of b.queue; track p.id; let i = $index) {
                @if (i === 0 || b.queue[i - 1].arrivalGroup !== p.arrivalGroup) {
                  <h3 class="group">{{ p.arrivalGroup }}</h3>
                }
                <app-prospect-card [prospect]="p" (changed)="refresh()" />
              } @empty {
                <p class="empty">Nessun lead in questo turno.</p>
              }
            </section>

            @if (b.followUp.length) {
              <section class="sec">
                <h2>Da riprendere <span class="count">{{ b.followUp.length }}</span></h2>
                <p class="tab-hint">Conversazioni aperte nei turni precedenti: in corso, non risponde, discovery fatta.</p>
                @for (p of b.followUp; track p.id) {
                  <app-prospect-card [prospect]="p" [showShift]="true" (changed)="refresh()" />
                }
              </section>
            }

            @if (b.upcoming.length) {
              <details class="sec upcoming">
                <summary><h2>Per i prossimi turni <span class="count">{{ b.upcoming.length }}</span></h2></summary>
                <p class="tab-hint">Già arrivati ma assegnati a un turno successivo, secondo la tabella dei turni.</p>
                @for (p of b.upcoming; track p.id) {
                  <app-prospect-card [prospect]="p" [showShift]="true" (changed)="refresh()" />
                }
              </details>
            }
          </div>
        } @else {
          <div role="tabpanel">
            <app-prospect-table (changed)="board.reload()" />
          </div>
        }
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

  readonly view = signal<'now' | 'all'>('now');
  readonly now = signal(Date.now());

  readonly board = rxResource({ stream: () => this.api.board() });

  private readonly mySetterId = computed(() => {
    const id = this.auth.currentUser()?.setterId;
    return id != null ? Number(id) : null;
  });

  constructor() {
    // aggiornamento frequente: chi segue cosa deve essere visibile alle altre quasi subito
    const refresh = setInterval(() => {
      if (document.visibilityState === 'visible') this.board.reload();
    }, 20_000);
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

  refresh(): void {
    this.board.reload();
  }

  /** Lead mai contattati tra arretrati e turno in corso */
  toCall(b: ShiftBoard): number {
    return this.openCount(b.backlog) + this.openCount(b.queue);
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
