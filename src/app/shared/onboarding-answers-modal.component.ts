import { Component, ElementRef, computed, effect, inject, input, output, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { BookingApiService } from '../booking/booking-api.service';
import { AuthService } from '../auth/auth.service';
import { IconComponent } from './icon.component';
import { parseOnboarding } from './onboarding-answers';

// Modulo di prenotazione compilato dalla persona, in sola lettura
@Component({
  selector: 'app-onboarding-answers-modal',
  imports: [IconComponent],
  host: { '(keydown.escape)': 'onEscape($event)' },
  template: `
    <div class="overlay" (click)="closed.emit()">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="ob-title" [style.--brand]="brand()" (click)="$event.stopPropagation()">
        <header class="head">
          <div>
            <p class="eyebrow">{{ academy() || 'Modulo di prenotazione' }}</p>
            <h2 id="ob-title">{{ name() }}</h2>
          </div>
          <button #closeBtn type="button" class="close" aria-label="Chiudi" (click)="closed.emit()">
            <app-icon name="x" [size]="16" />
          </button>
        </header>

        <div class="body">
          @if (parsed().meetUrl) {
            <a class="meet" [href]="parsed().meetUrl" target="_blank" rel="noopener">
              <app-icon name="video" [size]="15" /> Apri Google Meet
            </a>
          }

          @for (a of parsed().answers; track $index) {
            @let q = a.question;
            @if (q?.type === 'confirm') {
              <div class="confirm" [class.no]="!isYes(a.value)">
                <span class="box" aria-hidden="true">@if (isYes(a.value)) { ✓ }</span>
                <span>{{ q!.label }}</span>
              </div>
            } @else if ((q?.type === 'radio' || q?.type === 'select') && q!.options?.length) {
              <fieldset class="field">
                <legend>{{ q!.label }}</legend>
                <div class="options">
                  @for (o of q!.options; track o) {
                    <div class="option" [class.on]="sameOption(o, a.value)">
                      <span class="dot" aria-hidden="true"></span>
                      <span>{{ o }}</span>
                      @if (sameOption(o, a.value)) { <span class="sr-only">(risposta scelta)</span> }
                    </div>
                  }
                  @if (!hasOption(q!.options!, a.value)) {
                    <div class="option on"><span class="dot" aria-hidden="true"></span><span>{{ a.value }}</span></div>
                  }
                </div>
              </fieldset>
            } @else {
              <div class="field">
                <span class="label">{{ q?.label ?? a.label }}</span>
                <div class="value" [class.long]="a.value.length > 60 || a.value.includes('\\n')">{{ a.value || '—' }}</div>
              </div>
            }
          } @empty {
            <p class="empty">Nessuna risposta al modulo per questo lead.</p>
          }

          @if (parsed().info.length) {
            <ul class="info">
              @for (i of parsed().info; track $index) { <li>{{ i }}</li> }
            </ul>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .overlay {
      position: fixed; inset: 0; z-index: 1100; background: rgba(15, 14, 20, .5);
      display: flex; align-items: center; justify-content: center;
      padding: calc(env(safe-area-inset-top, 0px) + 16px) 16px calc(env(safe-area-inset-bottom, 0px) + 16px);
    }
    .modal {
      --brand: var(--accent);
      --brand-soft: color-mix(in srgb, var(--brand) 10%, var(--surface));
      width: 100%; max-width: 620px; max-height: 100%; display: flex; flex-direction: column;
      background: var(--surface); color: var(--ink); border-radius: 16px; border-top: 4px solid var(--brand);
      box-shadow: 0 24px 64px rgba(0, 0, 0, .22); overflow: hidden;
    }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 18px 22px 14px; border-bottom: 1px solid var(--border); }
    .eyebrow { margin: 0 0 2px; font-size: 12px; font-weight: 700; color: var(--brand); text-transform: uppercase; letter-spacing: .04em; }
    h2 { margin: 0; font-size: 1.15rem; font-weight: 800; }
    .close { width: 32px; height: 32px; border-radius: 9px; border: 1px solid var(--border); background: var(--surface); color: var(--ink-2); display: grid; place-items: center; flex-shrink: 0; }
    .close:hover { color: var(--ink); }
    .body { padding: 18px 22px 22px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
    .meet {
      align-self: flex-start; display: inline-flex; align-items: center; gap: 7px; padding: 9px 14px; border-radius: 10px;
      background: var(--brand); color: #fff; font-weight: 700; font-size: 13.5px; text-decoration: none;
    }
    .field { display: flex; flex-direction: column; gap: 6px; border: none; padding: 0; margin: 0; min-width: 0; }
    .label, legend { font-size: 13px; font-weight: 700; color: var(--ink-2); line-height: 1.45; padding: 0; }
    legend { margin-bottom: 6px; }
    .value {
      padding: 10px 12px; border: 1.5px solid var(--border); border-radius: 10px; background: var(--surface-2);
      font-size: 14.5px; line-height: 1.5; white-space: pre-wrap; word-break: break-word;
    }
    .value.long { min-height: 64px; }
    .options { display: flex; flex-direction: column; gap: 6px; }
    .option {
      display: flex; align-items: center; gap: 10px; padding: 9px 12px; border: 1.5px solid var(--border);
      border-radius: 10px; font-size: 14px; color: var(--ink-3);
    }
    .option.on { border-color: var(--brand); background: var(--brand-soft); color: var(--ink); font-weight: 700; }
    .dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--border); flex-shrink: 0; }
    .option.on .dot { border-color: var(--brand); background: radial-gradient(var(--brand) 0 45%, transparent 50%); }
    .confirm { display: flex; gap: 10px; align-items: flex-start; font-size: 13.5px; line-height: 1.5; color: var(--ink-2); }
    .box {
      width: 18px; height: 18px; border-radius: 5px; flex-shrink: 0; margin-top: 1px; display: grid; place-items: center;
      background: var(--brand); color: #fff; font-size: 12px; font-weight: 800;
    }
    .confirm.no .box { background: transparent; border: 2px solid var(--border); }
    .empty { color: var(--ink-3); font-size: 14px; margin: 0; }
    .info { margin: 4px 0 0; padding: 12px 0 0; border-top: 1px solid var(--border); list-style: none; display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; color: var(--ink-3); }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  `],
})
export class OnboardingAnswersModalComponent {
  private readonly bookingApi = inject(BookingApiService);
  private readonly auth = inject(AuthService);

