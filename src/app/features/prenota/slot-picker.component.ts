import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { dayParts, romeDate, romeLabel, romeTime } from '../../booking/rome-time';

interface Day {
  date: string;
  parts: { weekday: string; day: string; month: string };
  slots: string[];
}

// Scelta del giorno e dell'orario tra gli slot liberi (ISO UTC, mostrati in ora di Roma)
@Component({
  selector: 'app-slot-picker',
  styleUrl: './prenota.component.css',
  template: `
    @if (days().length === 0) {
      <div class="state">
        <p class="state-title">Nessun orario libero al momento</p>
        <p>Riprova tra qualche giorno: aggiungiamo nuove disponibilità ogni settimana.</p>
      </div>
    } @else {
      <section class="picker">
        <div class="days" role="listbox" aria-label="Scegli il giorno">
          @for (d of days(); track d.date) {
            <button
              type="button"
              class="day"
              role="option"
              [class.active]="d.date === selectedDate()"
              [attr.aria-selected]="d.date === selectedDate()"
              (click)="selectedDate.set(d.date)"
            >
              <span class="day-wd">{{ d.parts.weekday }}</span>
              <span class="day-num">{{ d.parts.day }}</span>
              <span class="day-month">{{ d.parts.month }}</span>
            </button>
          }
        </div>

        <div class="times">
          <h2 class="times-title">{{ selectedDayLabel() }}</h2>
          <div class="time-grid">
            @for (slot of selectedDay()?.slots ?? []; track slot) {
              <button type="button" class="time" [class.current]="slot === current()" [disabled]="slot === current()" (click)="picked.emit(slot)">
                {{ time(slot) }}
              </button>
            }
          </div>
          <p class="tz">Orari in ora italiana</p>
        </div>
      </section>
    }
  `,
})
export class SlotPickerComponent {
  readonly slots = input.required<string[]>();
  /** Orario già prenotato (nella pagina di spostamento) */
  readonly current = input<string | null>(null);
  readonly picked = output<string>();

  readonly days = computed<Day[]>(() => {
    const byDate = new Map<string, string[]>();
    for (const s of this.slots()) {
      const d = romeDate(s);
      byDate.set(d, [...(byDate.get(d) ?? []), s]);
    }
    return [...byDate.entries()].map(([date, slots]) => ({ date, parts: dayParts(date), slots }));
  });

  readonly selectedDate = linkedSignal<Day[], string | null>({
    source: this.days,
    computation: (days, prev) =>
      prev?.value && days.some(d => d.date === prev.value) ? prev.value : (days[0]?.date ?? null),
  });
  readonly selectedDay = computed(() => this.days().find(d => d.date === this.selectedDate()) ?? null);
  readonly selectedDayLabel = computed(() => {
    const d = this.selectedDay();
    return d ? romeLabel(d.slots[0]).split(',')[0] : '';
  });

  readonly time = romeTime;
}
