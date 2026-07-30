import { Component, computed, inject, NgZone, signal } from '@angular/core';
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

@Component({
  selector: 'app-ai',
  imports: [IconComponent],
  templateUrl: './ai.component.html',
  styleUrl: './ai.component.css',
})
export class AiComponent {
  private readonly auth = inject(AuthService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly zone = inject(NgZone);

  readonly messages = signal<ChatMessage[]>([]);
  readonly input = signal('');
  readonly loading = signal(false);
  readonly activeToolName = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly canSend = computed(() => this.input().trim().length > 0 && !this.loading());

  readonly toolLabel: Record<string, string> = {
    get_price_plans: 'Carico i piani disponibili…',
    get_sellers: 'Carico la lista venditori…',
    generate_payment_link: 'Genero link di pagamento…',
    get_daily_leads: 'Recupero appuntamenti…',
    get_lead_details: 'Cerco i dettagli del lead…',
    get_commissions: 'Calcolo le provvigioni…',
    get_sales: 'Carico le vendite…',
  };

  formatMessage(text: string): SafeHtml {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const withLinks = escaped.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="chat-link">$1</a>',
    );

    const withPlainLinks = withLinks.replace(
      /(?<![">])(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="chat-link">$1</a>',
    );

    const withLineBreaks = withPlainLinks.replace(/\n/g, '<br>');

    return this.sanitizer.bypassSecurityTrustHtml(withLineBreaks);
  }

  onKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      this.send();
    }
  }

  send(): void {
    const text = this.input().trim();
    if (!text || this.loading()) return;

    this.error.set(null);
    this.messages.update(msgs => [...msgs, { role: 'user', content: text }]);
    this.input.set('');
    this.loading.set(true);
    this.activeToolName.set(null);

    this.streamChat();
  }

  private buildHistory(): ChatMessage[] {
    return this.messages().map(m => ({ role: m.role, content: m.content }));
  }

  private async streamChat(): Promise<void> {
    const token = this.auth.token();
    const body = JSON.stringify({ messages: this.buildHistory() });

    let res: Response;
    try {
      res = await fetch(`${environment.apiUrl}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body,
      });
    } catch (e) {
      this.zone.run(() => {
        this.error.set('Impossibile connettersi al server. Riprova.');
        this.loading.set(false);
      });
      return;
    }

    if (!res.ok) {
      this.zone.run(() => {
        this.error.set(`Errore HTTP ${res.status}. Riprova.`);
        this.loading.set(false);
      });
      return;
    }

    // Add empty assistant message that will be filled in via streaming
    this.zone.run(() => {
      this.messages.update(msgs => [...msgs, { role: 'assistant', content: '', streaming: true }]);
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

            let event: SseEvent;
            try {
              event = JSON.parse(raw) as SseEvent;
            } catch {
              continue;
            }

            this.zone.run(() => this.handleEvent(event));
          }
        }
      }
    } catch {
      // Stream aborted or network error — finalize gracefully
    } finally {
      this.zone.run(() => {
        this.messages.update(msgs => {
          const last = msgs[msgs.length - 1];
          // If the AI message is still empty after stream ends, show a fallback
          if (last?.role === 'assistant' && last.streaming && !last.content) {
            return [...msgs.slice(0, -1), { ...last, content: '_(Nessuna risposta ricevuta — riprova)_', streaming: false }];
          }
          return msgs.map((m, i) =>
            i === msgs.length - 1 && m.streaming ? { ...m, streaming: false } : m,
          );
        });
        this.loading.set(false);
        this.activeToolName.set(null);
      });
    }
  }

  private handleEvent(event: SseEvent): void {
    switch (event.type) {
      case 'token':
        this.messages.update(msgs => {
          const last = msgs[msgs.length - 1];
          if (!last || last.role !== 'assistant') return msgs;
          return [...msgs.slice(0, -1), { ...last, content: last.content + (event.data ?? '') }];
        });
        break;

      case 'tool':
        this.activeToolName.set(event.data ?? null);
        break;

      case 'error':
        this.error.set(event.data ?? 'Errore sconosciuto');
        break;

      case 'done':
        this.activeToolName.set(null);
        break;
    }
  }

  clearChat(): void {
    this.messages.set([]);
    this.error.set(null);
    this.activeToolName.set(null);
  }
}
