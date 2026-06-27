import { Component, computed, model, signal } from '@angular/core';
import { IconComponent } from '../../shared/icon.component';
import { addDays, getMonday, isSameDay, startOfDay } from '../../utils';

const DAYS_ABBR = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

interface DayItem {
  date: Date;
  abbr: string;
  num: number;
  isToday: boolean;
  isSelected: boolean;
}

@Component({
  selector: 'app-date-nav',
  imports: [IconComponent],
  templateUrl: './date-nav.component.html',
  styleUrl: './date-nav.component.css',
})
export class DateNavComponent {
  readonly selected = model.required<Date>();

  readonly weekStart = signal(getMonday(new Date()));

  readonly monthLabel = computed(() => {
    const days = this.days();
    const mid = days[3].date;
    return `${MESI[mid.getMonth()]} ${mid.getFullYear()}`;
  });

  readonly days = computed<DayItem[]>(() => {
    const start = this.weekStart();
    const sel = this.selected();
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      return {
        date,
        abbr: DAYS_ABBR[date.getDay()],
        num: date.getDate(),
        isToday: isSameDay(date, now),
        isSelected: isSameDay(date, sel),
      };
    });
  });

  prevWeek(): void {
    this.weekStart.update(d => addDays(d, -7));
  }

  nextWeek(): void {
    this.weekStart.update(d => addDays(d, 7));
  }

  selectDay(date: Date): void {
    this.selected.set(startOfDay(date));
  }
}
