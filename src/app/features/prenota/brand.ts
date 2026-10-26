import { BookingBrand } from '../../booking/booking-api.service';

const hex = (v: string | undefined, fallback: string) =>
  v && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : fallback;

function rgb(h: string): number[] {
  const s = h.length === 4 ? h.slice(1).split('').map(c => c + c).join('') : h.slice(1);
  return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16));
}

/** Luminosità percepita, 0 (nero) – 1 (bianco) */
function lightness(h: string): number {
  const [r, g, b] = rgb(h);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Colore mescolato col bianco: pct = quota del colore */
function tint(h: string, pct: number, base = '#ffffff'): string {
  const a = rgb(h);
  const b = rgb(base);
  return '#' + a.map((v, i) => Math.round(v * pct + b[i] * (1 - pct)).toString(16).padStart(2, '0')).join('');
}

/**
 * Variabili CSS della palette del percorso (vedi prenota.component.css).
 * I colori già chiari (es. rosa e giallo pastello) si usano pieni, quelli
 * scuri si schiariscono per bordi ed evidenziazioni.
 */
export function brandVars(b: BookingBrand | undefined | null): Record<string, string> {
  const color = hex(b?.color, '#4f46e5');
  const soft = hex(b?.soft, color);
  const bg = hex(b?.background, '#f7f7fa');
  const softPct = lightness(soft) > 0.85 ? 1 : 0.3;
  return {
    '--brand': color,
    '--on-brand': hex(b?.onColor, '#ffffff'),
    '--brand-ink': hex(b?.accent, color),
    '--brand-line': lightness(color) > 0.7 ? color : tint(color, 0.55),
    '--brand-soft': tint(soft, softPct),
    '--page-top': tint(soft, lightness(soft) > 0.85 ? 1 : 0.35, bg),
    '--page-bg': bg,
  };
}
