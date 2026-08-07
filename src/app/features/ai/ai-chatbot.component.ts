import { Component, computed, ElementRef, inject, NgZone, signal, ViewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../auth/auth.service';
import { environment } from '../../../environments/environment';
import { IconComponent } from '../../shared/icon.component';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

interface SseEvent {
  type: 'token' | 'tool' | 'done' | 'error';
  data?: string;
}

const TOOL_LABELS: Record<string, string> = {
  get_price_plans: 'Carico i piani disponibili…',
  get_sellers: 'Carico la lista venditori…',
  generate_payment_link: 'Genero link di pagamento…',
  get_daily_leads: 'Recupero appuntamenti…',
  get_lead_details: 'Cerco i dettagli del lead…',
  get_commissions: 'Calcolo le provvigioni…',
  get_sales: 'Carico le vendite…',
};

const SUGGESTIONS = [
  { label: 'Piani disponibili', prompt: 'Quali piani di pagamento abbiamo disponibili?' },
  { label: 'Appuntamenti oggi', prompt: 'Mostrami gli appuntamenti di oggi' },
  { label: 'Genera link pagamento', prompt: 'Genera un link di pagamento Stripe' },
  { label: 'Ultime vendite', prompt: 'Mostrami le ultime vendite' },
];

@Component({
  selector: 'app-ai-chatbot',
  imports: [IconComponent],
  styles: [`
    .fab {
      position: fixed; bottom: 24px; right: 24px; z-index: 300;
      width: 52px; height: 52px; border-radius: 50%;
      background: var(--accent); color: #fff;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 20px color-mix(in srgb, var(--accent) 42%, transparent);
      border: none; cursor: pointer;
      transition: transform .15s, box-shadow .15s;
    }
    .fab:hover { transform: scale(1.07); box-shadow: 0 6px 26px color-mix(in srgb, var(--accent) 52%, transparent); }

    /* mobile nav offset */
    @media (max-width: 768px) { .fab { bottom: 72px; right: 14px; } }

    .panel {
      position: fixed; bottom: 90px; right: 24px; z-index: 299;
      width: 380px; height: 540px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 18px; box-shadow: var(--shadow-lg);
      display: flex; flex-direction: column; overflow: hidden;
      animation: chatUp .22s cubic-bezier(.2,.7,.3,1);
    }
    @keyframes chatUp { from { transform: translateY(16px); opacity: .4; } }

    /* full-screen on mobile */
    @media (max-width: 640px) {
      .panel { position: fixed; inset: 0; width: 100%; height: 100%; border-radius: 0; bottom: 0; right: 0; }
    }
    @media (max-width: 768px) { .panel { bottom: 134px; } }

    /* panel header */
    .panel-head {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 16px; border-bottom: 1px solid var(--border);
      background: var(--surface); flex-shrink: 0;
    }
    .panel-head-icon {
      width: 30px; height: 30px; border-radius: 9px;
      background: var(--accent-soft); color: var(--accent);
      display: grid; place-items: center; flex-shrink: 0;
    }
    .panel-head-title { font-weight: 800; font-size: 14px; flex: 1; }
    .panel-head-sub { font-size: 11px; color: var(--ink-3); }

    /* messages area */
    .messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 12px;
    }

    /* empty state */
    .empty-state {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      text-align: center; gap: 10px; padding: 24px;
    }
    .empty-icon {
      width: 52px; height: 52px; border-radius: 14px;
      background: var(--accent-soft); color: var(--accent);
      display: grid; place-items: center; margin-bottom: 4px;
    }
    .empty-title { font-size: 15px; font-weight: 800; letter-spacing: -.01em; }
    .empty-desc { font-size: 12.5px; color: var(--ink-3); line-height: 1.5; max-width: 280px; }
    .suggestions { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 6px; }
    .sugg-chip {
      padding: 6px 12px; border-radius: 20px; border: 1px solid var(--border);
      background: var(--surface); font-size: 12px; color: var(--ink-2);
      cursor: pointer; transition: .13s; font-family: inherit;
    }
    .sugg-chip:hover { border-color: var(--accent-soft-2); color: var(--accent); background: var(--accent-soft); }

    /* message rows */
    .msg-row { display: flex; align-items: flex-start; gap: 8px; }
    .msg-row--user { flex-direction: row-reverse; }
    .msg-avatar {
      width: 26px; height: 26px; border-radius: 50%;
      background: var(--accent-soft); color: var(--accent);
      display: grid; place-items: center; flex-shrink: 0; margin-top: 2px;
    }
    .bubble {
      max-width: 80%; padding: 10px 13px; border-radius: 14px;
      font-size: 13px; line-height: 1.55; white-space: pre-wrap; word-break: break-word;
    }
    .bubble--user { background: var(--accent); color: #fff; border-bottom-right-radius: 4px; }
    .bubble--ai {
      background: var(--surface-2); border: 1px solid var(--border);
      color: var(--ink); border-bottom-left-radius: 4px;
    }

    /* typing + tool */
    .typing { display: inline-flex; gap: 4px; align-items: center; height: 1em; }
    .typing span {
      width: 5px; height: 5px; border-radius: 50%;
      background: var(--ink-3); animation: bounce 1.2s ease-in-out infinite;
    }
    .typing span:nth-child(2) { animation-delay: .2s; }
    .typing span:nth-child(3) { animation-delay: .4s; }
    @keyframes bounce { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-5px); } }
    .tool-status { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: var(--ink-3); }
    .tool-spinner {
      width: 12px; height: 12px; border-radius: 50%;
      border: 2px solid var(--border); border-top-color: var(--accent);
      animation: spin .7s linear infinite; flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* error */
    .chat-error {
      display: flex; align-items: center; gap: 8px; padding: 9px 12px;
      border-radius: 9px; background: #fef2f2; border: 1px solid #fca5a5;
      color: #dc2626; font-size: 12px; margin-top: 4px;
    }

    /* input bar */
    .input-bar {
      display: flex; align-items: flex-end; gap: 8px;
      padding: 12px 14px; border-top: 1px solid var(--border);
      background: var(--surface); flex-shrink: 0;
    }
    .chat-textarea {
      flex: 1; resize: none; border: 1px solid var(--border); border-radius: 10px;
      padding: 9px 12px; font-size: 13px; font-family: inherit;
      color: var(--ink); background: var(--surface-2);
      line-height: 1.5; min-height: 40px; max-height: 120px;
      overflow-y: auto; outline: none; transition: border-color .12s;
      field-sizing: content;
    }
    .chat-textarea:focus { border-color: var(--accent); background: #fff; }
    .chat-textarea:disabled { opacity: .6; cursor: not-allowed; }
    .send-btn {
      width: 40px; height: 40px; border-radius: 10px; border: none;
      background: var(--accent); color: #fff;
      display: grid; place-items: center; cursor: pointer; flex-shrink: 0;
      transition: opacity .15s;
    }
    .send-btn:disabled { opacity: .4; cursor: not-allowed; }
    .send-btn:not(:disabled):hover { filter: brightness(1.08); }
    .send-spinner {
      width: 16px; height: 16px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.35); border-top-color: #fff;
      animation: spin .7s linear infinite;
    }

    /* links inside AI messages */
    :global(.chat-link) { color: var(--accent); text-decoration: underline; word-break: break-all; }
  `],
  template: `
    <!-- Panel -->
    @if (open()) {
      <div class="panel" role="dialog" aria-modal="false" aria-label="AI Assistant">
        <!-- Header -->
        <div class="panel-head">
          <div class="panel-head-icon"><app-icon name="zap" [size]="15" /></div>
          <div>
            <div class="panel-head-title">AI Assistant</div>
            <div class="panel-head-sub">Alimentato da Claude</div>
          </div>
          @if (messages().length > 0) {
            <button class="icon-btn" style="width:30px;height:30px;margin-left:auto" (click)="clear()" aria-label="Nuova chat">
              <app-icon name="plus" [size]="15" />
            </button>
          }
          <button class="icon-btn" style="width:30px;height:30px" (click)="close()" aria-label="Chiudi">
            <app-icon name="x" [size]="17" />
          </button>
        </div>

        <!-- Messages -->
        <div class="messages" #scrollArea aria-live="polite">
          @if (messages().length === 0) {
            <div class="empty-state">
              <div class="empty-icon"><app-icon name="zap" [size]="22" /></div>
              <div class="empty-title">Come posso aiutarti?</div>
              <p class="empty-desc">Chiedi di piani, appuntamenti, provvigioni, link di pagamento e molto altro.</p>
              <div class="suggestions">
                @for (s of suggestions; track s.label) {
                  <button class="sugg-chip" (click)="sendPrompt(s.prompt)">{{ s.label }}</button>
                }
              </div>
            </div>
          }

          @for (msg of messages(); track $index) {
            <div class="msg-row" [class.msg-row--user]="msg.role === 'user'">
              @if (msg.role === 'assistant') {
                <div class="msg-avatar" aria-hidden="true"><app-icon name="zap" [size]="12" /></div>
              }
              <div class="bubble" [class.bubble--user]="msg.role === 'user'" [class.bubble--ai]="msg.role === 'assistant'">
                @if (msg.role === 'user') {
                  {{ msg.content }}
                } @else {
                  @if (msg.content) { <span [innerHTML]="format(msg.content)"></span> }
                  @if (msg.streaming && !msg.content) {
                    @if (activeTool()) {
                      <span class="tool-status" role="status">
                        <span class="tool-spinner"></span>{{ toolLabel[activeTool()!] ?? activeTool() }}
                      </span>
                    } @else {
                      <span class="typing" aria-label="Sto scrivendo"><span></span><span></span><span></span></span>
                    }
                  }
                }
              </div>
            </div>
          }

          @if (error()) {
            <div class="chat-error" role="alert"><app-icon name="alertTriangle" [size]="14" />{{ error() }}</div>
          }
        </div>

        <!-- Input -->
        <div class="input-bar">
          <textarea
            class="chat-textarea"
            [value]="inputText()"
            (input)="inputText.set($any($event.target).value)"
            (keydown)="onKeydown($event)"
            placeholder="Scrivi… (⌘+Invio)"
            rows="1"
            [disabled]="loading()"
            aria-label="Messaggio"
          ></textarea>
          <button class="send-btn" (click)="send()" [disabled]="!canSend()" aria-label="Invia">
            @if (loading()) { <span class="send-spinner"></span> }
            @else { <app-icon name="send" [size]="16" /> }
          </button>
        </div>
      </div>
    }

    <!-- FAB -->
    <button class="fab" (click)="toggle()" [attr.aria-label]="open() ? 'Chiudi AI' : 'Apri AI Assistant'" [attr.aria-expanded]="open()">
      @if (open()) { <app-icon name="x" [size]="20" /> }
      @else { <app-icon name="zap" [size]="20" /> }
    </button>
  `,
})
export class AiChatbotComponent {
  private readonly auth = inject(AuthService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly zone = inject(NgZone);

  @ViewChild('scrollArea') private scrollArea?: ElementRef<HTMLElement>;

  readonly open = signal(false);
  readonly messages = signal<ChatMessage[]>([]);
  readonly inputText = signal('');
  readonly loading = signal(false);
  readonly activeTool = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly canSend = computed(() => this.inputText().trim().length > 0 && !this.loading());
  readonly suggestions = SUGGESTIONS;
  readonly toolLabel = TOOL_LABELS;

  toggle(): void { this.open.update(v => !v); }
  close(): void { this.open.set(false); }

  clear(): void {
    this.messages.set([]);
    this.error.set(null);
    this.activeTool.set(null);
  }

  format(text: string): SafeHtml {
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const withLinks = escaped.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="chat-link">$1</a>',
    );
    const withPlain = withLinks.replace(
      /(?<![">])(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="chat-link">$1</a>',
    );
    return this.sanitizer.bypassSecurityTrustHtml(withPlain.replace(/\n/g, '<br>'));
  }

  onKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      this.send();
    }
  }

  sendPrompt(prompt: string): void {
    this.inputText.set(prompt);
    this.send();
  }

  send(): void {
    const text = this.inputText().trim();
    if (!text || this.loading()) return;
    this.error.set(null);
    this.messages.update(m => [...m, { role: 'user', content: text }]);
    this.inputText.set('');
    this.loading.set(true);
    this.activeTool.set(null);
    this.stream();
  }

  private buildHistory(): ChatMessage[] {
    return this.messages().map(m => ({ role: m.role, content: m.content }));
  }

  private scrollToBottom(): void {
    const el = this.scrollArea?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  private async stream(): Promise<void> {
    const token = this.auth.token();
    let res: Response;
    try {
      res = await fetch(`${environment.apiUrl}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: this.buildHistory() }),
      });
    } catch {
      this.zone.run(() => { this.error.set('Impossibile connettersi al server.'); this.loading.set(false); });
      return;
    }

    if (!res.ok) {
      this.zone.run(() => { this.error.set(`Errore HTTP ${res.status}.`); this.loading.set(false); });
      return;
    }

    this.zone.run(() => {
      this.messages.update(m => [...m, { role: 'assistant', content: '', streaming: true }]);
      this.scrollToBottom();
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';
        for (const block of blocks) {
          for (const line of block.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;
            let evt: SseEvent;
            try { evt = JSON.parse(raw) as SseEvent; } catch { continue; }
            this.zone.run(() => { this.handleEvent(evt); this.scrollToBottom(); });
          }
        }
      }
    } catch { /* network error — finalize gracefully */ }
    finally {
      this.zone.run(() => {
        this.messages.update(msgs => {
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant' && last.streaming && !last.content) {
            return [...msgs.slice(0, -1), { ...last, content: '_(Nessuna risposta — riprova)_', streaming: false }];
          }
          return msgs.map((m, i) => i === msgs.length - 1 && m.streaming ? { ...m, streaming: false } : m);
        });
        this.loading.set(false);
        this.activeTool.set(null);
        this.scrollToBottom();
      });
    }
  }

  private handleEvent(evt: SseEvent): void {
    switch (evt.type) {
      case 'token':
        this.messages.update(msgs => {
          const last = msgs[msgs.length - 1];
          if (!last || last.role !== 'assistant') return msgs;
          return [...msgs.slice(0, -1), { ...last, content: last.content + (evt.data ?? '') }];
        });
        break;
      case 'tool': this.activeTool.set(evt.data ?? null); break;
      case 'error': this.error.set(evt.data ?? 'Errore sconosciuto'); break;
      case 'done': this.activeTool.set(null); break;
    }
  }
}
