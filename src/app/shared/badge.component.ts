import { Component, input } from '@angular/core';

export const CALL_STATUS: Record<string, { label: string; bg: string; fg: string; dot: string }> = {
  'da-fare':         { label: 'Da fare',        bg: '#eef0fb', fg: '#4f46e5', dot: '#4f46e5' },
  'fatta':           { label: 'Completata',      bg: '#e7f5ee', fg: '#15803d', dot: '#16a34a' },
  'si':              { label: 'Sì',              bg: '#e7f5ee', fg: '#15803d', dot: '#16a34a' },
  'ci-pensa':        { label: 'Ci pensa',        bg: '#fef6e7', fg: '#b45309', dot: '#d97706' },
  'da-risentire':    { label: 'Da risentire',    bg: '#fef6e7', fg: '#b45309', dot: '#d97706' },
  'non-qualificato': { label: 'Non Qualificato', bg: '#f3f4f6', fg: '#6b7280', dot: '#9ca3af' },
  'annullato':       { label: 'Annullato',       bg: '#f3f4f6', fg: '#6b7280', dot: '#9ca3af' },
  'no':              { label: 'No',              bg: '#fdeceb', fg: '#b91c1c', dot: '#dc2626' },
  'no-show':         { label: 'No Show',         bg: '#fdeceb', fg: '#b91c1c', dot: '#dc2626' },
};

export const CALL_TYPE: Record<string, { label: string; fg: string }> = {
  'demo':      { label: 'Demo',      fg: '#7c3aed' },
  'follow-up': { label: 'Follow-up', fg: '#0891b2' },
  'closing':   { label: 'Closing',   fg: '#db8c0e' },
};

export const PAY_STATUS: Record<string, { label: string; bg: string; fg: string; dot: string }> = {
  'pagato':  { label: 'Pagato',    bg: '#e7f5ee', fg: '#15803d', dot: '#16a34a' },
  'pending': { label: 'In attesa', bg: '#fef6e7', fg: '#b45309', dot: '#d97706' },
  'fallito': { label: 'Fallito',   bg: '#fdeceb', fg: '#b91c1c', dot: '#dc2626' },
};

@Component({
  selector: 'app-status-badge',
  template: `
    @if (meta(); as m) {
      <span class="badge" [style.background]="m.bg" [style.color]="m.fg">
        <span class="badge-dot" [style.background]="m.dot"></span>
        {{ m.label }}
      </span>
    }
  `,
  host: { style: 'display:contents' },
})
export class StatusBadgeComponent {
  readonly status = input.required<string>();
  readonly kind = input<'call' | 'pay'>('call');

  get meta() {
    return () => {
      const map = this.kind() === 'pay' ? PAY_STATUS : CALL_STATUS;
      return map[this.status()] ?? null;
    };
  }
}

@Component({
  selector: 'app-type-chip',
  template: `
    @if (meta(); as m) {
      <span class="type-chip" [style.color]="m.fg" [style.border-color]="m.fg + '44'">
        {{ m.label }}
      </span>
    }
  `,
  host: { style: 'display:contents' },
})
export class TypeChipComponent {
  readonly type = input.required<string>();

  get meta() {
    return () => CALL_TYPE[this.type()] ?? null;
  }
}
