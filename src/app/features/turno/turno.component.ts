import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ShiftApiService, ShiftBoard, ShiftView } from '../../shift/shift-api.service';
import { ToastService } from '../../shared/toast.service';
import { AuthService } from '../../auth/auth.service';
import { IconComponent } from '../../shared/icon.component';
import { addDays, romeDate, romeLongDay } from '../../booking/rome-time';
import { ProspectCardComponent } from './prospect-card.component';
import { ProspectTableComponent } from './prospect-table.component';
import { ProspectRowsComponent } from './prospect-rows.component';
import { SetterApiService } from '../../setter/setter-api.service';

// Lead ADS: turno attivo, lead da chiamare adesso (vista predefinita) e tutti i lead in tabella
@Component({
  selector: 'app-turno',
  imports: [IconComponent, ProspectCardComponent, ProspectTableComponent, ProspectRowsComponent],
  styleUrl: './turno.component.css',
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Lead ADS</h1>
          <p class="page-sub">I lead arrivati dai form Meta. Ogni lead è della setter del turno in cui arriva e solo lei può contattarlo: in "Tutti i lead" vedi anche quelli delle colleghe.</p>
        </div>
        <button type="button" class="btn-ghost" (click)="board.reload()" [disabled]="board.isLoading()">
          <app-icon name="refresh" [size]="15" /> Aggiorna
        </button>
      </div>

      <!-- TODO lancio turni: togliere il banner -->
      <div class="preview-note" role="note">
        <app-icon name="info" [size]="16" />
        <p>
          <strong>Anteprima di prova.</strong> I lead si lavorano ancora su Notion: qui provate il flusso e segnalate cosa non torna.
          I link di prenotazione prenotano davvero sul portale, quindi per ora mandateli solo a contatti di prova.
        </p>
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
              @if (b.previousOpen) {
                <span class="hero-next">Turno precedente: {{ b.previousOpen }} lead senza esito</span>
              }
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
          <section class="card links" aria-labelledby="links-title">
            <h2 id="links-title"><app-icon name="copy" [size]="15" /> I tuoi link di prenotazione</h2>
            <div class="links-kinds">
              <p><strong>ADS</strong> · per i tuoi lead ADS: mostra solo i tuoi orari, la call di vendita la fai tu.</p>
              <p><strong>Organico</strong> · per i DM Instagram: la call la fa una venditrice libera, la setter risulti tu.</p>
            </div>
            <div class="links-grid">
              @for (l of b.links; track l.slug) {
                <div class="link-row">
                  <span class="link-academy">{{ academyName(l.academy) }}</span>
                  <button type="button" class="btn-ghost sm" (click)="copy(l.ads, 'Link ADS copiato: la call sarà con te')"><app-icon name="copy" [size]="13" /> ADS</button>
                  <button type="button" class="btn-ghost sm" (click)="copy(l.organic, 'Link organico copiato: mandalo in DM')"><app-icon name="copy" [size]="13" /> Organico</button>
                </div>
              }
            </div>
          </section>
        }

        <!-- Viste -->
        <div class="views" role="tablist" aria-label="Viste dei lead">
          <button role="tab" type="button" [attr.aria-selected]="view() === 'mine'" [class.on]="view() === 'mine'" (click)="view.set('mine')">
            {{ isAdmin() ? 'Per setter' : 'I miei lead' }} <span class="count" [class.alert]="b.toCall.length > 0">{{ b.toCall.length }}</span>
          </button>
          <button role="tab" type="button" [attr.aria-selected]="view() === 'all'" [class.on]="view() === 'all'" (click)="view.set('all')">
            Tutti i lead
          </button>
        </div>

        @if (view() === 'mine') {
          <div role="tabpanel">
            @if (isAdmin()) {
              <label class="view-as">
                <span>Lead di</span>
                <select class="select-inline" (change)="viewAs.set(+$any($event.target).value || 0)">
                  <option value="0" [selected]="viewAs() === 0">Tutte le setter</option>
                  @for (s of setters(); track s.id) {
                    <option [value]="s.id" [selected]="viewAs() === +s.id">{{ s.name }} {{ s.lastName ?? '' }}</option>
                  }
                </select>
              </label>
            }

            <section class="sec">
              <h2>{{ b.focus === 'current' ? 'Da chiamare ora' : 'Per il prossimo turno' }} <span class="count" [class.alert]="b.toCall.length > 0">{{ b.toCall.length }}</span></h2>
              @if (b.focus === 'current' && b.current?.slot === 3 && afterSeven()) {
                <p class="tab-hint note">Dopo le 19 i nuovi lead ADS vanno nella coda del primo turno di domani: ora si risponde ai messaggi organici.</p>
              }
              @for (p of b.toCall; track p.id; let i = $index) {
                @if (i === 0 || b.toCall[i - 1].arrivalGroup !== p.arrivalGroup) {
                  <h3 class="group">{{ p.arrivalGroup }}</h3>
                }
                <app-prospect-card [prospect]="p" (changed)="refresh()" />
              } @empty {
                <p class="empty">{{ emptyText(b) }}</p>
              }
            </section>

            @if (b.open.length) {
              <section class="sec">
                <h2>In corso <span class="count">{{ b.open.length }}</span></h2>
                <p class="tab-hint">Già contattati, in attesa di un esito: aprili per aggiornare lo stato.</p>
                <app-prospect-rows [prospects]="b.open" [showOwner]="showOwner()" (changed)="refresh()" />
              </section>
            }

            @if (b.toClose.length) {
              <section class="sec">
                <div class="sec-head">
                  <h2>Da chiudere <span class="count">{{ b.toClose.length }}</span></h2>
                  @if (confirmClose()) {
                    <span class="confirm">
                      Segno {{ b.toClose.length }} lead{{ showOwner() ? ' di tutte le setter' : '' }} come "Non contattato"?
                      <button type="button" class="btn-primary sm" (click)="closeExpired()" [disabled]="closing()">Sì, chiudi</button>
                      <button type="button" class="btn-ghost sm" (click)="confirmClose.set(false)">Annulla</button>
                    </span>
                  } @else {
                    <button type="button" class="btn-ghost sm" (click)="confirmClose.set(true)">Segna tutti come non contattati</button>
                  }
                </div>
                <p class="tab-hint">Lead di turni passati mai contattati: non si richiamano, va solo registrato l'esito.</p>
                <app-prospect-rows [prospects]="b.toClose" [showOwner]="showOwner()" (changed)="refresh()" />
              </section>
            }

            @if (b.upcoming.length) {
              <details class="sec upcoming">
                <summary><h2>Per i prossimi turni <span class="count">{{ b.upcoming.length }}</span></h2></summary>
                <p class="tab-hint">Già arrivati ma assegnati a un turno successivo, secondo la tabella dei turni.</p>
                <app-prospect-rows [prospects]="b.upcoming" [showOwner]="showOwner()" (changed)="refresh()" />
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

  private readonly setterApi = inject(SetterApiService);

  readonly view = signal<'mine' | 'all'>('mine');
  readonly now = signal(Date.now());
  /** Admin: di quale setter vedere i lead (0 = tutte) */
  readonly viewAs = signal(0);
  readonly confirmClose = signal(false);
  readonly closing = signal(false);

  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');
  readonly showOwner = computed(() => this.isAdmin() && this.viewAs() === 0);

  readonly board = rxResource({
    params: () => ({ setterId: this.viewAs() }),
    stream: ({ params }) => this.api.board(params.setterId || undefined),
  });

  private readonly settersResource = rxResource({
    params: () => (this.isAdmin() ? true : undefined),
    stream: () => this.setterApi.getAll(),
  });
  readonly setters = computed(() => this.settersResource.value() ?? []);

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

  emptyText(b: ShiftBoard): string {
    if (this.isAdmin() && !this.viewAs()) return 'Nessun lead da chiamare in questo turno.';
    const n = b.myNext;
    if (!n) return 'Nessun lead da chiamare. Non hai turni nelle prossime tre settimane.';
    const start = Date.parse(n.startsAt);
    if (start <= this.now()) return 'Nessun lead da chiamare in questo turno, per ora.';
    const who = this.isAdmin() ? 'Il suo' : 'Il tuo';
    return `Nessun lead da chiamare adesso. ${who} prossimo turno: ${n.label.toLowerCase()}, ${this.dayLabel(n.date)} alle ${n.start}.`;
  }

  closeExpired(): void {
    this.closing.set(true);
    this.api.closeExpired(this.viewAs() || undefined).subscribe({
      next: ({ closed }) => {
        this.closing.set(false);
        this.confirmClose.set(false);
        this.toast.success(`${closed} lead segnati come non contattati`);
        this.board.reload();
      },
      error: () => {
        this.closing.set(false);
        this.toast.error('Non sono riuscito a chiuderli, riprova');
      },
    });
  }

  copy(text: string, msg: string): void {
    navigator.clipboard.writeText(text).then(
      () => this.toast.success(msg),
      () => this.toast.error('Copia non riuscita: ' + text),
    );
  }
}
