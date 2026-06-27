import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-progress-bar',
  template: `
    <div class="progress">
      <div class="progress-fill" [style.width]="pct() + '%'"></div>
    </div>
  `,
})
export class ProgressBarComponent {
  readonly value = input.required<number>();
  readonly max = input.required<number>();
  readonly pct = computed(() => Math.min(100, (this.value() / this.max()) * 100));
}
