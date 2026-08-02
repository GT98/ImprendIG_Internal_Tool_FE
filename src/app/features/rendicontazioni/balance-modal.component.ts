import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/toast.service';
import { ReportingApiService, EmployeeInfo } from '../../reporting/reporting-api.service';

@Component({
  selector: 'app-balance-modal',
  imports: [ReactiveFormsModule, IconComponent],
  template: `
    @if (visible()) {
      <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="bal-title"
           (click)="onOverlayClick($event)">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h2 id="bal-title">Aggiusta saldo — {{ employee().name }}</h2>
            <button class="close-btn" aria-label="Chiudi" (click)="close()">
              <app-icon name="x" [size]="16" />
            </button>
          </div>
          <form [formGroup]="form" (ngSubmit)="submit()" class="modal-body">
            <div class="balance-current">
              Saldo attuale: <strong [class.neg]="currentBalance() < 0" [class.pos]="currentBalance() > 0">
                {{ currentBalance() >= 0 ? '+' : '' }}€ {{ currentBalance().toFixed(2) }}
              </strong>
            </div>
            <div class="field">
              <label>Tipo operazione</label>
              <div class="toggle-group" role="group">
                <button type="button" class="toggle-opt" [class.active]="mode() === 'add'"
                        (click)="mode.set('add')">+ Credito</button>
                <button type="button" class="toggle-opt danger" [class.active]="mode() === 'sub'"
                        (click)="mode.set('sub')">− Debito</button>
              </div>
            </div>
            <div class="field">
              <label for="bal-amount">Importo (€) <span class="req">*</span></label>
              <input id="bal-amount" type="number" min="0.01" step="0.01"
                     formControlName="amount" placeholder="0.00" />
            </div>
            <div class="field">
              <label for="bal-notes">Note</label>
              <input id="bal-notes" type="text" formControlName="notes"
                     placeholder="es. Anticipo di luglio" />
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-ghost" (click)="close()">Annulla</button>
              <button type="submit" class="btn-primary" [disabled]="form.invalid || saving()">
                {{ saving() ? 'Salvataggio…' : 'Applica' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    .overlay { position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px; }
    .modal { background:#fff;border-radius:14px;width:100%;max-width:400px;max-height:90dvh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,.18); }
    .modal-head { display:flex;align-items:center;justify-content:space-between;padding:20px 24px 0; }
    .modal-head h2 { font-size:15px;font-weight:600;margin:0; }
    .close-btn { background:none;border:none;cursor:pointer;color:#888;padding:4px;border-radius:6px;display:flex; }
    .modal-body { padding:20px 24px;display:flex;flex-direction:column;gap:14px; }
    .balance-current { font-size:14px;color:#555;padding:10px 14px;background:#f9fafb;border-radius:8px; }
    .balance-current strong { font-size:16px; }
    .neg { color:#dc2626; }
    .pos { color:#16a34a; }
    .field { display:flex;flex-direction:column;gap:5px; }
    .field label { font-size:13px;font-weight:500;color:#444; }
    .req { color:#e53e3e; }
    .field input { padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;outline:none; }
    .field input:focus { border-color:var(--accent,#4f46e5); }
    .toggle-group { display:flex;gap:6px;margin-top:2px; }
    .toggle-opt { padding:6px 16px;border-radius:20px;border:1.5px solid #e5e7eb;background:transparent;color:#444;font-size:13px;font-weight:600;cursor:pointer;transition:.15s; }
    .toggle-opt.active { background:var(--accent,#4f46e5);border-color:var(--accent,#4f46e5);color:#fff; }
    .toggle-opt.danger.active { background:#dc2626;border-color:#dc2626; }
    .modal-footer { display:flex;justify-content:flex-end;gap:10px;margin-top:4px; }
    .btn-ghost { background:none;border:1px solid #e5e7eb;border-radius:8px;padding:8px 16px;font-size:14px;cursor:pointer;color:#444; }
    .btn-primary { background:var(--accent,#4f46e5);color:#fff;border:none;border-radius:8px;padding:8px 20px;font-size:14px;font-weight:500;cursor:pointer; }
    .btn-primary:disabled { opacity:.55;cursor:not-allowed; }
  `],
})
export class BalanceModalComponent {
  readonly visible = input.required<boolean>();
  readonly employee = input.required<EmployeeInfo>();
  readonly currentBalance = input<number>(0);
  readonly saved = output<void>();
  readonly closed = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ReportingApiService);
  private readonly toast = inject(ToastService);

  readonly saving = signal(false);
  readonly mode = signal<'add' | 'sub'>('add');

  readonly form = this.fb.nonNullable.group({
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    notes: [''],
  });

  close() { this.closed.emit(); }

  onOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) this.close();
  }

  submit() {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const delta = this.mode() === 'add' ? (v.amount ?? 0) : -(v.amount ?? 0);
    const emp = this.employee();

    this.saving.set(true);
    this.api.adjustBalance(emp.type, emp.id, { delta, notes: v.notes || undefined }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Saldo aggiornato');
        this.form.reset({ amount: null, notes: '' });
        this.saved.emit();
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Errore durante l\'aggiornamento del saldo');
      },
    });
  }
}
