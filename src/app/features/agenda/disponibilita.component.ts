import { Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AvailabilityWindow, BookingApiService, SellerOverview, TimeOffDto } from '../../booking/booking-api.service';
import { SellerApiService } from '../../seller/seller-api.service';
import { AuthService } from '../../auth/auth.service';
import { ToastService } from '../../shared/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { addDays, dayParts, mondayOf, romeDate, romeLabel, romeToIso } from '../../booking/rome-time';

const WEEKDAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

interface DayRow {
  weekday: number;
  label: string;
  ranges: { startTime: string; endTime: string }[];
}

function toMin(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function toRows(windows: AvailabilityWindow[]): DayRow[] {
  return WEEKDAYS.map((label, i) => ({
    weekday: i + 1,
    label,
    ranges: windows
      .filter(w => w.weekday === i + 1)
      .map(w => ({ startTime: w.startTime, endTime: w.endTime })),
  }));
}

// Orario settimanale e ferie: valgono per tutte le academy insieme
@Component({
  selector: 'app-disponibilita',
  imports: [IconComponent],
  styleUrl: './disponibilita.component.css',
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Disponibilità</h1>
          <p class="page-sub">Gli orari in cui si possono prenotare call. Valgono per tutte le academy: una call presa su una pagina blocca l'orario anche sulle altre.</p>
        </div>
        @if (isAdmin() && sellerId()) {
          <div class="head-actions">
            <button type="button" class="btn-ghost sm" (click)="pickSeller(0)">← Tutte le venditrici</button>
            <select class="select" aria-label="Venditrice" (change)="pickSeller(+$any($event.target).value)">
            <option value="">Scegli la venditrice…</option>
            @for (s of sellers(); track s.id) {
              <option [value]="s.id" [selected]="+s.id === sellerId()">{{ s.name }} {{ s.lastName ?? '' }}</option>
            }
            </select>
          </div>
        }
      </div>

      @if (!sellerId() && isAdmin()) {
        <section class="card">
          <div class="card-head">
            <h2>Orari di tutte le venditrici</h2>
          </div>
          <p class="muted small">Clicca una venditrice per modificare orari, percorsi e ferie.</p>
          @if (overviewResource.isLoading() && !overviewResource.value()) {
            <p class="muted">Caricamento…</p>
          } @else if (overviewResource.error()) {
            <p class="warn">Impossibile caricare le disponibilità.</p>
          } @else {
            <div class="table-wrap">
              <table class="ov">
                <thead>
                  <tr>
                    <th scope="col">Venditrice</th>
                    @for (d of weekdaysShort; track $index; let wi = $index) {
                      <th scope="col" [class.today]="weekDates()[wi] === today">
                        {{ d }} <span class="hdate">{{ dateLabel(weekDates()[wi]) }}</span>
                        <span class="scale" aria-hidden="true"><span>{{ hourRange()[0] }}</span><span>{{ hourRange()[1] }}</span></span>
                      </th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (s of activeSellers(); track s.id) {
                    <tr tabindex="0" [class.on-leave]="currentOff(s)" (click)="pickSeller(s.id)" (keydown.enter)="pickSeller(s.id)">
                      <th scope="row">
                        <span class="ov-name">{{ s.name }}</span>
                        @if (currentOff(s); as off) {
                          <span class="leave-badge">
                            <app-icon name="calendar" [size]="13" />
                            In ferie fino al {{ label(off.endsAt) }}
                          </span>
                          @if (off.note) { <span class="leave-note">{{ off.note }}</span> }
                        }
                        <span class="ov-tags">
                          @for (a of s.academies; track a.id) { <span class="tag">{{ academyShort(a.title) }}</span> }
                          @if (nextOff(s); as next) {
                            <span class="tag off-tag" [title]="next.note ?? ''">Blocco dal {{ label(next.startsAt) }}</span>
                          }
                          @if (!s.windows.length) { <span class="tag warn-tag">Senza orari</span> }
                        </span>
                      </th>
                      @for (d of weekdaysShort; track $index; let wi = $index) {
                        <td>
                          @let ws = windowsOf(s, wi + 1);
                          @if (leaveDays().get(s.id)?.[wi]) {
                            <div class="leave-cell">Ferie</div>
                          } @else if (ws.length) {
                            <div class="bar" aria-hidden="true">
                              @for (w of ws; track $index) {
                                <span class="seg" [style.left.%]="segLeft(w.startTime)" [style.width.%]="segWidth(w.startTime, w.endTime)"></span>
                              }
                            </div>
                            <span class="times">
                              @for (w of ws; track $index) { <span>{{ hm(w.startTime) }}–{{ hm(w.endTime) }}</span> }
                            </span>
                          } @else {
                            <div class="bar none" aria-hidden="true"></div>
                            <span class="sr-only">Non disponibile</span>
                          }
                        </td>
                      }
                    </tr>
                  } @empty {
                    <tr><td colspan="8" class="muted">Nessuna venditrice con orari o percorsi</td></tr>
                  }
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Copertura</th>
                    @for (day of coveragePerDay(); track $index) {
                      <td>
                        <div class="bar total" [class.none]="!day.count" aria-hidden="true">
                          @for (u of day.union; track $index) {
                            <span class="seg" [style.left.%]="segLeftMin(u[0])" [style.width.%]="segWidthMin(u[0], u[1])"></span>
                          }
                        </div>
                        <span class="times" [class.zero]="!day.count">{{ day.count }} {{ day.count === 1 ? 'venditrice' : 'venditrici' }}</span>
                      </td>
                    }
                  </tr>
                </tfoot>
              </table>
            </div>
            @if (idleSellers().length) {
              <div class="idle">
                <span class="muted small-inline">Senza orari né percorsi ({{ idleSellers().length }}):</span>
                @for (s of idleSellers(); track s.id) {
                  <button type="button" class="idle-chip" (click)="pickSeller(s.id)">{{ s.name }}</button>
                }
              </div>
            }
          }
        </section>
      } @else if (!sellerId()) {
        <p class="muted">Il tuo account non è collegato a una venditrice.</p>
      } @else {
        <section class="card">
          <div class="card-head">
            <h2>Orario settimanale</h2>
            <button type="button" class="btn-primary" [disabled]="saving() || !dirty()" (click)="save()">
              {{ saving() ? 'Salvataggio…' : 'Salva orari' }}
            </button>
          </div>
          @if (availabilityResource.isLoading()) {
            <p class="muted">Caricamento…</p>
          } @else {
            <div class="rows">
              @for (row of rows(); track row.weekday; let ri = $index) {
                <div class="row">
                  <span class="wd">{{ row.label }}</span>
                  <div class="ranges">
                    @for (r of row.ranges; track $index; let i = $index) {
                      <div class="range">
                        <input type="time" step="900" [value]="r.startTime" (change)="setTime(ri, i, 'startTime', $any($event.target).value)" [attr.aria-label]="row.label + ' dalle'" />
                        <span aria-hidden="true">–</span>
                        <input type="time" step="900" [value]="r.endTime" (change)="setTime(ri, i, 'endTime', $any($event.target).value)" [attr.aria-label]="row.label + ' alle'" />
                        <button type="button" class="icon-btn sm" (click)="removeRange(ri, i)" [attr.aria-label]="'Rimuovi fascia ' + row.label"><app-icon name="trash" [size]="14" /></button>
                      </div>
                    } @empty {
                      <span class="off">Non disponibile</span>
                    }
                  </div>
                  <button type="button" class="btn-ghost sm" (click)="addRange(ri)"><app-icon name="plus" [size]="14" /> Fascia</button>
                </div>
              }
            </div>
            @if (invalid()) {
              <p class="warn">Controlla le fasce: l'orario di fine deve essere dopo l'inizio.</p>
            }
          }
        </section>

        <section class="card">
          <div class="card-head">
            <h2>Percorsi in cui vende</h2>
          </div>
          <p class="muted small">Gli orari sopra valgono per tutti i percorsi spuntati: chi prenota su un percorso vede gli orari liberi delle venditrici di quel percorso. Una call presa su un percorso blocca l'orario anche sugli altri.</p>
          @if (academiesResource.isLoading() && !academiesResource.value()) {
            <p class="muted">Caricamento…</p>
          } @else {
            <div class="academy-list">
              @for (a of academiesResource.value() ?? []; track a.id) {
                <label class="academy" [class.on]="a.selected">
                  <input type="checkbox" [checked]="a.selected" [disabled]="!isAdmin() || savingAcademies()" (change)="toggleAcademy(a.id, $any($event.target).checked)" />
                  <span>{{ academyName(a.title) }}</span>
                  @if (!a.active) { <span class="muted">(pagina spenta)</span> }
                </label>
              }
            </div>
            @if (!isAdmin()) {
              <p class="muted small hint">Per cambiare i percorsi chiedi all'amministrazione.</p>
            }
          }
        </section>

        <section class="card">
          <div class="card-head">
            <h2>Ferie e blocchi</h2>
          </div>
          <p class="muted small">Nei periodi bloccati non si può prenotare. Le call già prese in quel periodo restano: le trovi segnalate qui sotto.</p>
          <form class="off-form" (submit)="$event.preventDefault(); addTimeOff()">
            <label class="field"><span>Dal</span><input type="date" [value]="offFrom()" (change)="offFrom.set($any($event.target).value)" /></label>
            <label class="field"><span>Ora</span><input type="time" step="900" [value]="offFromTime()" (change)="offFromTime.set($any($event.target).value)" /></label>
            <label class="field"><span>Al</span><input type="date" [value]="offTo()" (change)="offTo.set($any($event.target).value)" /></label>
            <label class="field"><span>Ora</span><input type="time" step="900" [value]="offToTime()" (change)="offToTime.set($any($event.target).value)" /></label>
            <label class="field grow"><span>Nota</span><input type="text" placeholder="es. ferie" [value]="offNote()" (input)="offNote.set($any($event.target).value)" /></label>
            <button type="submit" class="btn-primary" [disabled]="addingOff()">Aggiungi blocco</button>
          </form>
          @if (conflicts().length) {
            <div class="conflicts" role="alert">
              <strong>Attenzione: {{ conflicts().length }} call già prenotate cadono nel blocco.</strong>
              Spostale o passale a un'altra venditrice da Chiamate.
              <ul>
                @for (c of conflicts(); track c.id) {
                  <li>{{ label(c.startsAt) }} – {{ c.name }} {{ c.surname ?? '' }}</li>
                }
              </ul>
            </div>
          }
          <ul class="off-list">
            @for (t of timeOffResource.value() ?? []; track t.id) {
              <li>
                <span>{{ label(t.startsAt) }} → {{ label(t.endsAt) }}</span>
                @if (t.note) { <span class="muted">· {{ t.note }}</span> }
                <button type="button" class="icon-btn sm" (click)="removeTimeOff(t)" aria-label="Elimina blocco"><app-icon name="trash" [size]="14" /></button>
              </li>
            } @empty {
              <li class="muted">Nessun blocco in programma</li>
            }
          </ul>
        </section>
      }
    </div>
  `,
})
export class DisponibilitaComponent {
  private readonly api = inject(BookingApiService);
  private readonly sellerApi = inject(SellerApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');
  readonly sellerId = signal<number | null>(
    this.auth.currentUser()?.role === 'admin' ? null : Number(this.auth.currentUser()?.sellerId) || null,
  );

  readonly sellersResource = rxResource({
    params: () => (this.isAdmin() ? true : undefined),
    stream: () => this.sellerApi.getAll(),
  });
  readonly sellers = computed(() => this.sellersResource.value() ?? []);

  // Vista d'insieme: si ricarica ogni volta che si torna alla tabella
  readonly overviewResource = rxResource({
    params: () => (this.isAdmin() && !this.sellerId() ? true : undefined),
    stream: () => this.api.overview(),
  });
  readonly overview = computed(() => this.overviewResource.value() ?? []);
  // In tabella chi ha orari o percorsi; gli altri in una riga compatta sotto
  readonly activeSellers = computed(() => this.overview().filter(s => s.windows.length || s.academies.length));
  readonly idleSellers = computed(() => this.overview().filter(s => !s.windows.length && !s.academies.length));

  /** Date della settimana corrente (lun → dom), ora di Roma */
  readonly today = romeDate(new Date());
  readonly weekDates = computed(() => {
    const monday = mondayOf(this.today);
    return WEEKDAYS.map((_, i) => addDays(monday, i));
  });

  /** Per venditrice: quali giorni di questa settimana cadono in un blocco/ferie */
  readonly leaveDays = computed(() => {
    const map = new Map<number, boolean[]>();
    for (const s of this.overview()) {
      if (!s.timeOffs.length) continue;
      map.set(
        s.id,
        this.weekDates().map(d => {
          const dayStart = new Date(romeToIso(d, '00:00')).getTime();
          const dayEnd = new Date(romeToIso(addDays(d, 1), '00:00')).getTime();
          return s.timeOffs.some(
            t => new Date(t.startsAt).getTime() < dayEnd && new Date(t.endsAt).getTime() > dayStart,
          );
        }),
      );
    }
    return map;
  });

  /** Ore mostrate sulle barre: dalla prima apertura all'ultima chiusura (default 9–19) */
  readonly hourRange = computed<[number, number]>(() => {
    const ws = this.overview().flatMap(s => s.windows);
    if (!ws.length) return [9, 19];
    const from = Math.floor(Math.min(...ws.map(w => toMin(w.startTime))) / 60);
    const to = Math.ceil(Math.max(...ws.map(w => toMin(w.endTime))) / 60);
    return [from, Math.max(to, from + 1)];
  });

  /** Per ogni giorno: quante venditrici e l'unione delle loro fasce (in minuti) */
  readonly coveragePerDay = computed(() =>
    WEEKDAYS.map((_, i) => {
      // chi quel giorno è in ferie non copre
      const present = this.overview().filter(s => !this.leaveDays().get(s.id)?.[i]);
      const ws = present.flatMap(s => s.windows.filter(w => w.weekday === i + 1));
      const count = present.filter(s => s.windows.some(w => w.weekday === i + 1)).length;
      const sorted = ws.map(w => [toMin(w.startTime), toMin(w.endTime)] as [number, number]).sort((a, b) => a[0] - b[0]);
      const union: [number, number][] = [];
      for (const r of sorted) {
        const last = union.at(-1);
        if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
        else union.push([...r]);
      }
      return { count, union };
    }),
  );
  readonly weekdaysShort = WEEKDAYS_SHORT;

  readonly availabilityResource = rxResource({
    params: () => this.sellerId() ?? undefined,
    stream: ({ params }) => this.api.availability(params),
  });
  readonly timeOffResource = rxResource({
    params: () => this.sellerId() ?? undefined,
    stream: ({ params }) => this.api.timeOff(params),
  });

  readonly academiesResource = rxResource({
    params: () => this.sellerId() ?? undefined,
    stream: ({ params }) => this.api.sellerAcademies(params),
  });
  readonly savingAcademies = signal(false);

  readonly rows = signal<DayRow[]>(toRows([]));
  readonly dirty = signal(false);
  readonly saving = signal(false);
  readonly invalid = computed(() =>
    this.rows().some(r => r.ranges.some(x => !x.startTime || !x.endTime || x.startTime >= x.endTime)),
  );

  readonly offFrom = signal(romeDate(new Date()));
  readonly offFromTime = signal('00:00');
  readonly offTo = signal(romeDate(new Date()));
  readonly offToTime = signal('23:59');
  readonly offNote = signal('');
  readonly addingOff = signal(false);
  readonly conflicts = signal<NonNullable<TimeOffDto['conflicts']>>([]);

  readonly label = romeLabel;

  constructor() {
    effect(() => {
      const value = this.availabilityResource.value();
      if (value) {
        this.rows.set(toRows(value));
        this.dirty.set(false);
      }
    });
  }

  pickSeller(id: number): void {
    this.sellerId.set(id || null);
    this.conflicts.set([]);
  }

  private edit(fn: (rows: DayRow[]) => void): void {
    const copy = this.rows().map(r => ({ ...r, ranges: r.ranges.map(x => ({ ...x })) }));
    fn(copy);
    this.rows.set(copy);
    this.dirty.set(true);
  }

  addRange(ri: number): void {
    this.edit(rows => {
      const last = rows[ri].ranges.at(-1);
      rows[ri].ranges.push(last ? { startTime: last.endTime, endTime: '19:00' } : { startTime: '09:00', endTime: '13:00' });
    });
  }

  removeRange(ri: number, i: number): void {
    this.edit(rows => rows[ri].ranges.splice(i, 1));
  }

  setTime(ri: number, i: number, field: 'startTime' | 'endTime', value: string): void {
    this.edit(rows => (rows[ri].ranges[i][field] = value));
  }

  save(): void {
    const sellerId = this.sellerId();
    if (!sellerId || this.invalid()) return;
    const windows = this.rows().flatMap(r => r.ranges.map(x => ({ weekday: r.weekday, ...x })));
    this.saving.set(true);
    this.api.saveAvailability(sellerId, windows).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Orari salvati');
        this.availabilityResource.reload();
      },
      error: err => {
        this.saving.set(false);
        this.toast.error(err?.error?.message ?? 'Impossibile salvare');
      },
    });
  }

  addTimeOff(): void {
    const sellerId = this.sellerId();
    if (!sellerId) return;
    const startsAt = romeToIso(this.offFrom(), this.offFromTime());
    const endsAt = romeToIso(this.offTo(), this.offToTime());
    if (endsAt <= startsAt) {
      this.toast.error('La fine del blocco deve essere dopo l\'inizio');
      return;
    }
    this.addingOff.set(true);
    this.api.createTimeOff({ sellerId, startsAt, endsAt, note: this.offNote().trim() || undefined }).subscribe({
      next: res => {
        this.addingOff.set(false);
        this.conflicts.set(res.conflicts ?? []);
        this.offNote.set('');
        this.toast.success('Blocco aggiunto');
        this.timeOffResource.reload();
      },
      error: err => {
        this.addingOff.set(false);
        this.toast.error(err?.error?.message ?? 'Impossibile aggiungere il blocco');
      },
    });
  }

  removeTimeOff(t: TimeOffDto): void {
    this.api.removeTimeOff(Number(t.id)).subscribe({
      next: () => {
        this.toast.success('Blocco eliminato');
        this.timeOffResource.reload();
      },
      error: () => this.toast.error('Impossibile eliminare il blocco'),
    });
  }

  currentOff(s: SellerOverview) {
    return s.timeOffs.find(t => t.current) ?? null;
  }

  /** Prossimo blocco non ancora iniziato */
  nextOff(s: SellerOverview) {
    const now = Date.now();
    return s.timeOffs.find(t => new Date(t.startsAt).getTime() > now) ?? null;
  }

  windowsOf(s: SellerOverview, weekday: number): AvailabilityWindow[] {
    return s.windows.filter(w => w.weekday === weekday);
  }

  segLeftMin(min: number): number {
    const [from, to] = this.hourRange();
    return ((min - from * 60) / ((to - from) * 60)) * 100;
  }

  segWidthMin(start: number, end: number): number {
    const [from, to] = this.hourRange();
    return ((end - start) / ((to - from) * 60)) * 100;
  }

  segLeft(start: string): number {
    return this.segLeftMin(toMin(start));
  }

  segWidth(start: string, end: string): number {
    return this.segWidthMin(toMin(start), toMin(end));
  }

  dateLabel(date: string): string {
    const p = dayParts(date);
    return `${p.day}/${date.slice(5, 7)}`;
  }

  hm(time: string): string {
    return time.slice(0, 5);
  }

  /** "ImprendIG Social Academy – …" → "Social" */
  academyShort(title: string): string {
    return this.academyName(title).replace(/^ImprendIG\s+/i, '').replace(/\s+Academy$/i, '');
  }

  academyName(title: string): string {
    return title.split(/\s[–-]\s/)[0];
  }

  toggleAcademy(id: number, on: boolean): void {
    const sellerId = this.sellerId();
    if (!sellerId) return;
    const ids = (this.academiesResource.value() ?? [])
      .filter(a => (a.id === id ? on : a.selected))
      .map(a => a.id);
    this.savingAcademies.set(true);
    this.api.saveSellerAcademies(sellerId, ids).subscribe({
      next: list => {
        this.savingAcademies.set(false);
        this.academiesResource.set(list);
        this.toast.success('Percorsi aggiornati');
      },
      error: () => {
        this.savingAcademies.set(false);
        this.toast.error('Percorsi non salvati');
        this.academiesResource.reload();
      },
    });
  }
}
