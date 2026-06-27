import { Component, input, output } from '@angular/core';

export interface SegOption {
  value: string;
  label: string;
  icon?: string;
}

@Component({
  selector: 'app-segmented',
  template: `
    <div class="segmented" role="tablist">
      @for (opt of options(); track opt.value) {
        <button
          role="tab"
          class="seg-btn"
          [class.active]="value() === opt.value"
          (click)="changed.emit(opt.value)"
        >
          {{ opt.label }}
        </button>
      }
    </div>
  `,
  host: { style: 'display:contents' },
})
export class SegmentedComponent {
  readonly options = input.required<SegOption[]>();
  readonly value = input.required<string>();
  readonly changed = output<string>();
}
