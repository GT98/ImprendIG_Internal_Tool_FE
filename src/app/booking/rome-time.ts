// Date e orari sempre in ora di Roma, qualunque sia il fuso del browser
export const TZ = 'Europe/Rome';

export function romeDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-CA', { timeZone: TZ });
}

export function romeTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString('it-IT', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
}

export function romeLongDay(d: Date | string): string {
  return new Date(d).toLocaleDateString('it-IT', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
}

export function romeLabel(d: Date | string): string {
  return `${romeLongDay(d)}, ${romeTime(d)}`;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function isoWeekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

export function mondayOf(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}

/** "2026-10-26" → { weekday: "lun", day: "26", month: "ott" } senza dipendere dal fuso del browser */
export function dayParts(date: string): { weekday: string; day: string; month: string } {
  const d = new Date(`${date}T12:00:00Z`);
  return {
    weekday: d.toLocaleDateString('it-IT', { timeZone: 'UTC', weekday: 'short' }).replace('.', ''),
    day: d.toLocaleDateString('it-IT', { timeZone: 'UTC', day: 'numeric' }),
    month: d.toLocaleDateString('it-IT', { timeZone: 'UTC', month: 'short' }).replace('.', ''),
  };
}

/** Data e ora di Roma → ISO UTC (gestisce l'ora legale) */
export function romeToIso(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  const offset = (at: number) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }).formatToParts(new Date(at)).map(x => [x.type, x.value]),
    );
    return Date.UTC(+p['year'], +p['month'] - 1, +p['day'], +p['hour'], +p['minute'], +p['second']) - Math.floor(at / 1000) * 1000;
  };
  let at = wall - offset(wall);
  at = wall - offset(at);
  return new Date(at).toISOString();
}
