import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { CatalogApiService } from '../../catalog/catalog-api.service';
import { SaleApiService } from '../../sales/sale-api.service';
import { ToastService } from '../../shared/toast.service';
import { IconComponent } from '../../shared/icon.component';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-create-neutral-sale-modal',
  imports: [ReactiveFormsModule, IconComponent],
  template: `
    @if (visible()) {
      <div
        class="overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ns-modal-title"
        (click)="onOverlayClick($event)"
      >
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h2 id="ns-modal-title" class="modal-title">Entrata recuperata</h2>
            <button class="close-btn" aria-label="Chiudi" (click)="close()">
              <app-icon name="x" [size]="18" />
            </button>
          </div>

          <form [formGroup]="form" (ngSubmit)="submit()" class="modal-body">

            <fieldset class="section">
              <legend class="section-title">Pagamento</legend>

              <div class="field">
                <label for="ns-client">
                  Azienda <span class="required" aria-hidden="true">*</span>
                </label>
                <select id="ns-client" formControlName="clientId" [class.invalid]="clientInvalid()">
                  <option [value]="null">— seleziona —</option>
                  @for (c of clients(); track c.id) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select>
                @if (clientInvalid()) {
                  <span class="field-err" role="alert">Azienda obbligatoria</span>
                }
              </div>

              <div class="field-row">
                <div class="field">
                  <label for="ns-amount">
                    Importo (€) <span class="required" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="ns-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    formControlName="amount"
                    placeholder="0.00"
                    [class.invalid]="amountInvalid()"
                  />
                  @if (amountInvalid()) {
                    <span class="field-err" role="alert">Importo non valido</span>
                  }
                </div>
                <div class="field">
                  <label for="ns-date">Data pagamento</label>
                  <input id="ns-date" type="date" formControlName="paymentDate" />
                </div>
              </div>

              <div class="field">
                <label class="field-label" id="ns-method-label">Metodo di pagamento</label>
                <div class="toggle-group" role="group" aria-labelledby="ns-method-label">
                  <button
                    type="button"
                    class="toggle-opt"
                    [class.active]="paymentMethod() === 'bonifico'"
                    (click)="form.controls.paymentMethod.setValue('bonifico')"
                  >Bonifico</button>
                  <button
                    type="button"
                    class="toggle-opt"
                    [class.active]="isStripe()"
                    (click)="form.controls.paymentMethod.setValue('stripe')"
                  >Stripe</button>
                </div>
                @if (isStripe()) {
                  <div class="toggle-group sub-toggle" role="group" aria-label="Account Stripe">
                    <button
                      type="button"
                      class="toggle-opt sm"
                      [class.active]="paymentMethod() === 'stripe'"
                      (click)="form.controls.paymentMethod.setValue('stripe')"
                    >🇦🇪 UAE</button>
                    <button
                      type="button"
                      class="toggle-opt sm"
                      [class.active]="paymentMethod() === 'stripe_ita'"
                      (click)="form.controls.paymentMethod.setValue('stripe_ita')"
                    >🇮🇹 Italia</button>
                  </div>
                }
              </div>
            </fieldset>

            <fieldset class="section">
              <legend class="section-title">Cliente (opzionale)</legend>
              <div class="field-row">
                <div class="field">
                  <label for="ns-name">Nome</label>
                  <input id="ns-name" type="text" formControlName="customerName" placeholder="Mario" />
                </div>
                <div class="field">
                  <label for="ns-surname">Cognome</label>
                  <input id="ns-surname" type="text" formControlName="customerSurname" placeholder="Rossi" />
                </div>
              </div>
              <div class="field">
                <label for="ns-email">Email</label>
                <input
                  id="ns-email"
                  type="email"
                  formControlName="customerEmail"
                  placeholder="mario@esempio.it"
                  [class.invalid]="emailInvalid()"
                  autocomplete="email"
                />
                @if (emailInvalid()) {
                  <span class="field-err" role="alert">Email non valida</span>
                }
              </div>
            </fieldset>

            <fieldset class="section">
              <legend class="section-title">Note</legend>
              <div class="field">
                <label for="ns-notes">Note interne</label>
                <textarea
                  id="ns-notes"
                  formControlName="notes"
                  rows="2"
                  placeholder="Es. Recupero morosità — contratto 2024"
                ></textarea>
              </div>
            </fieldset>

            <div class="modal-footer">
              <button type="button" class="btn-ghost" (click)="close()">Annulla</button>
              <button
                type="submit"
                class="btn-primary"
                [disabled]="form.invalid || submitting()"
              >
                @if (submitting()) { Salvataggio… } @else { Registra entrata }
              </button>
            </div>

          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
    }
    .modal {
      background: var(--surface, #fff);
      border-radius: 14px;
      width: 100%;
      max-width: 520px;
      max-height: 90dvh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 24px 64px rgba(0,0,0,.18);
    }
    .modal-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px 0;
    }
    .modal-title {
      font-size: 17px;
      font-weight: 600;
      margin: 0;
    }
    .close-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--ink-3, #888);
      padding: 4px;
      border-radius: 6px;
      display: flex;
      align-items: center;
    }
    .close-btn:hover { background: var(--surface-2, #f3f4f6); }
    .modal-body {
      overflow-y: auto;
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .section {
      border: 1px solid var(--border, #e5e7eb);
      border-radius: 10px;
      padding: 14px 16px;
      margin: 0;
    }
    .section-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .04em;
      color: var(--ink-3, #888);
      padding: 0 4px;
    }
    .field-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin-top: 10px;
    }
    .field label, .field-label {
      font-size: 13px;
      font-weight: 500;
      color: var(--ink-2, #444);
    }
    .required { color: #e53e3e; }
    .field input, .field select, .field textarea {
      padding: 8px 10px;
      border: 1px solid var(--border, #e5e7eb);
      border-radius: 8px;
      font-size: 14px;
      background: var(--surface-2, #f9fafb);
      color: var(--ink, #111);
      outline: none;
      transition: border-color .15s;
      font-family: inherit;
      resize: vertical;
    }
    .field input:focus, .field select:focus, .field textarea:focus {
      border-color: var(--accent, #4f46e5);
    }
    .field input.invalid, .field select.invalid {
      border-color: #e53e3e;
    }
    .field-err {
      font-size: 12px;
      color: #e53e3e;
    }
    .toggle-group { display: flex; gap: 6px; margin-top: 2px; }
    .sub-toggle { margin-top: 8px; padding-left: 4px; }
    .toggle-opt.sm { font-size: 12px; padding: 4px 12px; }
    .toggle-opt { padding: 6px 16px; border-radius: 20px; border: 1.5px solid var(--border, #e5e7eb); background: transparent; color: var(--ink-2, #444); font-size: 13px; font-weight: 600; cursor: pointer; transition: background .15s, color .15s, border-color .15s; }
    .toggle-opt.active { background: var(--accent, #4f46e5); border-color: var(--accent, #4f46e5); color: #fff; }
    .toggle-opt:hover:not(.active) { border-color: var(--accent, #4f46e5); color: var(--accent, #4f46e5); }
    .field-label { font-size: 13px; font-weight: 500; color: var(--ink-2, #444); }
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .btn-ghost {
      background: none;
      border: 1px solid var(--border, #e5e7eb);
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 14px;
      cursor: pointer;
      color: var(--ink-2, #444);
    }
    .btn-ghost:hover { background: var(--surface-2, #f3f4f6); }
    .btn-primary {
      background: var(--accent, #4f46e5);
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 8px 20px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-primary:disabled { opacity: .55; cursor: not-allowed; }
    .btn-primary:not(:disabled):hover { filter: brightness(1.08); }
  `],
})
export class CreateNeutralSaleModalComponent {
  readonly visible = input.required<boolean>();
  readonly closed = output<void>();
  readonly created = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly catalogApi = inject(CatalogApiService);
  private readonly saleApi = inject(SaleApiService);
  private readonly toast = inject(ToastService);

