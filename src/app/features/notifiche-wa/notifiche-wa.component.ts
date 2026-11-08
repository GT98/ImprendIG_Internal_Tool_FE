import { Component, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SellerApiService } from '../../seller/seller-api.service';
import { ToastService } from '../../shared/toast.service';

const API = environment.apiUrl;

interface TaskRow {
  id: number;
  kind: string;
  status: 'scheduled' | 'sent' | 'done' | 'cancelled' | 'failed';
  short: string;
  title: string;
  seller: { id: number; name: string } | null;
  contactName: string;
  saleId: number | null;
  bookingId: number | null;
  dueAt: string;
  sentAt: string | null;
  doneAt: string | null;
  error: string | null;
  token: string;
  message: { status: string; deliveredAt: string | null; readAt: string | null; failedAt: string | null; error: string | null } | null;
}

interface MessageRow {
  id: number;
  direction: 'out' | 'in';
  phone: string;
  template: string | null;
  body: string | null;
  status: string;
  error: string | null;
  createdAt: string;
  deliveredAt: string | null;
  readAt: string | null;
}

const TASK_STATUS: Record<TaskRow['status'], string> = {
  scheduled: 'In attesa', sent: 'Inviata', done: 'Fatta', cancelled: 'Annullata', failed: 'Non partita',
};
const MSG_STATUS: Record<string, string> = {
  accepted: 'Accettato da Meta', sent: 'Inviato', delivered: 'Consegnato', read: 'Letto', failed: 'Non consegnato', received: 'Ricevuto',
};

/**
 * Notifiche WhatsApp (solo admin): le notifiche dei flussi alle venditrici con lo stato di consegna,
 * e tutti i messaggi passati dal numero aziendale (prove e risposte comprese).
 */
