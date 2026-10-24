import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { ShiftApiService } from '../../shift/shift-api.service';
import { SetterApiService } from '../../setter/setter-api.service';
import { ToastService } from '../../shared/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { addDays, dayParts, mondayOf, romeDate } from '../../booking/rome-time';

const SLOTS = [
  { slot: 1, label: 'Primo', hours: '8–11', length: 3 },
  { slot: 2, label: 'Secondo', hours: '11–16', length: 5 },
  { slot: 3, label: 'Terzo', hours: '16–24', length: 8 },
];

// Calendario dei turni delle setter (admin): turni fissi ed eccezioni giorno per giorno
@Component({
  selector: 'app-turni-admin',
  imports: [IconComponent],
  styleUrl: './turni-admin.component.css',
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Turni setter</h1>
          <p class="page-sub">Chi copre ogni turno (lead ADS e messaggi organici). I lead ADS finiscono nella coda del turno in base all'ora di arrivo e la setter di turno riceve l'avviso su Telegram.</p>
        </div>
      </div>

      <section class="card">
        <h2>Turni fissi</h2>
        <p class="muted small">Valgono tutti i giorni. Per un cambio di un solo giorno usa il calendario qui sotto.</p>
        <div class="defaults">
          @for (s of slots; track s.slot) {
            <label class="default">
              <span class="default-label"><strong>{{ s.label }} turno</strong><span class="muted">{{ s.hours }}</span></span>
              <select [disabled]="busy()" (change)="setDefault(s.slot, $any($event.target).value)">
                <option value="" [selected]="!defaultOf(s.slot)">— nessuna —</option>
                @for (st of setters(); track st.id) {
                  <option [value]="st.id" [selected]="defaultOf(s.slot)?.id === +st.id">{{ fullName(st) }}</option>
                }
              </select>
            </label>
          }
        </div>
      </section>

      <div class="week-nav">
        <button type="button" class="icon-btn" (click)="move(-7)" aria-label="Settimana precedente"><app-icon name="chevronL" [size]="16" /></button>
        <strong>{{ weekLabel() }}</strong>
        <button type="button" class="icon-btn" (click)="move(7)" aria-label="Settimana successiva"><app-icon name="chevron" [size]="16" /></button>
        <button type="button" class="btn-ghost sm" (click)="week.set(mondayOf(today))">Oggi</button>
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
                  <td [class.is-today]="d.date === today" [class.changed]="override(d.date, s.slot) !== null">
                    <select
                      [attr.aria-label]="s.label + ' turno, ' + d.weekday + ' ' + d.day"
                      [disabled]="busy()"
                      (change)="assign(d.date, s.slot, $any($event.target).value)"
                    >
                      <option value="" [selected]="override(d.date, s.slot) === null">{{ firstName(defaultOf(s.slot)?.name) }} (fisso)</option>
                      @for (st of setters(); track st.id) {
                        <option [value]="st.id" [selected]="override(d.date, s.slot) === +st.id">{{ firstName(st.name) }}</option>
                      }
                    </select>
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p class="muted small legend"><span class="swatch" aria-hidden="true"></span> Cambio rispetto al turno fisso. Per annullarlo scegli la voce "(fisso)".</p>

      @if (summary().length) {
        <section class="card">
          <h2>Ore della settimana</h2>
          <ul class="summary">
            @for (r of summary(); track r.name) {
              <li><strong>{{ r.name }}</strong> {{ r.count }} turni · {{ r.hours }} ore</li>
            }
          </ul>
        </section>
      }
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

  readonly defaultsResource = rxResource({ stream: () => this.api.defaults() });

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

  private readonly overrides = computed(
    () => new Map((this.shiftsResource.value() ?? []).map(s => [`${s.date}#${s.slot}`, s.setter])),
  );

  /** Chi copre davvero ogni turno della settimana: eccezione o turno fisso */
  readonly summary = computed(() => {
    const acc = new Map<string, { name: string; count: number; hours: number }>();
    for (const d of this.days()) {
      for (const s of SLOTS) {
        const who = this.overrides().get(`${d.date}#${s.slot}`) ?? this.defaultOf(s.slot);
        if (!who) continue;
        const r = acc.get(who.name) ?? { name: who.name, count: 0, hours: 0 };
        r.count++;
        r.hours += s.length;
        acc.set(who.name, r);
      }
    }
    return [...acc.values()].sort((a, b) => b.hours - a.hours);
  });

  defaultOf(slot: number) {
    return this.defaultsResource.value()?.find(d => d.slot === slot)?.setter ?? null;
  }

  override(date: string, slot: number): number | null {
    const s = this.overrides().get(`${date}#${slot}`);
    return s ? Number(s.id) : null;
  }

  fullName(s: { name: string | null; lastName: string | null }): string {
    return [s.name, s.lastName].filter(Boolean).join(' ');
  }

  firstName(name: string | null | undefined): string {
    return name?.split(' ')[0] || '—';
  }

  move(days: number): void {
    this.week.set(addDays(this.week(), days));
  }

  private run(req: Observable<unknown>, after: () => void, errorMsg: string): void {
    this.busy.set(true);
    req.subscribe({
      next: () => {
        this.busy.set(false);
        after();
      },
      error: () => {
        this.busy.set(false);
        this.toast.error(errorMsg);
        after();
      },
    });
  }

  setDefault(slot: number, value: string): void {
    this.run(
      this.api.setDefault(slot, value ? Number(value) : null),
      () => this.defaultsResource.reload(),
      'Turno fisso non salvato',
    );
  }

  assign(date: string, slot: number, value: string): void {
    this.run(
      this.api.setShift(date, slot, value ? Number(value) : null),
      () => this.shiftsResource.reload(),
      'Turno non salvato',
    );
  }
}
