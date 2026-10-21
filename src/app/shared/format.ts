// Formato euro italiano con punto sulle migliaia anche a 4 cifre (es. 9.920,98).
// Intl it-IT non raggruppa i numeri a 4 cifre, quindi il separatore è inserito a mano.
export function formatEuro(value: number | string | null | undefined, decimals = 2): string {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  const [int, dec] = Math.abs(safe).toFixed(decimals).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${safe < 0 ? '-' : ''}${grouped}${dec ? ',' + dec : ''}`;
}