@Component({
  selector: 'app-notifiche-wa',
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Notifiche WhatsApp</h1>
          <p class="page-sub">Cosa è partito dal numero aziendale, quando, e se è stato consegnato e letto.</p>
        </div>
      </div>

      <div class="tabs" role="tablist">
        <button role="tab" type="button" [attr.aria-selected]="tab() === 'flussi'" [class.on]="tab() === 'flussi'" (click)="tab.set('flussi')">Notifiche dei flussi</button>
        <button role="tab" type="button" [attr.aria-selected]="tab() === 'messaggi'" [class.on]="tab() === 'messaggi'" (click)="tab.set('messaggi')">Tutti i messaggi</button>
      </div>

      @if (tab() === 'flussi') {
        <div class="filters">
          <label class="f"><span>Flusso</span>
            <select id="f-flow" (change)="flow.set(val($event))">
              <option value="">Tutti</option><option value="pre">Pre call</option><option value="post">Post call</option>
            </select>
          </label>
          <label class="f"><span>Stato</span>
            <select id="f-status" (change)="status.set(val($event))">
              <option value="">Tutti (tranne annullate)</option>
              @for (s of statusKeys; track s) { <option [value]="s">{{ TASK_STATUS[s] }}</option> }
            </select>
          </label>
          <label class="f"><span>Venditrice</span>
            <select id="f-seller" (change)="sellerId.set(val($event))">
              <option value="">Tutte</option>
              @for (v of sellers.value() ?? []; track v.id) { <option [value]="v.id">{{ v.name }} {{ v.lastName ?? '' }}</option> }
            </select>
          </label>
        </div>

        @if (tasks.isLoading() && !tasks.hasValue()) {
          <p class="muted">Carico…</p>
        } @else if (!rows().length) {
          <p class="empty">Nessuna notifica con questi filtri. I flussi partono solo per le vendite e le prenotazioni nuove, dalla data impostata in WA_FLOWS_START.</p>
        } @else {
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>Prevista</th><th>Passaggio</th><th>Venditrice</th><th>Cliente</th><th>Stato</th><th>Consegna</th><th class="act"><span class="sr-only">Azioni</span></th>
              </tr></thead>
              <tbody>
                @for (t of rows(); track t.id) {
                  <tr [class.dim]="t.status === 'cancelled'">
                    <td class="num">{{ fmt(t.dueAt) }}</td>
                    <td>
                      <span class="flow" [class.pre]="t.kind.startsWith('pre_')">{{ t.kind.startsWith('pre_') ? 'Pre call' : 'Post call' }}</span>
                      {{ t.short }}
                      <span class="ref">{{ t.saleId ? 'vendita #' + t.saleId : 'prenotazione #' + t.bookingId }}</span>
                    </td>
                    <td>{{ t.seller?.name || '—' }}</td>
                    <td>{{ t.contactName }}</td>
                    <td>
                      <span class="pill" [attr.data-s]="t.status">{{ TASK_STATUS[t.status] }}</span>
                      @if (t.error) { <span class="err">{{ t.error }}</span> }
                    </td>
                    <td class="num">
                      @if (t.message; as m) {
                        <span class="pill" [attr.data-m]="m.status">{{ MSG_STATUS[m.status] ?? m.status }}</span>
                        <span class="ref">{{ m.readAt ? 'letto ' + fmt(m.readAt) : m.deliveredAt ? 'consegnato ' + fmt(m.deliveredAt) : t.sentAt ? 'inviato ' + fmt(t.sentAt) : '' }}</span>
                        @if (m.error) { <span class="err">{{ m.error }}</span> }
                      } @else { <span class="muted">—</span> }
                      @if (t.doneAt) { <span class="ref ok">fatta {{ fmt(t.doneAt) }}</span> }
                    </td>
                    <td class="act">
                      <a class="btn-ghost sm" [href]="'/w/' + t.token" target="_blank" rel="noopener">Apri</a>
                      @if (t.status === 'failed') {
                        <button type="button" class="btn-ghost sm" [disabled]="busy() === t.id" (click)="retry(t.id)">Riprova</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      } @else {
        @if (messages.isLoading() && !messages.hasValue()) {
          <p class="muted">Carico…</p>
        } @else if (!(messages.value() ?? []).length) {
          <p class="empty">Nessun messaggio ancora.</p>
        } @else {
          <div class="table-wrap">
            <table>
              <thead><tr><th>Quando</th><th>Direzione</th><th>Numero</th><th>Contenuto</th><th>Stato</th></tr></thead>
              <tbody>
                @for (m of messages.value() ?? []; track m.id) {
                  <tr>
                    <td class="num">{{ fmt(m.createdAt) }}</td>
                    <td>{{ m.direction === 'out' ? 'Inviato' : 'Ricevuto' }}</td>
                    <td class="num">+{{ m.phone }}</td>
                    <td>{{ m.template ? 'template ' + m.template : m.body }}</td>
                    <td>
                      <span class="pill" [attr.data-m]="m.status">{{ MSG_STATUS[m.status] ?? m.status }}</span>
                      <span class="ref">{{ m.readAt ? 'letto ' + fmt(m.readAt) : m.deliveredAt ? 'consegnato ' + fmt(m.deliveredAt) : '' }}</span>
                      @if (m.error) { <span class="err">{{ m.error }}</span> }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </div>
  `,
  styles: `
    .page-head h1 { font-size: 1.4rem; font-weight: 700; margin: 0 0 4px; }
    .page-sub { margin: 0 0 16px; color: var(--ink-3); }
    .tabs { display: inline-flex; gap: 2px; padding: 3px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); margin-bottom: 14px; }
    .tabs button { border: 0; background: none; padding: 6px 14px; border-radius: 7px; font: inherit; font-size: 13px; font-weight: 600; color: var(--ink-2); cursor: pointer; }
    .tabs button.on { background: var(--accent); color: #fff; }
    .filters { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
    .f { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 700; color: var(--ink-2); }
    .f select { padding: 7px 10px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); color: var(--ink); font: inherit; font-size: 13px; font-weight: 400; }
    .table-wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 860px; }
    th { text-align: left; font-size: 11.5px; text-transform: uppercase; letter-spacing: .04em; color: var(--ink-3); padding: 10px 12px; border-bottom: 1px solid var(--border); white-space: nowrap; }
    td { padding: 10px 12px; border-bottom: 1px solid var(--border-2, var(--border)); vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    tr.dim { opacity: .55; }
    .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .act { text-align: right; white-space: nowrap; }
    .act .btn-ghost { margin-left: 6px; }
    .btn-ghost.sm { padding: 5px 10px; font-size: 12px; text-decoration: none; display: inline-block; }
    .ref { display: block; font-size: 11.5px; color: var(--ink-3); margin-top: 2px; }
    .ref.ok { color: #15803d; }
    .err { display: block; font-size: 11.5px; color: #b42318; margin-top: 2px; max-width: 280px; }
    .flow { display: inline-block; font-size: 10.5px; font-weight: 700; padding: 1px 7px; border-radius: 20px; background: var(--surface-2); color: var(--ink-2); margin-right: 4px; }
    .flow.pre { background: color-mix(in srgb, #0e7490 14%, transparent); color: #0e7490; }
    .pill { display: inline-block; font-size: 11.5px; font-weight: 700; padding: 2px 8px; border-radius: 20px; background: var(--surface-2); color: var(--ink-2); }
    .pill[data-s='sent'], .pill[data-m='sent'], .pill[data-m='accepted'] { background: color-mix(in srgb, #2563eb 14%, transparent); color: #1d4ed8; }
    .pill[data-s='done'], .pill[data-m='read'] { background: color-mix(in srgb, #15803d 16%, transparent); color: #15803d; }
    .pill[data-m='delivered'] { background: color-mix(in srgb, #0e7490 16%, transparent); color: #0e7490; }
    .pill[data-s='failed'], .pill[data-m='failed'] { background: color-mix(in srgb, #dc2626 14%, transparent); color: #b42318; }
    .pill[data-s='scheduled'] { background: color-mix(in srgb, #d97706 14%, transparent); color: #b45309; }
    .muted { color: var(--ink-3); margin: 0; }
    .empty { color: var(--ink-3); padding: 24px 0; max-width: 620px; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  `,
})
export class NotificheWaComponent {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly sellerApi = inject(SellerApiService);

  readonly TASK_STATUS = TASK_STATUS;
  readonly MSG_STATUS = MSG_STATUS;
  readonly statusKeys = Object.keys(TASK_STATUS) as TaskRow['status'][];

  readonly tab = signal<'flussi' | 'messaggi'>('flussi');
  readonly flow = signal('');
  readonly status = signal('');
  readonly sellerId = signal('');
  readonly busy = signal<number | null>(null);

  readonly sellers = rxResource({ stream: () => this.sellerApi.getAll() });
  readonly tasks = rxResource({
    params: () => ({ flow: this.flow(), status: this.status(), sellerId: this.sellerId() }),
    stream: ({ params }) => {
      const p: Record<string, string> = {};
      for (const [k, v] of Object.entries(params)) if (v) p[k] = v;
      return this.http.get<TaskRow[]>(`${API}/seller-tasks`, { params: p });
    },
  });
  readonly rows = computed(() => (this.tasks.hasValue() ? this.tasks.value() : []));
  readonly messages = rxResource({
    params: () => (this.tab() === 'messaggi' ? true : undefined),
    stream: () => this.http.get<MessageRow[]>(`${API}/whatsapp/messages`, { params: { limit: '200' } }),
  });

  val(e: Event) { return (e.target as HTMLSelectElement).value; }

  fmt(iso: string | null) {
    return iso ? new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
  }

  async retry(id: number) {
    this.busy.set(id);
    try {
      await firstValueFrom(this.http.post(`${API}/seller-tasks/${id}/retry`, {}));
      this.toast.success('Rimessa in coda: parte al prossimo giro (entro un minuto, tra le 9 e le 20)');
      this.tasks.reload();
    } catch {
      this.toast.error('Non riuscito. Riprova.');
    } finally {
      this.busy.set(null);
    }
  }
}
