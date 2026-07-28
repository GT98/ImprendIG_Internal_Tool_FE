import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl } from '@angular/forms';
import { OnboardingFormApiService } from '../../customers/customer-api.service';

type PageState = 'loading' | 'form' | 'completed' | 'error';

@Component({
  selector: 'app-onboarding-form',
  imports: [ReactiveFormsModule],
  styles: [`
    :host { display: flex; min-height: 100dvh; background: #f9fafb; align-items: flex-start; justify-content: center; padding: 2rem 1rem; }

    .card { background: #fff; border-radius: 16px; border: 1px solid #e5e7eb; padding: 2rem; width: 100%; max-width: 520px; box-shadow: 0 1px 4px rgba(0,0,0,.06); }

    .logo { font-size: 1.1rem; font-weight: 700; color: #111827; margin-bottom: 1.5rem; }
    h1 { font-size: 1.25rem; font-weight: 700; color: #111827; margin: 0 0 .25rem; }
    .subtitle { font-size: 13px; color: #6b7280; margin: 0 0 1.75rem; }

    .field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 1rem; }
    label { font-size: 13px; font-weight: 600; color: #374151; }
    input[type="text"] {
      padding: 9px 12px; border: 1.5px solid #d1d5db; border-radius: 8px;
      font-size: 14px; color: #111827; outline: none; transition: border-color .15s; background: #fff;
    }
    input:focus { border-color: #4f46e5; }
    input.invalid { border-color: #dc2626; }
    .hint { font-size: 11px; color: #9ca3af; }
    .err { font-size: 12px; color: #dc2626; }

    .row3 { display: grid; grid-template-columns: 1fr 80px 90px; gap: 12px; }

    .checkbox-row { display: flex; align-items: flex-start; gap: 10px; margin: 1.25rem 0; }
    .checkbox-row input[type="checkbox"] { margin-top: 2px; width: 16px; height: 16px; accent-color: #4f46e5; flex-shrink: 0; cursor: pointer; }
    .checkbox-row label { font-size: 13px; color: #374151; cursor: pointer; }
    .checkbox-row a { color: #4f46e5; text-decoration: underline; }

    .submit-btn {
      width: 100%; padding: 12px; background: #4f46e5; color: #fff; border: none;
      border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer;
      transition: background .15s;
    }
    .submit-btn:hover:not(:disabled) { background: #4338ca; }
    .submit-btn:disabled { opacity: .6; cursor: not-allowed; }

    .success-icon { font-size: 3rem; text-align: center; margin-bottom: 1rem; }
    .success-title { font-size: 1.2rem; font-weight: 700; color: #111827; margin: 0 0 .5rem; }
    .success-body { font-size: 14px; color: #6b7280; line-height: 1.6; }

    .loading-msg { font-size: 14px; color: #6b7280; padding: 2rem 0; text-align: center; }
  `],
  template: `
    <div class="card">
      <div class="logo">ImprendIG</div>

      @switch (pageState()) {
        @case ('loading') {
          <p class="loading-msg">Caricamento…</p>
        }
        @case ('error') {
          <h1>Link non valido</h1>
          <p class="subtitle">Il link che hai ricevuto non è valido o è scaduto. Contatta il tuo venditore.</p>
        }
        @case ('completed') {
          <div class="success-icon" aria-hidden="true">✅</div>
          <p class="success-title">Hai già compilato il form!</p>
          <p class="success-body">Grazie, i tuoi dati sono stati registrati correttamente. Il tuo venditore ti invierà a breve il link per accedere al canale.</p>
        }
        @case ('form') {
          <h1>Form di onboarding</h1>
          <p class="subtitle">
            @if (productName()) { Benvenuta nel percorso <strong>{{ productName() }}</strong>. }
            Compila tutti i campi per ricevere l'accesso al canale Telegram.
          </p>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>

            <div class="field">
              <label for="fullName">Nome e Cognome *</label>
              <input id="fullName" type="text" formControlName="fullName"
                [class.invalid]="invalid('fullName')" autocomplete="name" />
              @if (invalid('fullName')) {
                <span class="err" role="alert">Campo obbligatorio</span>
              }
            </div>

            <div class="field">
              <label for="codiceFiscale">Codice Fiscale *</label>
              <input id="codiceFiscale" type="text" formControlName="codiceFiscale"
                [class.invalid]="invalid('codiceFiscale')" maxlength="16"
                autocomplete="off" style="text-transform:uppercase" />
              @if (invalid('codiceFiscale')) {
                <span class="err" role="alert">Inserisci un codice fiscale valido (16 caratteri alfanumerici)</span>
              }
            </div>

            <div class="field">
              <label for="address">Via e numero civico *</label>
              <input id="address" type="text" formControlName="address"
                [class.invalid]="invalid('address')" placeholder="es. Via Roma 10"
                autocomplete="street-address" />
              @if (invalid('address')) {
                <span class="err" role="alert">Campo obbligatorio</span>
              }
            </div>

            <div class="row3">
              <div class="field">
                <label for="city">Città *</label>
                <input id="city" type="text" formControlName="city"
                  [class.invalid]="invalid('city')" autocomplete="address-level2" />
                @if (invalid('city')) {
                  <span class="err" role="alert">Obbligatorio</span>
                }
              </div>
              <div class="field">
                <label for="province">Prov. *</label>
                <input id="province" type="text" formControlName="province"
                  [class.invalid]="invalid('province')" maxlength="2"
                  style="text-transform:uppercase" autocomplete="address-level1" />
                @if (invalid('province')) {
                  <span class="err" role="alert">2 lettere</span>
                }
              </div>
              <div class="field">
                <label for="cap">CAP *</label>
                <input id="cap" type="text" formControlName="cap"
                  [class.invalid]="invalid('cap')" maxlength="5"
                  autocomplete="postal-code" />
                @if (invalid('cap')) {
                  <span class="err" role="alert">5 cifre</span>
                }
              </div>
            </div>

            <div class="field">
              <label for="startDate">Data inizio affiancamento 1:1 *</label>
              <input id="startDate" type="text" formControlName="startDate"
                [class.invalid]="invalid('startDate')" placeholder="GG/MM" maxlength="5" />
              <span class="hint">Solo giorno e mese, es. 15/03</span>
              @if (invalid('startDate')) {
                <span class="err" role="alert">Inserisci una data valida nel formato GG/MM</span>
              }
            </div>

            <div class="checkbox-row">
              <input id="terms" type="checkbox" formControlName="termsAccepted" />
              <label for="terms">
                Accetto i
                <a href="https://www.iubenda.com/termini-e-condizioni/38086701" target="_blank" rel="noopener">
                  Termini e Condizioni
                </a>
                di Carlotta Spinelli *
              </label>
            </div>
            @if (invalid('termsAccepted')) {
              <p class="err" role="alert">Devi accettare i termini per continuare</p>
            }

            @if (submitError()) {
              <p class="err" role="alert">{{ submitError() }}</p>
            }

            <button type="submit" class="submit-btn" [disabled]="submitting()">
              {{ submitting() ? 'Invio in corso…' : 'Invia e accedi al canale' }}
            </button>
          </form>
        }
      }
    </div>
  `,
})
export class OnboardingFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(OnboardingFormApiService);
  private readonly fb = inject(FormBuilder);

  readonly pageState = signal<PageState>('loading');
  readonly productName = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  private token = '';

  readonly form = this.fb.group({
    fullName:       ['', Validators.required],
    codiceFiscale:  ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9]{16}$/)]],
    address:        ['', Validators.required],
    city:           ['', Validators.required],
    province:       ['', [Validators.required, Validators.pattern(/^[A-Za-z]{2}$/)]],
    cap:            ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
    startDate:      ['', [Validators.required, Validators.pattern(/^\d{2}\/\d{2}$/)]],
    termsAccepted:  [false, Validators.requiredTrue],
  });

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    this.api.getForm(this.token).subscribe({
      next: (data) => {
        this.productName.set(data.productName);
        if (data.status === 'completed') {
          this.pageState.set('completed');
          return;
        }
        if (data.prefillName) {
          this.form.patchValue({ fullName: data.prefillName });
        }
        this.pageState.set('form');
      },
      error: () => this.pageState.set('error'),
    });
  }

  invalid(field: string): boolean {
    const ctrl = this.form.get(field) as AbstractControl;
    return ctrl.invalid && ctrl.touched;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.submitError.set(null);

    const v = this.form.getRawValue();
    this.api
      .submit(this.token, {
        fullName:       v.fullName ?? '',
        codiceFiscale:  (v.codiceFiscale ?? '').toUpperCase(),
        address:        v.address ?? '',
        city:           v.city ?? '',
        province:       (v.province ?? '').toUpperCase(),
        cap:            v.cap ?? '',
        startDate:      v.startDate ?? '',
        termsAccepted:  v.termsAccepted ?? false,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.pageState.set('completed');
        },
        error: () => {
          this.submitting.set(false);
          this.submitError.set('Si è verificato un errore. Riprova o contatta il tuo venditore.');
        },
      });
  }
}
