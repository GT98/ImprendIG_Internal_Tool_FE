import { Component, input } from '@angular/core';

const ICONS: Record<string, string | string[]> = {
  phone:    'M15.5 13.5l-1.8 1.8a13 13 0 01-5-5l1.8-1.8-2-4.5H4.5A1.5 1.5 0 003 5.5C3 13 11 21 18.5 21A1.5 1.5 0 0020 19.5V16l-4.5-2.5z',
  chart:    ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
  users:    ['M16 19a4 4 0 00-8 0', 'M12 11a3 3 0 100-6 3 3 0 000 6', 'M20 19a3.5 3.5 0 00-4-3.4', 'M18 11.5a2.5 2.5 0 100-5'],
  calendar: ['M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z', 'M3 9h18', 'M8 3v4', 'M16 3v4'],
  clock:    ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M12 8v4l3 2'],
  check:    'M5 12l4.5 4.5L19 6.5',
  x:        ['M6 6l12 12', 'M18 6L6 18'],
  search:   ['M11 19a8 8 0 100-16 8 8 0 000 16z', 'M21 21l-4.3-4.3'],
  bell:     ['M18 9a6 6 0 10-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9z', 'M13.5 20a2 2 0 01-3 0'],
  arrowUp:  ['M12 19V5', 'M6 11l6-6 6 6'],
  arrowDown:['M12 5v14', 'M6 13l6 6 6-6'],
  euro:     ['M16 7a5 5 0 100 10', 'M4 11h7', 'M4 14h6'],
  card:     ['M3 7h18a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V8a1 1 0 011-1z', 'M2 11h20'],
  video:    ['M3 7a1 1 0 011-1h9a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1z', 'M14 10l6-3v10l-6-3'],
  external: ['M14 4h6v6', 'M20 4l-9 9', 'M18 13v6a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h6'],
  filter:   ['M3 5h18', 'M6 12h12', 'M10 19h4'],
  grid:     ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
  zap:      'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  copy:     ['M8 4H5a1 1 0 00-1 1v14a1 1 0 001 1h10a1 1 0 001-1v-3', 'M8 4a1 1 0 011-1h6l4 4v10a1 1 0 01-1 1H9a1 1 0 01-1-1V4z'],
  edit:     ['M11 4H4a1 1 0 00-1 1v14a1 1 0 001 1h14a1 1 0 001-1v-7', 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z'],
  chevron:  'M9 6l6 6-6 6',
  chevronL: 'M15 18l-6-6 6-6',
  chevronD: 'M6 9l6 6 6-6',
  logout:   ['M9 21H5a1 1 0 01-1-1V4a1 1 0 011-1h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  plus:     ['M12 5v14', 'M5 12h14'],
  target:   ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M12 16a4 4 0 100-8 4 4 0 000 8z', 'M12 12h.01'],
  trophy:        ['M7 4h10v4a5 5 0 01-10 0V4z', 'M7 6H4v1a3 3 0 003 3', 'M17 6h3v1a3 3 0 01-3 3', 'M9 15h6', 'M10 20h4', 'M12 15v5'],
  alertTriangle: ['M10.3 4.4L2.5 17.5a2 2 0 001.7 3h15.6a2 2 0 001.7-3L13.7 4.4a2 2 0 00-3.4 0z', 'M12 10v4', 'M12 17h.01'],
  home:          ['M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z', 'M9 21V12h6v9'],
  trending:      ['M22 7l-8.5 8.5-5-5L2 17', 'M16 7h6v6'],
  activity:      'M22 12h-4l-3 9L9 3l-3 9H2',
  swap:          ['M7 16V4m0 0L3 8m4-4l4 4', 'M17 8v12m0 0l4-4m-4 4l-4-4'],
};

@Component({
  selector: 'app-icon',
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="stroke()"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      @for (p of paths(); track $index) {
        <path [attr.d]="p" />
      }
    </svg>
  `,
  host: { style: 'display:contents' },
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input<number>(20);
  readonly stroke = input<number>(2);

  get paths(): () => string[] {
    return () => {
      const d = ICONS[this.name()];
      if (!d) return [];
      return Array.isArray(d) ? d : [d];
    };
  }
}
