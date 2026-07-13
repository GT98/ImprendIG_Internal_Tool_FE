import { Component, computed, inject, input, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CatalogApiService, CatalogService } from '../../catalog/catalog-api.service';
import { LeadsService } from '../../leads/lead.service';
import { SaleApiService } from '../../sales/sale-api.service';
import { ToastService } from '../../shared/toast.service';
import { IconComponent } from '../../shared/icon.component';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-create-sale-modal',
  imports: [ReactiveFormsModule, IconComponent],
  template: `
    @if (visible()) {
      <div
        class="overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        (click)="onOverlayClick($event)"
      >
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h2 id="modal-title" class="modal-title">Nuova vendita manuale</h2>
            <button class="close-btn" aria-label="Chiudi" (click)="close()">
              <app-icon name="x" [size]="18" />
            </button>
          </div>

          <form [formGroup]="form" (ngSubmit)="submit()" class="modal-body">

            <!-- SEZIONE CLIENTE -->
            <fieldset class="section">
              <legend class="section-title">Dati cliente</legend>
              <div class="field-row">
                <div class="field">
                  <label for="ms-name">Nome</label>
                  <input id="ms-name" type="text" formControlName="customerName" placeholder="Mario" />
                </div>
                <div class="field">
                  <label for="ms-surname">Cognome</label>
                  <input id="ms-surname" type="text" formControlName="customerSurname" placeholder="Rossi" />
                </div>
              </div>
              <div class="field-row">
                <div class="field">
                  <label for="ms-email">
                    Email <span class="required" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="ms-email"
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
                <div class="field">
                  <label for="ms-phone">Telefono</label>
                  <input id="ms-phone" type="tel" formControlName="customerPhone" placeholder="+39 333 1234567" />
                </div>
              </div>
            </fieldset>

            <!-- SEZIONE VENDITA -->
            <fieldset class="section">
              <legend class="section-title">Dettagli vendita</legend>
              <div class="field-row">
                <div class="field">
                  <label for="ms-seller">Venditore</label>
                  <select id="ms-seller" formControlName="sellerId">
                    <option [value]="null">— nessuno —</option>
                    @for (s of sellers(); track s.id) {
                      <option [value]="s.id">{{ s.name }} {{ s.lastName }}</option>
                    }
                  </select>
                </div>
                <div class="field">
                  <label for="ms-setter">Setter</label>
                  <select id="ms-setter" formControlName="setterId">
                    <option [value]="null">— nessuno —</option>
                    @for (s of setters(); track s.id) {
                      <option [value]="s.id">{{ s.name }} {{ s.lastName }}</option>
                    }
                  </select>
                </div>
              </div>
              <div class="field">
                <label for="ms-service">Servizio</label>
                <select id="ms-service" [value]="selectedServiceId()" (change)="onServiceChange($event)">
                  <option [value]="null">— seleziona —</option>
                  @for (svc of catalog(); track svc.id) {
                    <option [value]="svc.id">{{ svc.name }}</option>
                  }
                </select>
              </div>
              <div class="field">
                <label for="ms-plan">
                  Piano prezzi <span class="required" aria-hidden="true">*</span>
                </label>
                <select
                  id="ms-plan"
                  formControlName="pricePlanId"
                  [class.invalid]="planInvalid()"
                  [disabled]="availablePlans().length === 0"
                >
                  <option [value]="null">— seleziona piano —</option>
                  @for (p of availablePlans(); track p.id) {
                    <option [value]="p.id">{{ p.variantName }} · {{ p.name }}</option>
                  }
                </select>
                @if (planInvalid()) {
                  <span class="field-err" role="alert">Piano obbligatorio</span>
                }
              </div>
            </fieldset>

            <!-- SEZIONE RATE -->
            <fieldset class="section">
              <legend class="section-title">Rate</legend>
              <div class="field">
                <label class="field-label" id="payment-method-label">Metodo di pagamento</label>
                <div class="toggle-group" role="group" aria-labelledby="payment-method-label">
                  <button
                    type="button"
                    class="toggle-opt"
                    [class.active]="isStripe()"
                    (click)="form.controls.paymentMethod.setValue('stripe')"
                  >Stripe</button>
                  <button
                    type="button"
                    class="toggle-opt"
                    [class.active]="form.value.paymentMethod === 'bonifico'"
                    (click)="form.controls.paymentMethod.setValue('bonifico')"
                  >Bonifico</button>
                </div>
                @if (isStripe()) {
                  <div class="toggle-group sub-toggle" role="group" aria-label="Account Stripe">
                    <button
                      type="button"
                      class="toggle-opt sm"
                      [class.active]="form.value.paymentMethod === 'stripe'"
                      (click)="form.controls.paymentMethod.setValue('stripe')"
                    >🇦🇪 UAE</button>
                    <button
                      type="button"
                      class="toggle-opt sm"
                      [class.active]="form.value.paymentMethod === 'stripe_ita'"
                      (click)="form.controls.paymentMethod.setValue('stripe_ita')"
                    >🇮🇹 Italia</button>
                  </div>
                }
                @if (form.value.paymentMethod === 'bonifico') {
                  <span class="field-hint">Le rate partono tutte come "da pagare" — il venditore le segna manualmente.</span>
                }
              </div>
              <div class="field checkbox-field">
                <label class="checkbox-label">
                  <input type="checkbox" formControlName="includeDeposit" />
                  Includi acconto (già pagato)
                </label>
              </div>
              @if (form.value.includeDeposit) {
                <div class="field">
                  <label for="ms-deposit">Importo acconto (€) <span class="required" aria-hidden="true">*</span></label>
                  <input
                    id="ms-deposit"
                    type="number"
                    min="0"
                    step="0.01"
                    formControlName="depositAmount"
                    placeholder="0.00"
                  />
                </div>
              }
              <div class="field">
                <label for="ms-date">Data prima rata</label>
                <input id="ms-date" type="date" formControlName="firstInstallmentDate" />
              </div>
            </fieldset>

            <div class="modal-footer">
              <button type="button" class="btn-ghost" (click)="close()">Annulla</button>
              <button
                type="submit"
                class="btn-primary"
                [disabled]="form.invalid || submitting()"
              >
                @if (submitting()) { Salvataggio… } @else { Crea vendita }
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
      background: var(--surface-1, #fff);
      border-radius: 14px;
      width: 100%;
      max-width: 560px;
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
    .field label {
      font-size: 13px;
      font-weight: 500;
      color: var(--ink-2, #444);
    }
    .required { color: #e53e3e; }
    .field input, .field select {
      padding: 8px 10px;
      border: 1px solid var(--border, #e5e7eb);
      border-radius: 8px;
      font-size: 14px;
      background: var(--surface-1, #fff);
      color: var(--ink-1, #111);
      outline: none;
      transition: border-color .15s;
    }
    .field input:focus, .field select:focus {
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
    .field-hint { font-size: 12px; color: var(--ink-3, #888); margin-top: 4px; }
    .field-label { font-size: 13px; font-weight: 500; color: var(--ink-2, #444); }
    .checkbox-field { flex-direction: row; align-items: center; margin-top: 0; }
    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      cursor: pointer;
    }
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
export class CreateSaleModalComponent {
  readonly visible = input.required<boolean>();
  readonly closed = output<void>();
  readonly created = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly catalogApi = inject(CatalogApiService);
  private readonly leadsService = inject(LeadsService);
  private readonly saleApi = inject(SaleApiService);
  private readonly toast = inject(ToastService);

  readonly form = this.fb.nonNullable.group({
    customerEmail: ['', [Validators.required, Validators.email]],
    customerName: [''],
    customerSurname: [''],
    customerPhone: [''],
    sellerId: [null as number | null],
    setterId: [null as number | null],
    pricePlanId: [null as number | null, Validators.required],
    includeDeposit: [false],
    depositAmount: [null as number | null],
    firstInstallmentDate: [todayIso()],
    paymentMethod: ['stripe' as 'stripe' | 'stripe_ita' | 'bonifico'],
  });

  readonly selectedServiceId = signal<number | null>(null);
  readonly submitting = signal(false);

  private readonly sellersResource = rxResource({ stream: () => this.leadsService.getSellers() });
  private readonly settersResource = rxResource({ stream: () => this.leadsService.getSetters() });
  private readonly catalogResource = rxResource({ stream: () => this.catalogApi.getCatalog() });

  readonly sellers = computed(() => this.sellersResource.value() ?? []);
  readonly setters = computed(() => this.settersResource.value() ?? []);
  readonly catalog = computed(() => this.catalogResource.value() ?? []);

  readonly availablePlans = computed(() => {
    const id = this.selectedServiceId();
    // TypeORM bigint PKs are serialized as strings in JSON, so normalise both sides
    const svc = id ? this.catalog().find(s => Number(s.id) === id) : undefined;
    if (!svc) return [];
    return svc.variants.flatMap(v =>
      v.pricePlans.map(p => ({ ...p, variantName: v.name }))
    );
  });

  readonly isStripe = computed(() =>
    this.form.value.paymentMethod === 'stripe' || this.form.value.paymentMethod === 'stripe_ita'
  );

  readonly emailInvalid = computed(() => {
    const ctrl = this.form.controls.customerEmail;
    return ctrl.invalid && (ctrl.dirty || ctrl.touched);
  });

  readonly planInvalid = computed(() => {
    const ctrl = this.form.controls.pricePlanId;
    return ctrl.invalid && (ctrl.dirty || ctrl.touched);
  });

  onServiceChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.selectedServiceId.set(val ? Number(val) : null);
    this.form.controls.pricePlanId.setValue(null);
  }

  close(): void {
    this.resetForm();
    this.closed.emit();
  }

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const v = this.form.getRawValue();
    this.submitting.set(true);

    this.saleApi.createManual({
      customerEmail: v.customerEmail,
      customerName: v.customerName || undefined,
      customerSurname: v.customerSurname || undefined,
      customerPhone: v.customerPhone || undefined,
      pricePlanId: Number(v.pricePlanId!),
      sellerId: v.sellerId != null ? Number(v.sellerId) : undefined,
      setterId: v.setterId != null ? Number(v.setterId) : undefined,
      includeDeposit: v.includeDeposit || undefined,
      depositAmount: v.depositAmount ?? undefined,
      firstInstallmentDate: v.firstInstallmentDate || undefined,
      paymentMethod: v.paymentMethod,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success('Vendita creata con successo');
        this.resetForm();
        this.created.emit();
      },
      error: () => {
        this.submitting.set(false);
        this.toast.error('Errore durante la creazione della vendita');
      },
    });
  }

  private resetForm(): void {
    this.form.reset({
      customerEmail: '',
      customerName: '',
      customerSurname: '',
      customerPhone: '',
      sellerId: null,
      setterId: null,
      pricePlanId: null,
      includeDeposit: false,
      depositAmount: null,
      firstInstallmentDate: todayIso(),
      paymentMethod: 'stripe' as 'stripe' | 'stripe_ita' | 'bonifico',
    });
    this.selectedServiceId.set(null);
  }
}
