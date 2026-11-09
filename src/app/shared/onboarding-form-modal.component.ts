import { Component, ElementRef, computed, effect, input, output, viewChild } from '@angular/core';
import { CustomerDto, OnboardingSubmissionDto } from '../customers/customer-api.service';
import { IconComponent } from './icon.component';

// Academy con form (client titolare): stessi nomi del backend (affiancamento.util.ts)
const ACADEMY_LABELS: Record<number, string> = {
  3: 'UGC Level Up',
  5: 'Social Academy',
  6: 'Travel Academy',
};

const dateIt = (iso: string | null | undefined, withTime = false) =>
  iso
    ? new Date(iso).toLocaleString('it-IT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
        timeZone: 'Europe/Rome',
      })
    : '';

// Form di iscrizione (onboarding) compilato dalla cliente, in sola lettura: stesso aspetto
// del modulo di prenotazione nel drawer della chiamata
@Component({
  selector: 'app-onboarding-form-modal',
  imports: [IconComponent],
  host: { '(keydown.escape)': 'closed.emit()' },
  template: `
    <div class="overlay" (click)="closed.emit()">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="of-title" (click)="$event.stopPropagation()">
        <header class="head">
          <div>
            <p class="eyebrow">Form di iscrizione</p>
            <h2 id="of-title">{{ fullName() }}</h2>
            @if (submission().submittedAt) {
              <p class="when">Compilato il {{ date(submission().submittedAt, true) }}</p>
            }
          </div>
          <button #closeBtn type="button" class="close" aria-label="Chiudi" (click)="closed.emit()">
            <app-icon name="x" [size]="16" />
          </button>
        </header>

        <div class="body">
          @for (f of fields(); track f.label) {
            <div class="field">
              <span class="label">{{ f.label }}</span>
              <div class="value">{{ f.value || '—' }}</div>
            </div>
          }

          @if (academyOrder().length) {
            <div class="field">
              <span class="label">Ordine dei percorsi</span>
              <ol class="order">
                @for (a of academyOrder(); track a) { <li>{{ a }}</li> }
              </ol>
            </div>
          }

          <div class="confirm" [class.no]="!submission().termsAccepted">
            <span class="box" aria-hidden="true">@if (submission().termsAccepted) { ✓ }</span>
            <span>Ha accettato termini e condizioni</span>
          </div>

          <p class="note">Indirizzo e codice fiscale sono quelli salvati sulla scheda cliente: se sono stati corretti dopo, qui vedi la versione aggiornata.</p>
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
      width: 100%; max-width: 560px; max-height: 100%; display: flex; flex-direction: column;
      background: var(--surface); color: var(--ink); border-radius: 16px; border-top: 4px solid var(--accent);
      box-shadow: 0 24px 64px rgba(0, 0, 0, .22); overflow: hidden;
    }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 18px 22px 14px; border-bottom: 1px solid var(--border); }
    .eyebrow { margin: 0 0 2px; font-size: 12px; font-weight: 700; color: var(--accent); text-transform: uppercase; letter-spacing: .04em; }
    h2 { margin: 0; font-size: 1.15rem; font-weight: 800; }
    .when { margin: 3px 0 0; font-size: 12.5px; color: var(--ink-3); }
    .close { width: 32px; height: 32px; border-radius: 9px; border: 1px solid var(--border); background: var(--surface); color: var(--ink-2); display: grid; place-items: center; flex-shrink: 0; cursor: pointer; }
    .close:hover { color: var(--ink); }
    .close:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    .body { padding: 18px 22px 22px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
    .field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .label { font-size: 13px; font-weight: 700; color: var(--ink-2); }
    .value {
      padding: 10px 12px; border: 1.5px solid var(--border); border-radius: 10px; background: var(--surface-2);
      font-size: 14.5px; line-height: 1.5; word-break: break-word;
    }
    .order { margin: 0; padding: 10px 12px 10px 32px; border: 1.5px solid var(--border); border-radius: 10px; background: var(--surface-2); font-size: 14.5px; line-height: 1.7; }
    .confirm { display: flex; gap: 10px; align-items: flex-start; font-size: 13.5px; line-height: 1.5; color: var(--ink-2); }
    .box {
      width: 18px; height: 18px; border-radius: 5px; flex-shrink: 0; margin-top: 1px; display: grid; place-items: center;
      background: var(--accent); color: #fff; font-size: 12px; font-weight: 800;
    }
    .confirm.no .box { background: transparent; border: 2px solid var(--border); }
    .note { margin: 2px 0 0; padding-top: 12px; border-top: 1px solid var(--border); font-size: 12.5px; color: var(--ink-3); line-height: 1.5; }
  `],
})
export class OnboardingFormModalComponent {
  readonly customer = input.required<CustomerDto>();
  readonly submission = input.required<OnboardingSubmissionDto>();
  readonly closed = output<void>();

  private readonly closeBtn = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');

  readonly date = dateIt;
  readonly fullName = computed(() => [this.customer().name, this.customer().surname].filter(Boolean).join(' ') || 'Cliente');

  /** Campi nell'ordine del form */
  readonly fields = computed(() => {
    const c = this.customer();
    const s = this.submission();
    return [
      { label: 'Nome e cognome', value: this.fullName() },
      { label: 'Codice fiscale', value: c.codiceFiscale },
      { label: 'Indirizzo', value: c.address },
      { label: 'Città', value: c.city },
      { label: 'Provincia', value: c.province },
      { label: 'CAP', value: c.cap },
      { label: 'WhatsApp', value: s.whatsapp || c.phone },
      { label: 'Email per la fattura', value: s.billingEmail || c.email },
      ...(c.startDate ? [{ label: 'Data di inizio', value: dateIt(c.startDate) }] : []),
    ];
  });

  readonly academyOrder = computed(() =>
    (this.submission().academyOrder ?? []).map(id => ACADEMY_LABELS[Number(id)] ?? `Percorso ${id}`),
  );

  constructor() {
    effect(() => this.closeBtn()?.nativeElement.focus());
  }
}
