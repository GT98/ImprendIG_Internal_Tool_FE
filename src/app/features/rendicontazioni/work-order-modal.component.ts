import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/toast.service';
import { ReportingApiService, WorkOrderDto, EmployeeInfo, CreateWorkOrderPayload } from '../../reporting/reporting-api.service';

@Component({
  selector: 'app-work-order-modal',
  imports: [ReactiveFormsModule, IconComponent],
  template: `
    @if (visible()) {
      <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="wo-title"
           (click)="onOverlayClick($event)">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h2 id="wo-title">{{ isMulti() ? 'Nuova commessa' : (editItem() ? 'Modifica commessa' : 'Nuova commessa') }}</h2>
            <button class="close-btn" aria-label="Chiudi" (click)="close()">
              <app-icon name="x" [size]="16" />
            </button>
          </div>
          <div class="modal-body">
            <form [formGroup]="form" (ngSubmit)="submit()" class="form-fields">
              <div class="field">
                <label for="wo-desc">Descrizione <span class="req">*</span></label>
                <input id="wo-desc" type="text" formControlName="description"
                       placeholder="es. Landing page, Attività setter..." />
              </div>

              <div class="field">
                <label>Tipo compenso</label>
                <div class="toggle-group" role="group">
                  <button type="button" class="toggle-opt" [class.active]="form.value.type === 'fixed'"
                          (click)="form.controls.type.setValue('fixed')">Fisso (€)</button>
                  <button type="button" class="toggle-opt" [class.active]="form.value.type === 'percentage'"
                          (click)="form.controls.type.setValue('percentage')">Percentuale (%)</button>
                </div>
              </div>

              @if (form.value.type === 'fixed') {
                <div class="field">
                  <label for="wo-amount">Importo (€) <span class="req">*</span></label>
                  <input id="wo-amount" type="number" min="0" step="0.01"
                         formControlName="fixedAmount" placeholder="0.00" />
                </div>
              }

              @if (form.value.type === 'percentage') {
                <div class="field-row">
                  <div class="field">
                    <label for="wo-pct">Percentuale (%) <span class="req">*</span></label>
                    <input id="wo-pct" type="number" min="0" max="100" step="0.1"
                           formControlName="percentageRate" placeholder="5" />
                  </div>
                  <div class="field">
                    <label for="wo-base">Base di calcolo (€) <span class="req">*</span></label>
                    <input id="wo-base" type="number" min="0" step="0.01"
                           formControlName="baseAmount" placeholder="0.00" />
                  </div>
                </div>
                @if (previewAmount() > 0) {
                  <div class="result-preview">
                    <span>Risultato:</span>
                    <strong>€ {{ previewAmount().toFixed(2) }}</strong>
                  </div>
                }
              }

              <!-- Multi-dipendente: selezione checkboxes -->
              @if (isMulti()) {
                <div class="field">
                  <label>Assegna a <span class="req">*</span></label>
                  <div class="emp-list">
                    @for (emp of employees(); track emp.id + emp.type) {
                      <label class="emp-check" [class.checked]="isSelected(emp)">
                        <input type="checkbox"
                               [checked]="isSelected(emp)"
                               (change)="toggleEmployee.emit(emp)" />
                        <div class="emp-avatar-sm" [class]="emp.type">
                          {{ emp.name.charAt(0).toUpperCase() }}
                        </div>
                        <span>{{ emp.name }}</span>
                        <span class="role-tag" [class]="emp.type">{{ emp.type === 'seller' ? 'V' : 'S' }}</span>
                      </label>
                    }
                  </div>
                  @if (selectedEmpKeys().size === 0) {
                    <span class="hint-text">Seleziona almeno un dipendente</span>
                  } @else {
                    <span class="hint-text success">{{ selectedEmpKeys().size }} selezionato/i</span>
                  }
                </div>
              }

              <div class="modal-footer">
                <button type="button" class="btn-ghost" (click)="close()">Annulla</button>
                <button type="submit" class="btn-primary"
                        [disabled]="form.invalid || isSaving() || (isMulti() && selectedEmpKeys().size === 0)">
                  {{ isSaving() ? 'Salvataggio…' : 'Salva' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .overlay { position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px; }
    .modal { background:#fff;border-radius:14px;width:100%;max-width:480px;max-height:90dvh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,.18); }
    .modal-head { display:flex;align-items:center;justify-content:space-between;padding:20px 24px 0;flex-shrink:0; }
    .modal-head h2 { font-size:16px;font-weight:600;margin:0; }
    .close-btn { background:none;border:none;cursor:pointer;color:#888;padding:4px;border-radius:6px;display:flex; }
    .close-btn:hover { background:#f3f4f6; }
    .modal-body { overflow-y:auto;padding:20px 24px 24px; }
    .form-fields { display:flex;flex-direction:column;gap:14px; }
    .field { display:flex;flex-direction:column;gap:5px; }
    .field label { font-size:13px;font-weight:500;color:#444; }
    .req { color:#e53e3e; }
    .field input[type=text], .field input[type=number] { padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;outline:none;transition:border-color .15s; }
    .field input:focus { border-color:var(--accent,#4f46e5); }
    .field-row { display:grid;grid-template-columns:1fr 1fr;gap:12px; }
    .toggle-group { display:flex;gap:6px;margin-top:2px; }
    .toggle-opt { padding:6px 16px;border-radius:20px;border:1.5px solid #e5e7eb;background:transparent;color:#444;font-size:13px;font-weight:600;cursor:pointer;transition:.15s; }
    .toggle-opt.active { background:var(--accent,#4f46e5);border-color:var(--accent,#4f46e5);color:#fff; }
    .result-preview { display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:14px;color:#166534; }
    .result-preview strong { font-size:16px; }

    /* Employee multi-select */
    .emp-list { display:flex;flex-direction:column;gap:4px;max-height:200px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px;padding:6px; }
    .emp-check { display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:13px;color:#374151;transition:background .12s; }
    .emp-check:hover { background:#f3f4f6; }
    .emp-check.checked { background:color-mix(in srgb, var(--accent,#4f46e5) 8%, white); }
    .emp-check input[type=checkbox] { flex-shrink:0;accent-color:var(--accent,#4f46e5);width:15px;height:15px;cursor:pointer; }
    .emp-avatar-sm { width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0; }
    .emp-avatar-sm.seller { background:var(--accent,#4f46e5); }
    .emp-avatar-sm.setter { background:#0891b2; }
    .role-tag { font-size:10px;font-weight:700;padding:1px 5px;border-radius:10px;margin-left:auto;flex-shrink:0; }
    .role-tag.seller { background:color-mix(in srgb,var(--accent,#4f46e5) 10%,white);color:var(--accent,#4f46e5); }
    .role-tag.setter { background:#e0f2fe;color:#0369a1; }
    .hint-text { font-size:12px;color:#9ca3af;margin-top:4px; }
    .hint-text.success { color:#16a34a; }

    .modal-footer { display:flex;justify-content:flex-end;gap:10px;margin-top:4px; }
    .btn-ghost { background:none;border:1px solid #e5e7eb;border-radius:8px;padding:8px 16px;font-size:14px;cursor:pointer;color:#444; }
    .btn-ghost:hover { background:#f3f4f6; }
    .btn-primary { background:var(--accent,#4f46e5);color:#fff;border:none;border-radius:8px;padding:8px 20px;font-size:14px;font-weight:500;cursor:pointer; }
    .btn-primary:disabled { opacity:.55;cursor:not-allowed; }
  `],
})
export class WorkOrderModalComponent {
  readonly visible       = input.required<boolean>();
  /** Single-assign mode (from employee detail) */
  readonly employee      = input<EmployeeInfo | null>(null);
  /** Multi-assign mode (from commesse tab) */
  readonly employees     = input<EmployeeInfo[]>([]);
  readonly selectedEmpKeys = input<Set<string>>(new Set());
  readonly month         = input.required<string>();
  readonly editItem      = input<WorkOrderDto | null>(null);
  readonly saving        = input<boolean>(false);

