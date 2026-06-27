import { Component, computed, input } from '@angular/core';
import { CommissionPoint } from '../models';

// ---- Bar Chart --------------------------------------------------
@Component({
  selector: 'app-bar-chart',
  template: `
    <svg class="chart" [attr.viewBox]="'0 0 ' + W + ' ' + H" preserveAspectRatio="none" style="width:100%;height:220px">
      @for (g of gridLines; track $index) {
        <line [attr.x1]="padL" [attr.x2]="W" [attr.y1]="g" [attr.y2]="g" stroke="var(--border)" stroke-width="1" />
      }
      @for (item of barItems(); track item.i) {
        <rect [attr.x]="item.x" [attr.y]="item.y" [attr.width]="barW" [attr.height]="item.h" rx="6"
          [attr.fill]="item.last ? 'var(--accent)' : 'var(--accent-soft-2)'" />
        <text [attr.x]="item.x + barW / 2" [attr.y]="H - 9" text-anchor="middle" class="chart-axis">{{ item.m }}</text>
      }
    </svg>
  `,
})
export class BarChartComponent {
  readonly data = input.required<CommissionPoint[]>();

  readonly W = 560;
  readonly H = 220;
  readonly padB = 28;
  readonly padT = 14;
  readonly padL = 4;

  get barW(): number {
    return Math.min(46, ((this.W - this.padL) / (this.data()?.length || 1)) * 0.5);
  }

  get gridLines(): number[] {
    return [0.25, 0.5, 0.75, 1].map(g => this.padT + (this.H - this.padT - this.padB) * (1 - g));
  }

  readonly barItems = computed(() => {
    const data = this.data();
    const max = Math.max(...data.map(d => d.v)) * 1.18;
    const bw = (this.W - this.padL) / data.length;
    const barW = Math.min(46, bw * 0.5);
    return data.map((d, i) => {
      const h = (this.H - this.padT - this.padB) * (d.v / max);
      const x = this.padL + bw * i + (bw - barW) / 2;
      return { i, x, y: this.H - this.padB - h, h, m: d.m, last: i === data.length - 1 };
    });
  });
}

// ---- Area Chart -------------------------------------------------
@Component({
  selector: 'app-area-chart',
  template: `
    <svg class="chart" [attr.viewBox]="'0 0 ' + W + ' ' + H" preserveAspectRatio="none" style="width:100%;height:220px">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.22" />
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.01" />
        </linearGradient>
      </defs>
      @for (g of gridLines(); track $index) {
        <line [attr.x1]="padL" [attr.x2]="W - padR" [attr.y1]="g" [attr.y2]="g" stroke="var(--border)" stroke-width="1" />
      }
      <path [attr.d]="areaPath()" fill="url(#areaGrad)" />
      <path [attr.d]="linePath()" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
      @for (pt of points(); track $index) {
        <circle [attr.cx]="pt.x" [attr.cy]="pt.y" [attr.r]="pt.last ? 5 : 3.5" fill="#fff" stroke="var(--accent)" stroke-width="2.5" />
        <text [attr.x]="pt.x" [attr.y]="H - 9" text-anchor="middle" class="chart-axis">{{ pt.m }}</text>
      }
    </svg>
  `,
})
export class AreaChartComponent {
  readonly data = input.required<CommissionPoint[]>();

  readonly W = 560;
  readonly H = 220;
  readonly padB = 28;
  readonly padT = 14;
  readonly padL = 8;
  readonly padR = 8;

  readonly gridLines = computed(() =>
    [0.25, 0.5, 0.75, 1].map(g => this.padT + (this.H - this.padT - this.padB) * (1 - g))
  );

  readonly points = computed(() => {
    const data = this.data();
    const max = Math.max(...data.map(d => d.v)) * 1.18;
    const plotW = this.W - this.padL - this.padR;
    const plotH = this.H - this.padT - this.padB;
    return data.map((d, i) => ({
      x: this.padL + plotW * (i / (data.length - 1)),
      y: this.padT + plotH * (1 - d.v / max),
      m: d.m,
      last: i === data.length - 1,
    }));
  });

  readonly linePath = computed(() =>
    this.points().map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')
  );

  readonly areaPath = computed(() => {
    const pts = this.points();
    return this.linePath() +
      ` L ${pts[pts.length - 1].x} ${this.H - this.padB} L ${pts[0].x} ${this.H - this.padB} Z`;
  });
}

// ---- Donut Chart ------------------------------------------------
interface DonutArc {
  d: string;
  color: string;
}

@Component({
  selector: 'app-donut-chart',
  template: `
    <svg [attr.viewBox]="'0 0 ' + size() + ' ' + size()" [style.width.px]="size()" [style.height.px]="size()">
      @for (arc of arcs(); track $index) {
        <path [attr.d]="arc.d" [attr.fill]="arc.color" />
      }
      <text [attr.x]="size() / 2" [attr.y]="size() / 2 - 4" text-anchor="middle" class="donut-label">{{ label() }}</text>
      <text [attr.x]="size() / 2" [attr.y]="size() / 2 + 16" text-anchor="middle" class="donut-sub">{{ sub() }}</text>
    </svg>
  `,
  host: { style: 'display:contents' },
})
export class DonutChartComponent {
  readonly slices = input.required<{ v: number; color: string }[]>();
  readonly size = input<number>(200);
  readonly label = input<string>('');
  readonly sub = input<string>('');

  readonly arcs = computed<DonutArc[]>(() => {
    const slices = this.slices();
    const total = slices.reduce((s, x) => s + x.v, 0);
    const R = this.size() / 2;
    const r = R * 0.64;
    const cx = R, cy = R;
    let acc = -Math.PI / 2;

    return slices.map(s => {
      const frac = s.v / total;
      const a0 = acc;
      const a1 = acc + frac * Math.PI * 2;
      acc = a1;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (a: number, rad: number): [number, number] => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
      const [x0, y0] = p(a0, R), [x1, y1] = p(a1, R);
      const [x2, y2] = p(a1, r), [x3, y3] = p(a0, r);
      return { d: `M${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${r} ${r} 0 ${large} 0 ${x3} ${y3} Z`, color: s.color };
    });
  });
}
