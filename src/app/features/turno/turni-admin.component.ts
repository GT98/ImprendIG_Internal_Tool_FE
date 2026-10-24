import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ShiftApiService } from '../../shift/shift-api.service';
import { SetterApiService } from '../../setter/setter-api.service';
import { ToastService } from '../../shared/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { addDays, dayParts, mondayOf, romeDate } from '../../booking/rome-time';

const SLOTS = [
  { slot: 1, label: 'Primo', hours: '8–11' },
  { slot: 2, label: 'Secondo', hours: '11–16' },
  { slot: 3, label: 'Terzo', hours: '16–19' },
];

// Calendario dei turni delle setter (admin): chi copre ogni turno, giorno per giorno
@Component({
  selector: 'app-turni-admin',
  imports: [IconComponent],
  styleUrl: './turni-admin.component.css',
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Turni setter</h1>
          <p class="page-sub">Chi copre ogni turno. I lead ADS vengono messi nella coda del turno in base all'ora di arrivo e la setter di turno riceve l'avviso su Telegram.</p>
        </div>
      </div>

      <div class="week-nav">
        <button type="button" class="icon-btn" (click)="move(-7)" aria-label="Settimana precedente"><app-icon name="chevronL" [size]="16" /></button>
        <strong>{{ weekLabel() }}</strong>
        <button type="button" class="icon-btn" (click)="move(7)" aria-label="Settimana successiva"><app-icon name="chevron" [size]="16" /></button>
        <button type="button" class="btn-ghost sm" (click)="week.set(mondayOf(today))">Oggi</button>
        <span class="spacer"></span>
        <button type="button" class="btn-ghost sm" (click)="copyPrevious()" [disabled]="busy()">
          <app-icon name="copy" [size]="14" /> Copia la settimana precedente
        </button>
      </div>

      <div class="shift-table-wrap">
        <table class="shift-table">
          <thead>
            <tr>
              <th scope="col">Turno</th>
              @for (d of days(); track d.date) {
                <th scope="col" [class.is-today]="d.date === today">
                  <span class="wd">{{ d.weekday }}</span> {{ d.day }} {{ d.month }}
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (s of slots; track s.slot) {
              <tr>
                <th scope="row"><span class="slot-name">{{ s.label }}</span><span class="slot-hours">{{ s.hours }}</span></th>
                @for (d of days(); track d.date) {
                  <td [class.is-today]="d.date === today" [class.unassigned]="!assigned(d.date, s.slot)">
                    <select
                      [attr.aria-label]="s.label + ' turno, ' + d.weekday + ' ' + d.day"
                      [disabled]="busy()"
                      (change)="assign(d.date, s.slot, $any($event.target).value)"
                    >
                      <option value="" [selected]="!assigned(d.date, s.slot)">—</option>
                      @for (st of setters(); track st.id) {
                        <option [value]="st.id" [selected]="assigned(d.date, s.slot) === +st.id">{{ st.name }} {{ st.lastName ?? '' }}</option>
                      }
                    </select>
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (summary().length) {
        <section class="card">
          <h2>Turni della settimana</h2>
          <ul class="summary">
            @for (r of summary(); track r.name) {
              <li><strong>{{ r.name }}</strong> {{ r.count }} turni · {{ r.hours }} ore</li>
            }
          </ul>
        </section>
      }
      <p class="muted small">I turni senza setter restano visibili a tutte nella pagina Turno, ma nessuna riceve l'avviso.</p>
    </div>
  `,
})
export class TurniAdminComponent {
  private readonly api = inject(ShiftApiService);
  private readonly setterApi = inject(SetterApiService);
  private readonly toast = inject(ToastService);

  readonly slots = SLOTS;
  readonly today = romeDate(new Date());
  readonly mondayOf = mondayOf;
  readonly week = signal(mondayOf(this.today));
  readonly busy = signal(false);

  readonly settersResource = rxResource({ stream: () => this.setterApi.getAll() });
  readonly setters = computed(() => this.settersResource.value() ?? []);

  readonly shiftsResource = rxResource({
    params: () => this.week(),
    stream: ({ params: from }) => this.api.shifts(from, addDays(from, 6)),
  });

  readonly days = computed(() =>
    Array.from({ length: 7 }, (_, i) => {
      const date = addDays(this.week(), i);
      return { date, ...dayParts(date) };
    }),
  );

  readonly weekLabel = computed(() => {
    const a = dayParts(this.week());
    const b = dayParts(addDays(this.week(), 6));
    return `${a.day} ${a.month} – ${b.day} ${b.month}`;
  });

  private readonly byKey = computed(
    () => new Map((this.shiftsResource.value() ?? []).map(s => [`${s.date}#${s.slot}`, Number(s.setter.id)])),
  );

  readonly summary = computed(() => {
    const hours: Record<number, number> = { 1: 3, 2: 5, 3: 3 };
    const acc = new Map<string, { name: string; count: number; hours: number }>();
    for (const s of this.shiftsResource.value() ?? []) {
      const r = acc.get(s.setter.name) ?? { name: s.setter.name, count: 0, hours: 0 };
      r.count++;
      r.hours += hours[s.slot] ?? 0;
      acc.set(s.setter.name, r);
    }
    return [...acc.values()].sort((a, b) => b.hours - a.hours);
  });

  assigned(date: string, slot: number): number | null {
    return this.byKey().get(`${date}#${slot}`) ?? null;
  }

  move(days: number): void {
    this.week.set(addDays(this.week(), days));
  }

  assign(date: string, slot: number, value: string): void {
    this.busy.set(true);
    this.api.setShift(date, slot, value ? Number(value) : null).subscribe({
      next: () => {
        this.busy.set(false);
        this.shiftsResource.reload();
      },
      error: () => {
        this.busy.set(false);
        this.toast.error('Turno non salvato');
        this.shiftsResource.reload();
      },
    });
  }

  copyPrevious(): void {
    this.busy.set(true);
    this.api.copyWeek(addDays(this.week(), -7), this.week()).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success('Turni copiati dalla settimana precedente');
        this.shiftsResource.reload();
      },
      error: () => {
        this.busy.set(false);
        this.toast.error('Copia non riuscita');
      },
    });
  }
}
