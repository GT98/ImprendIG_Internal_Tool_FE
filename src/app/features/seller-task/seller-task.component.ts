import { Component, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../../environments/environment';

interface TaskMessage {
  label: string;
  text: string;
}

interface SellerTaskView {
  kind: string;
  title: string;
  note: string | null;
  status: 'scheduled' | 'sent' | 'done' | 'cancelled' | 'failed';
  flags: Record<string, boolean>;
  sellerName: string;
  contactName: string;
  contactPhone: string | null;
  wheelImageUrl: string | null;
  messages: TaskMessage[];
}

/**
 * Pagina aperta dal pulsante della notifica WhatsApp alla venditrice (/w/:token):
 * cosa fare, i messaggi pronti (modificabili) e il link che apre la chat con la persona.
 * Se c'è un solo messaggio e nessun consiglio (es. sblocco rata) apre subito la chat, una volta sola.
 */
@Component({
  selector: 'app-seller-task',
  template: `
    <main class="page">
      @if (task.isLoading() && !task.hasValue()) {
        <p class="muted">Carico…</p>
      } @else if (task.error()) {
        <div class="empty">
          <h1>Link non valido</h1>
          <p>Questo link non esiste più. Se ti serve, chiedi in amministrazione.</p>
        </div>
      } @else if (task.hasValue()) {
        @let t = task.value();
        @if (autoOpened()) {
          <p class="opened" role="status">Ti ho aperto la chat con {{ firstName(t.contactName) }}. Se non si è aperta, usa il pulsante qui sotto.</p>
        }
        <header class="head">
          <span class="eyebrow">Per {{ t.sellerName }}</span>
          <h1>{{ t.title }}</h1>
          <p class="who">Con <strong>{{ t.contactName }}</strong></p>
        </header>

        @if (t.note) {
          <section class="note" aria-label="Cosa fare">
            <h2>Cosa fare</h2>
            <p>{{ t.note }}</p>
          </section>
        }

        @if (t.wheelImageUrl) {
          <section class="wheel">
            <img [src]="t.wheelImageUrl" alt="Ruota di autovalutazione da inviare" />
            <a class="btn-ghost" [href]="t.wheelImageUrl" target="_blank" rel="noopener">Apri l'immagine per salvarla</a>
          </section>
        }

        @for (m of t.messages; track $index; let i = $index) {
          <section class="msg">
            <label [for]="'msg-' + i">{{ m.label }}</label>
            <textarea [id]="'msg-' + i" rows="10" [value]="textOf(i, m.text)"
                      (input)="edit(i, $any($event.target).value)"></textarea>
            <div class="actions">
              @if (t.contactPhone) {
                <a class="btn-wa" [href]="waUrl(t.contactPhone, textOf(i, m.text))" target="_blank" rel="noopener">
                  Apri WhatsApp con {{ firstName(t.contactName) }}
                </a>
              }
              <button type="button" class="btn-ghost" (click)="copy(i, textOf(i, m.text))">
                {{ copied() === i ? 'Copiato' : 'Copia' }}
              </button>
            </div>
          </section>
        }
        @if (!t.contactPhone && t.messages.length) {
          <p class="muted">Non abbiamo il numero di {{ firstName(t.contactName) }}: copia il messaggio e incollalo nella sua chat.</p>
        }

        <footer class="foot">
          @if (videoStep()) {
            <button type="button" class="btn-ghost" [disabled]="videoSeen()" (click)="markVideo()">
              {{ videoSeen() ? 'Video visto: niente follow-up' : 'Ha visto il video' }}
            </button>
          }
          <button type="button" class="btn-primary" [disabled]="done()" (click)="markDone()">
            {{ done() ? 'Fatto' : 'Segna come fatto' }}
          </button>
        </footer>
        @if (actionError()) {
          <p class="error" role="alert">{{ actionError() }}</p>
        }
      }
    </main>
  `,
  styles: `
    :host {
      --bg: #f6f7f6; --surface: #fff; --ink: #18201c; --ink-2: #4c5852; --line: #dfe4e1;
      --wa: #128c4a; --wa-ink: #fff; --accent: #1f2a25; --soft: #eef3f0;
      display: block; min-height: 100%; background: var(--bg); color: var(--ink);
      font: 15px/1.55 system-ui, -apple-system, 'Segoe UI', sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      :host {
        --bg: #111614; --surface: #19201c; --ink: #e6ece8; --ink-2: #a3b0a9; --line: #2b3530;
        --wa: #25a35f; --accent: #e6ece8; --soft: #1f2a25;
      }
    }
    .page { max-width: 560px; margin: 0 auto; padding: 24px 16px 40px; display: flex; flex-direction: column; gap: 16px; }
    .head { display: flex; flex-direction: column; gap: 4px; }
    .eyebrow { font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-2); font-weight: 600; }
    h1 { margin: 0; font-size: 22px; line-height: 1.25; text-wrap: balance; }
    .who { margin: 0; color: var(--ink-2); }
    .note { background: var(--soft); border-radius: 12px; padding: 14px 16px; }
    .note h2 { margin: 0 0 6px; font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-2); }
    .note p { margin: 0; white-space: pre-line; }
    .wheel { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
    .wheel img { max-width: 100%; border-radius: 10px; border: 1px solid var(--line); }
    .msg { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
    .msg label { font-weight: 600; font-size: 14px; }
    textarea {
      width: 100%; box-sizing: border-box; font: inherit; color: var(--ink); background: var(--bg);
      border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; resize: vertical; min-height: 120px;
    }
    textarea:focus-visible, a:focus-visible, button:focus-visible { outline: 2px solid var(--wa); outline-offset: 2px; }
    .actions, .foot { display: flex; gap: 8px; flex-wrap: wrap; }
    .btn-wa, .btn-primary, .btn-ghost {
      display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 16px;
      border-radius: 10px; font: inherit; font-weight: 600; text-decoration: none; cursor: pointer; border: 1px solid transparent;
    }
    .btn-wa { background: var(--wa); color: var(--wa-ink); flex: 1 1 220px; }
    .btn-primary { background: var(--accent); color: var(--bg); flex: 1 1 200px; }
    .btn-ghost { background: transparent; color: var(--ink); border-color: var(--line); }
    button:disabled { opacity: .6; cursor: default; }
    .foot { padding-top: 4px; }
    .opened { margin: 0; background: var(--soft); border-radius: 10px; padding: 10px 14px; font-size: 14px; }
    .muted { color: var(--ink-2); margin: 0; }
    .error { color: #b42318; margin: 0; }
    .empty { padding-top: 40px; display: flex; flex-direction: column; gap: 8px; }
  `,
})
export class SellerTaskComponent {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/public/seller-tasks`;

  private readonly route = inject(ActivatedRoute);
  readonly token = signal(this.route.snapshot.paramMap.get('token') ?? '');

  readonly task = rxResource({
    params: () => this.token(),
    stream: ({ params }) => this.http.get<SellerTaskView>(`${this.base}/${params}`),
  });

  private readonly edits = signal<Record<number, string>>({});
  readonly copied = signal<number | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly autoOpened = signal(false);
  private readonly doneNow = signal(false);
  private readonly videoNow = signal(false);

  readonly done = computed(
    () => this.doneNow() || (this.task.hasValue() && this.task.value().status === 'done'),
  );
  readonly videoStep = computed(
    () => this.task.hasValue() && ['pre_riepilogo', 'pre_followup'].includes(this.task.value().kind),
  );
  readonly videoSeen = computed(
    () => this.videoNow() || (this.task.hasValue() && Boolean(this.task.value().flags['videoSeen'])),
  );

  constructor() {
    effect(() => {
      if (!this.task.hasValue()) return;
      const t = this.task.value();
      const direct = t.messages.length === 1 && !t.note && !t.wheelImageUrl && t.contactPhone;
      if (!direct || t.status === 'done' || t.status === 'cancelled') return;
      // tornando indietro alla pagina non deve riaprire la chat
      const key = `wa-open-${this.token()}`;
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, '1');
      } catch {
        // storage non disponibile: apre comunque
      }
      this.autoOpened.set(true);
      window.location.href = this.waUrl(t.contactPhone!, t.messages[0].text);
    });
  }

  textOf(i: number, original: string): string {
    return this.edits()[i] ?? original;
  }

  edit(i: number, text: string): void {
    this.edits.update(e => ({ ...e, [i]: text }));
  }

  firstName(full: string): string {
    return full.trim().split(/\s+/)[0] || full;
  }

  waUrl(phone: string, text: string): string {
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }

  async copy(i: number, text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(i);
      setTimeout(() => this.copied.set(null), 2000);
    } catch {
      this.actionError.set('Non riesco a copiare: tieni premuto sul testo e copialo a mano.');
    }
  }

  markDone(): void {
    this.post('done', () => this.doneNow.set(true));
  }

  markVideo(): void {
    this.post('video-seen', () => this.videoNow.set(true));
  }

  private post(action: string, ok: () => void): void {
    this.actionError.set(null);
    this.http.post(`${this.base}/${this.token()}/${action}`, {}).subscribe({
      next: ok,
      error: () => this.actionError.set('Salvataggio non riuscito: controlla la connessione e riprova.'),
    });
  }
}
