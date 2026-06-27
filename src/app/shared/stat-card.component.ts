import { Component, input } from '@angular/core';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-stat-card',
  imports: [IconComponent],
  template: `
    <div class="stat-card">
      <div class="stat-card-top">
        <span class="stat-icon" [class.stat-icon-accent]="accent()">
          <app-icon [name]="icon()" [size]="18" />
        </span>
        @if (trend() !== null) {
          <span class="stat-trend" [class.up]="trend()! >= 0" [class.down]="trend()! < 0">
            <app-icon [name]="trend()! >= 0 ? 'arrowUp' : 'arrowDown'" [size]="13" [stroke]="2.5" />
            {{ absTrend() }}%
          </span>
        }
      </div>
      <div class="stat-value">{{ value() }}</div>
      <div class="stat-label">{{ label() }}</div>
      @if (sub()) {
        <div class="stat-sub">{{ sub() }}</div>
      }
    </div>
  `,
})
export class StatCardComponent {
  readonly icon = input.required<string>();
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly sub = input<string>('');
  readonly trend = input<number | null>(null);
  readonly accent = input<boolean>(false);

  absTrend(): number {
    return Math.abs(this.trend() ?? 0);
  }
}