  readonly form = this.fb.nonNullable.group({
    clientId: [null as number | null, Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    paymentDate: [todayIso()],
    paymentMethod: ['bonifico' as 'stripe' | 'stripe_ita' | 'bonifico'],
    customerEmail: ['', Validators.email],
    customerName: [''],
    customerSurname: [''],
    notes: [''],
  });

  readonly submitting = signal(false);

  private readonly clientsResource = rxResource({ stream: () => this.catalogApi.getClients() });
  readonly clients = computed(() => this.clientsResource.value() ?? []);

  readonly paymentMethod = toSignal(
    this.form.controls.paymentMethod.valueChanges,
    { initialValue: this.form.controls.paymentMethod.value },
  );

  readonly isStripe = computed(() => {
    const m = this.paymentMethod();
    return m === 'stripe' || m === 'stripe_ita';
  });

  readonly clientInvalid = computed(() => {
    const ctrl = this.form.controls.clientId;
    return ctrl.invalid && (ctrl.dirty || ctrl.touched);
  });

  readonly amountInvalid = computed(() => {
    const ctrl = this.form.controls.amount;
    return ctrl.invalid && (ctrl.dirty || ctrl.touched);
  });

  readonly emailInvalid = computed(() => {
    const ctrl = this.form.controls.customerEmail;
    return ctrl.invalid && (ctrl.dirty || ctrl.touched);
  });

  close(): void {
    this.resetForm();
    this.closed.emit();
  }

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;

    const v = this.form.getRawValue();
    this.submitting.set(true);

    this.saleApi.createNeutral({
      clientId: Number(v.clientId!),
      amount: Number(v.amount!),
      paymentDate: v.paymentDate || undefined,
      paymentMethod: v.paymentMethod,
      customerEmail: v.customerEmail || undefined,
      customerName: v.customerName || undefined,
      customerSurname: v.customerSurname || undefined,
      notes: v.notes || undefined,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success('Entrata registrata con successo');
        this.resetForm();
        this.created.emit();
      },
      error: () => {
        this.submitting.set(false);
        this.toast.error('Errore durante la registrazione dell\'entrata');
      },
    });
  }

  private resetForm(): void {
    this.form.reset({
      clientId: null,
      amount: null,
      paymentDate: todayIso(),
      paymentMethod: 'bonifico' as 'stripe' | 'stripe_ita' | 'bonifico',
      customerEmail: '',
      customerName: '',
      customerSurname: '',
      notes: '',
    });
  }
}
