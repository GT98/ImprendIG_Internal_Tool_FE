import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { WixRoutingApiService, WixRoutingRuleDto } from './wix-routing-api.service';
import { SetterApiService, SetterDto } from '../../setter/setter-api.service';
import { SellerApiService, SellerDto } from '../../seller/seller-api.service';
import { ToastService } from '../../shared/toast.service';
import { IconComponent } from '../../shared/icon.component';

interface FormState {
  wixServiceId: string;
  wixServiceName: string;
  defaultSetterId: number | null;
  defaultSellerId: number | null;
}

function emptyForm(): FormState {
  return { wixServiceId: '', wixServiceName: '', defaultSetterId: null, defaultSellerId: null };
}

function personName(p: { name: string | null; lastName: string | null } | null): string {
  if (!p) return '—';
  return [p.name, p.lastName].filter(Boolean).join(' ') || '—';
}

@Component({
  selector: 'app-wix-routing',
  imports: [IconComponent],
  templateUrl: './wix-routing.component.html',
  styleUrl: './wix-routing.component.css',
})
export class WixRoutingComponent {
  private readonly api = inject(WixRoutingApiService);
  private readonly setterApi = inject(SetterApiService);
  private readonly sellerApi = inject(SellerApiService);
  private readonly toast = inject(ToastService);

  readonly rulesResource = rxResource({ stream: () => this.api.getAll() });
  readonly settersResource = rxResource({ stream: () => this.setterApi.getAll() });
  readonly sellersResource = rxResource({ stream: () => this.sellerApi.getAll() });

  readonly rules = computed(() => this.rulesResource.value() ?? []);
  readonly setters = computed(() => this.settersResource.value() ?? []);
  readonly sellers = computed(() => this.sellersResource.value() ?? []);

  readonly showForm = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly form = signal<FormState>(emptyForm());
  readonly saving = signal(false);
  readonly deleting = signal<number | null>(null);

  readonly personName = personName;

  get saveLabel(): string {
    if (this.saving()) return 'Salvataggio…';
    return this.editingId() ? 'Salva modifiche' : 'Crea regola';
  }

  setterName(id: number | null): string {
    if (!id) return '—';
    const s = this.setters().find(x => Number(x.id) === id);
    return s ? personName(s) : '—';
  }

  sellerName(id: number | null): string {
    if (!id) return '—';
    const s = this.sellers().find(x => Number(x.id) === id);
    return s ? personName(s) : '—';
  }

  openNew(): void {
    this.editingId.set(null);
    this.form.set(emptyForm());
    this.showForm.set(true);
  }

  openEdit(rule: WixRoutingRuleDto): void {
    this.editingId.set(rule.id);
    this.form.set({
      wixServiceId: rule.wixServiceId,
      wixServiceName: rule.wixServiceName ?? '',
      defaultSetterId: rule.defaultSetter ? Number(rule.defaultSetter.id) : null,
      defaultSellerId: rule.defaultSeller ? Number(rule.defaultSeller.id) : null,
    });
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  patch(field: keyof FormState, value: string | number | null): void {
    this.form.update(f => ({ ...f, [field]: value }));
  }

  save(): void {
    const f = this.form();
    if (!f.wixServiceId.trim()) {
      this.toast.error('Service ID obbligatorio');
      return;
    }
    this.saving.set(true);
    this.api.upsert({
      wixServiceId: f.wixServiceId.trim(),
      wixServiceName: f.wixServiceName.trim() || null,
      defaultSetterId: f.defaultSetterId,
      defaultSellerId: f.defaultSellerId,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.cancelForm();
        this.rulesResource.reload();
        this.toast.success('Regola salvata');
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Impossibile salvare. Riprova.');
      },
    });
  }

  remove(id: number): void {
    this.deleting.set(id);
    this.api.remove(id).subscribe({
      next: () => {
        this.deleting.set(null);
        this.rulesResource.reload();
        this.toast.success('Regola eliminata');
      },
      error: () => {
        this.deleting.set(null);
        this.toast.error('Impossibile eliminare. Riprova.');
      },
    });
  }
}
