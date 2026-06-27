import { Component, computed, model, signal } from '@angular/core';
import { IconComponent } from '../../shared/icon.component';

const IT_MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

function isoMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface MonthItem {
  iso: string;
  label: string;
  year: number;
  yearShort: string;
  isSelected: boolean;
  isCurrent: boolean;
}

@Component({
  selector: 'app-month-nav',
  imports: [IconComponent],
  styleUrl: './month-nav.component.css',
  template: `
    <div class="date-nav">
      <span class="date-nav-month">{{ yearLabel() }}</span>

      <button class="date-nav-arrow" (click)="prevWindow()" aria-label="6 mesi precedenti">
        <app-icon name="chevronL" [size]="16" [stroke]="2.5" />
      </button>

      @for (m of months(); track m.iso) {
        <button
          class="date-nav-day"
          [class.is-today]="m.isCurrent"
          [class.is-selected]="m.isSelected"
          (click)="selectMonth(m.iso)"
          [attr.aria-pressed]="m.isSelected"
          [attr.aria-label]="m.label + ' ' + m.year"
        >
          <span class="day-abbr">{{ m.label }}</span>
          <span class="day-num">{{ m.yearShort }}</span>
          @if (m.isCurrent) {
            <span class="today-dot" aria-hidden="true"></span>
          }
        </button>
      }

      <button class="date-nav-arrow" (click)="nextWindow()" aria-label="6 mesi successivi">
        <app-icon name="chevron" [size]="16" [stroke]="2.5" />
      </button>
    </div>
  `,
})
export class MonthNavComponent {
  readonly selected = model.required<string>(); // YYYY-MM

  // Start window so current month is the last visible (rightmost)
  readonly windowAnchor = signal((() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 5, 1);
  })());

  readonly months = computed<MonthItem[]>(() => {
    const anchor = this.windowAnchor();
    const sel = this.selected();
    const current = isoMonth(new Date());
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(anchor.getFullYear(), anchor.getMonth() + i, 1);
      const iso = isoMonth(d);
      return {
        iso,
        label: IT_MONTHS[d.getMonth()],
        year: d.getFullYear(),
        yearShort: "'" + String(d.getFullYear()).slice(2),
        isSelected: iso === sel,
        isCurrent: iso === current,
      };
    });
  });

  readonly yearLabel = computed(() => {
    const ms = this.months();
    const years = new Set(ms.map(m => m.year));
    return years.size > 1
      ? `${ms[0].year} – ${ms[ms.length - 1].year}`
      : String(ms[0]?.year ?? '');
  });

  prevWindow(): void {
    this.windowAnchor.update(d => new Date(d.getFullYear(), d.getMonth() - 6, 1));
  }

  nextWindow(): void {
    this.windowAnchor.update(d => new Date(d.getFullYear(), d.getMonth() + 6, 1));
  }

  selectMonth(iso: string): void {
    this.selected.set(iso);
  }
}
