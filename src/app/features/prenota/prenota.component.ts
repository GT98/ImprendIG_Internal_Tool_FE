import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PublicBookingApiService, PublicBookingSettings } from '../../booking/booking-api.service';
import { addDays, romeDate, romeLabel } from '../../booking/rome-time';
import { SlotPickerComponent } from './slot-picker.component';
import { Attribution, captureAttribution } from './booking-attribution';

type Step = 'loading' | 'pick' | 'form' | 'done' | 'error';

// Pagina pubblica di prenotazione, una per academy: /prenota/:academy?ref=<setter>
@Component({
  selector: 'app-prenota',
  imports: [SlotPickerComponent],
  styleUrl: './prenota.component.css',
  template: `
    <div class="wrap" [style.--brand]="brand()">
      <main class="card">
        <header class="head">
          @if (settings()?.brand?.logoUrl) {
            <img class="logo" [src]="settings()!.brand.logoUrl" alt="" />
          }
          <div>
            <h1>{{ settings()?.title ?? 'Prenota una call' }}</h1>
            @if (settings(); as s) {
              <p class="meta">
                <span>{{ s.durationMin }} minuti</span>
                <span aria-hidden="true">·</span>
                <span>Videochiamata</span>
              </p>
              @if (s.brand.subtitle) {
                <p class="sub">{{ s.brand.subtitle }}</p>
              }
            }
          </div>
        </header>

        @switch (step()) {
          @case ('loading') {
            <p class="state">Caricamento degli orari disponibili…</p>
          }

          @case ('error') {
            <div class="state">
              <p class="state-title">Pagina non disponibile</p>
              <p>{{ errorMsg() }}</p>
            </div>
          }

          @case ('pick') {
            @if (notice()) {
              <p class="notice" role="status">{{ notice() }}</p>
            }
            <app-slot-picker [slots]="slots()" (picked)="selectSlot($event)" />
          }

          @case ('form') {
            <div class="chosen">
              <div>
                <span class="chosen-label">Hai scelto</span>
                <strong>{{ label(selectedSlot()!) }}</strong>
              </div>
              <button type="button" class="link-btn" (click)="backToPick()">Cambia orario</button>
            </div>

            <form class="form" (submit)="$event.preventDefault(); submit()" novalidate>
              <div class="row2">
                <label class="field">
                  <span>Nome *</span>
                  <input type="text" autocomplete="given-name" [value]="name()" (input)="name.set(val($event))" [class.invalid]="tried() && !name().trim()" />
                </label>
                <label class="field">
                  <span>Cognome *</span>
                  <input type="text" autocomplete="family-name" [value]="surname()" (input)="surname.set(val($event))" [class.invalid]="tried() && !surname().trim()" />
                </label>
              </div>
              <div class="row2">
                <label class="field">
                  <span>Email *</span>
                  <input type="email" autocomplete="email" [value]="email()" (input)="email.set(val($event))" [class.invalid]="tried() && !emailOk()" />
                </label>
                <label class="field">
                  <span>Telefono (WhatsApp) *</span>
                  <input type="tel" autocomplete="tel" [value]="phone()" (input)="phone.set(val($event))" [class.invalid]="tried() && !phoneOk()" />
                </label>
              </div>

              @for (q of visibleQuestions(); track q.key) {
                @switch (q.type) {
                  @case ('confirm') {
                    <label class="consent" [class.invalid-text]="tried() && q.required && answers()[q.key] !== 'true'">
                      <input type="checkbox" [checked]="answers()[q.key] === 'true'" (change)="setAnswer(q.key, $any($event.target).checked ? 'true' : '')" />
                      <span>{{ q.label }}{{ q.required ? ' *' : '' }}</span>
                    </label>
                  }
                  @case ('radio') {
                    <fieldset class="field choice" [class.invalid-group]="tried() && q.required && !answers()[q.key]">
                      <legend>{{ q.label }}{{ q.required ? ' *' : '' }}</legend>
                      @if (q.help) { <p class="help">{{ q.help }}</p> }
                      <div class="options">
                        @for (o of q.options ?? []; track o) {
                          <label class="option" [class.on]="answers()[q.key] === o">
                            <input type="radio" [name]="q.key" [value]="o" [checked]="answers()[q.key] === o" (change)="setAnswer(q.key, o)" />
                            <span>{{ o }}</span>
                          </label>
                        }
                      </div>
                      @if (isBlocking(q)) {
                        <p class="blocking" role="alert">{{ q.blockingMessage ?? 'Con questa risposta non è possibile prenotare la call.' }}</p>
                      }
                    </fieldset>
                  }
                  @default {
                    <label class="field">
                      <span>{{ q.label }}{{ q.required ? ' *' : '' }}</span>
                      @if (q.help) { <small class="help">{{ q.help }}</small> }
                      @switch (q.type) {
                        @case ('textarea') {
                          <textarea rows="3" [value]="answers()[q.key] ?? ''" (input)="setAnswer(q.key, val($event))" [class.invalid]="tried() && q.required && !answers()[q.key]"></textarea>
                        }
                        @case ('select') {
                          <select (change)="setAnswer(q.key, val($event))" [class.invalid]="tried() && q.required && !answers()[q.key]">
                            <option value="">Seleziona…</option>
                            @for (o of q.options ?? []; track o) {
                              <option [value]="o" [selected]="answers()[q.key] === o">{{ o }}</option>
                            }
                          </select>
                        }
                        @default {
                          <input type="text" [value]="answers()[q.key] ?? ''" (input)="setAnswer(q.key, val($event))" [class.invalid]="tried() && q.required && !answers()[q.key]" />
                        }
                      }
                    </label>
                    @if (isBlocking(q)) {
                      <p class="blocking" role="alert">{{ q.blockingMessage ?? 'Con questa risposta non è possibile prenotare la call.' }}</p>
                    }
                  }
                }
              }

              <!-- honeypot: invisibile alle persone -->
              <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" (input)="website.set(val($event))" />

              @if (formError()) {
                <p class="form-error" role="alert">{{ formError() }}</p>
              }

              <button type="submit" class="submit" [disabled]="sending() || blocked()">
                {{ sending() ? 'Prenotazione in corso…' : 'Conferma la call' }}
              </button>
            </form>
          }

          @case ('done') {
            <div class="done">
              <div class="done-icon" aria-hidden="true">✓</div>
              <h2>La tua call è confermata</h2>
              <p class="done-when">{{ label(selectedSlot()!) }}</p>
              <p>Ti abbiamo inviato un'email a <strong>{{ email() }}</strong> con il link della videochiamata e l'invito da aggiungere al calendario.</p>
              <p class="muted">Se non la trovi, controlla nella cartella spam o promozioni.</p>
            </div>
          }
        }
      </main>
    </div>
  `,
})
export class PrenotaComponent {
  private readonly api = inject(PublicBookingApiService);
  private readonly route = inject(ActivatedRoute);