  readonly saved         = output<void>();
  readonly multiSaved    = output<Omit<CreateWorkOrderPayload, 'sellerId' | 'setterId'>>();
  readonly toggleEmployee = output<EmployeeInfo>();
  readonly closed        = output<void>();

  private readonly fb   = inject(FormBuilder);
  private readonly api  = inject(ReportingApiService);
  private readonly toast = inject(ToastService);

  readonly isMulti    = computed(() => this.employees().length > 0);
  readonly localSaving = signal(false);
  readonly isSaving   = computed(() => this.saving() || this.localSaving());

  readonly form = this.fb.nonNullable.group({
    description:    ['', Validators.required],
    type:           ['fixed' as 'fixed' | 'percentage'],
    fixedAmount:    [null as number | null],
    percentageRate: [null as number | null],
    baseAmount:     [null as number | null],
  });

  readonly previewAmount = computed(() => {
    const v = this.form.getRawValue();
    if (v.type !== 'percentage') return 0;
    return ((v.baseAmount ?? 0) * (v.percentageRate ?? 0)) / 100;
  });

  isSelected(emp: EmployeeInfo): boolean {
    return this.selectedEmpKeys().has(`${emp.type}/${emp.id}`);
  }

  ngOnChanges() {
    const item = this.editItem();
    if (item) {
      this.form.patchValue({
        description: item.description,
        type: item.type,
        fixedAmount: item.fixedAmount,
        percentageRate: item.percentageRate,
        baseAmount: item.baseAmount,
      });
    } else if (!this.isMulti()) {
      this.form.reset({ description: '', type: 'fixed', fixedAmount: null, percentageRate: null, baseAmount: null });
    }
  }

  close() { this.closed.emit(); }

  onOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) this.close();
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.isSaving()) return;

    const v = this.form.getRawValue();
    const payload = {
      month: this.month(),
      description: v.description,
      type: v.type,
      fixedAmount: v.fixedAmount ?? undefined,
      percentageRate: v.percentageRate ?? undefined,
      baseAmount: v.baseAmount ?? undefined,
    };

    // Multi-assign: delegate to parent
    if (this.isMulti()) {
      this.multiSaved.emit(payload);
      return;
    }

    // Single-assign: create or update locally
    const emp = this.employee();
    if (!emp) return;
    this.localSaving.set(true);

    const item = this.editItem();
    const obs$ = item
      ? this.api.updateWorkOrder(item.id, {
          description: v.description,
          type: v.type,
          fixedAmount: v.fixedAmount ?? undefined,
          percentageRate: v.percentageRate ?? undefined,
          baseAmount: v.baseAmount ?? undefined,
        })
      : this.api.createWorkOrder({
          ...payload,
          ...(emp.type === 'seller' ? { sellerId: Number(emp.id) } : { setterId: Number(emp.id) }),
        });

    obs$.subscribe({
      next: () => {
        this.localSaving.set(false);
        this.toast.success(item ? 'Commessa aggiornata' : 'Commessa aggiunta');
        this.form.reset({ description: '', type: 'fixed', fixedAmount: null, percentageRate: null, baseAmount: null });
        this.saved.emit();
      },
      error: () => {
        this.localSaving.set(false);
        this.toast.error('Errore durante il salvataggio');
      },
    });
  }
}
