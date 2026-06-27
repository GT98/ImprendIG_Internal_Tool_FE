import { Component, input } from '@angular/core';
import { Seller } from '../models';

@Component({
  selector: 'app-avatar',
  template: `
    <span
      class="avatar"
      [style.width.px]="size()"
      [style.height.px]="size()"
      [style.background]="seller().color"
      [style.font-size.px]="size() * 0.4"
    >{{ seller().initials }}</span>
  `,
  host: { style: 'display:contents' },
})
export class AvatarComponent {
  readonly seller = input.required<Seller>();
  readonly size = input<number>(36);
}
