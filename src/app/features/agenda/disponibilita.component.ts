import { Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AvailabilityWindow, BookingApiService, TimeOffDto } from '../../booking/booking-api.service';
import { SellerApiService } from '../../seller/seller-api.service';
import { AuthService } from '../../auth/auth.service';
import { ToastService } from '../../shared/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { romeDate, romeLabel, romeToIso } from '../../booking/rome-time';

const WEEKDAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

interface DayRow {
  weekday: number;
  label: string;
  ranges: { startTime: string; endTime: string }[];
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
        @if (isAdmin()) {
          <select class="select" aria-label="Venditrice" (change)="pickSeller(+$any($event.target).value)">
            <option value="">Scegli la venditrice…</option>
            @for (s of sellers(); track s.id) {
              <option [value]="s.id" [selected]="+s.id === sellerId()">{{ s.name }} {{ s.lastName ?? '' }}</option>
            }
          </select>
        }
      </div>

      @if (!sellerId()) {
        <p class="muted">{{ isAdmin() ? 'Seleziona una venditrice per vedere e modificare i suoi orari.' : 'Il tuo account non è collegato a una venditrice.' }}</p>
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

  readonly availabilityResource = rxResource({
    params: () => this.sellerId() ?? undefined,
    stream: ({ params }) => this.api.availability(params),
  });
  readonly timeOffResource = rxResource({
    params: () => this.sellerId() ?? undefined,
    stream: ({ params }) => this.api.timeOff(params),
  });

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
}