  private readonly slug = this.route.snapshot.paramMap.get('academy') ?? '';
  private readonly attribution: Attribution = captureAttribution(
    this.route.snapshot.queryParams as Record<string, string>,
  );

  readonly step = signal<Step>('loading');
  readonly settings = signal<PublicBookingSettings | null>(null);
  readonly slots = signal<string[]>([]);
  readonly selectedSlot = signal<string | null>(null);
  readonly errorMsg = signal('');
  readonly notice = signal('');

  readonly name = signal('');
  readonly surname = signal('');
  readonly email = signal('');
  readonly phone = signal('');
  readonly answers = signal<Record<string, string>>({});
  readonly website = signal('');
  readonly tried = signal(false);
  readonly sending = signal(false);
  readonly formError = signal('');

  /** Domande da mostrare: chi arriva dal link di una setter non risponde a quelle già note */
  readonly visibleQuestions = computed(() =>
    (this.settings()?.questions ?? []).filter(q => !(q.hideWhenRef && this.attribution.ref)),
  );
  readonly blocked = computed(() => this.visibleQuestions().some(q => this.isBlocking(q)));

  readonly brand = computed(() => this.settings()?.brand?.color ?? '#4f46e5');
  readonly emailOk = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(this.email().trim()));
  readonly phoneOk = computed(() => this.phone().replace(/\D/g, '').length >= 8);

  readonly label = romeLabel;

  constructor() {
    this.api.settings(this.slug).subscribe({
      next: s => {
        this.settings.set(s);
        this.loadSlots();
      },
      error: () => {
        this.errorMsg.set('Il link non è corretto o le prenotazioni sono chiuse.');
        this.step.set('error');
      },
    });
  }

  private loadSlots(): void {
    const s = this.settings();
    if (!s) return;
    const from = romeDate(new Date());
    this.api.slots(this.slug, from, addDays(from, s.horizonDays)).subscribe({
      next: slots => {
        this.slots.set(slots);
        this.step.set('pick');
      },
      error: () => {
        this.errorMsg.set('Non riusciamo a caricare gli orari. Riprova tra poco.');
        this.step.set('error');
      },
    });
  }

  val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  isBlocking(q: { key: string; blockingOptions?: string[] }): boolean {
    const v = this.answers()[q.key];
    return Boolean(v && q.blockingOptions?.includes(v));
  }

  setAnswer(key: string, value: string): void {
    this.answers.update(a => ({ ...a, [key]: value }));
  }

  selectSlot(slot: string): void {
    this.selectedSlot.set(slot);
    this.notice.set('');
    this.step.set('form');
  }

  backToPick(): void {
    this.step.set('pick');
  }

  submit(): void {
    this.tried.set(true);
    this.formError.set('');
    if (this.blocked()) return;
    const missing = this.visibleQuestions().some(q => q.required && !this.answers()[q.key]?.trim());
    if (!this.name().trim() || !this.surname().trim() || !this.emailOk() || !this.phoneOk() || missing) {
      this.formError.set('Controlla i campi evidenziati: sono tutti obbligatori.');
      return;
    }
    this.sending.set(true);
    this.api.create(this.slug, {
      startsAt: this.selectedSlot()!,
      name: this.name().trim(),
      surname: this.surname().trim(),
      email: this.email().trim(),
      phone: this.phone().trim(),
      answers: this.answers(),
      ref: this.attribution.ref,
      utm: this.attribution.utm,
      website: this.website() || undefined,
    }).subscribe({
      next: () => {
        this.sending.set(false);
        this.step.set('done');
      },
      error: (err: HttpErrorResponse) => {
        this.sending.set(false);
        if (err.status === 409) {
          this.notice.set('Quell\'orario è stato appena prenotato da un\'altra persona. Scegline un altro.');
          this.step.set('loading');
          this.loadSlots();
          return;
        }
        if (err.status === 429) {
          this.formError.set('Troppi tentativi. Riprova tra qualche minuto.');
          return;
        }
        const msg = err.error?.message;
        this.formError.set(typeof msg === 'string' ? msg : 'Non è stato possibile prenotare. Riprova.');
      },
    });
  }
}