  readonly notes = input<string | null>(null);
  readonly name = input('');
  readonly academy = input('');
  readonly clientId = input<number | null | undefined>(null);
  readonly closed = output<void>();

  private readonly closeBtn = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');

  // Domande del modulo dell'academy (non disponibili all'area cliente: si mostrano le righe così come sono)
  private readonly settingsResource = rxResource({
    params: () => (this.auth.currentUser()?.role === 'client' ? undefined : true),
    stream: () => this.bookingApi.settings().pipe(catchError(() => of([]))),
  });

  private readonly settings = computed(() => {
    const id = Number(this.clientId());
    return (this.settingsResource.value() ?? []).find(s => Number(s.client.id) === id) ?? null;
  });

  readonly brand = computed(() => this.settings()?.brand?.color ?? 'var(--accent)');
  readonly parsed = computed(() => parseOnboarding(this.notes(), this.settings()?.questions ?? []));

  constructor() {
    effect(() => this.closeBtn()?.nativeElement.focus());
  }

  onEscape(e: Event): void {
    // chiude solo la modale, non il drawer sotto
    e.stopPropagation();
    this.closed.emit();
  }

  isYes(v: string): boolean {
    return /^(s[iì]|true|acconsento|sar[oò] puntuale)/i.test(v.trim());
  }

  private clean(s: string): string {
    return s.toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').trim();
  }

  sameOption(option: string, value: string): boolean {
    return this.clean(option) === this.clean(value);
  }

  hasOption(options: string[], value: string): boolean {
    return options.some(o => this.sameOption(o, value));
  }
}
