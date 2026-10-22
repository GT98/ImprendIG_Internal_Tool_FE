// Affiancamento 1:1 per percorso, calcolato dal BE (vedi affiancamento.util.ts)
export interface AffiancamentoDto {
  clientId: number;
  academy: string;
  position: number;
  unlockInstallment: number | null;
  startDate: string | null;
  source: 'auto' | 'manual' | null;
}

export interface UpdateAffiancamentoDto {
  academyOrder?: number[] | null;
  overrides?: Record<string, string | null>;
}

export function fmtIsoDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

export function affiancamentoLabel(a: AffiancamentoDto): string {
  if (a.startDate) return fmtIsoDate(a.startDate);
  return a.unlockInstallment ? `alla rata ${a.unlockInstallment}` : 'Da definire';
}
