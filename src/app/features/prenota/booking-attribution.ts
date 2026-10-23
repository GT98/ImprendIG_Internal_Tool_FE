// Ricorda per 30 giorni da quale link (setter) o campagna arriva la persona,
// così l'attribuzione resta anche se prenota in un secondo momento.
const KEY = 'prenota_attr';
const TTL_MS = 30 * 24 * 3600_000;
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'];

export interface Attribution {
  ref?: string;
  utm?: Record<string, string>;
}

export function captureAttribution(params: URLSearchParams | Record<string, string | undefined>): Attribution {
  const get = (k: string) =>
    params instanceof URLSearchParams ? params.get(k) ?? undefined : params[k];
  const ref = get('ref')?.trim().toLowerCase() || undefined;
  const utm = Object.fromEntries(
    UTM_KEYS.map(k => [k, get(k)]).filter((e): e is [string, string] => Boolean(e[1])),
  );
  const fresh: Attribution = { ref, utm: Object.keys(utm).length ? utm : undefined };

  try {
    if (fresh.ref || fresh.utm) {
      localStorage.setItem(KEY, JSON.stringify({ ...fresh, at: Date.now() }));
      return fresh;
    }
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as (Attribution & { at: number }) | null;
    if (saved && Date.now() - saved.at < TTL_MS) return { ref: saved.ref, utm: saved.utm };
  } catch {
    // storage non disponibile (navigazione privata): vale solo l'URL
  }
  return fresh;
}
