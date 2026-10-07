import { Component, input } from '@angular/core';
import { Seller } from '../models';

@Component({
  selector: 'app-avatar',
  template: `
    @if (seller()) {
      <span
        class="avatar"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.background]="seller()!.color"
        [style.font-size.px]="size() * 0.4"
      >{{ seller()!.initials }}</span>
    } @else {
      <span
        class="avatar avatar--empty"
        [style.width.px]="size()"
        [style.height.px]="size()"
      >—</span>
    }
  `,
  host: { style: 'display:contents' },
})
export class AvatarComponent {
  readonly seller = input<Seller | null | undefined>();
  readonly size = input<number>(36);
}
