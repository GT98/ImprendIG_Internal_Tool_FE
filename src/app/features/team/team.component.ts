import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { SellerApiService, SellerDto } from '../../seller/seller-api.service';
import { SetterApiService, SetterDto } from '../../setter/setter-api.service';
import { AuthApiService, UserDto } from '../../auth/auth-api.service';
import { ToastService } from '../../shared/toast.service';
import { IconComponent } from '../../shared/icon.component';

type Tab = 'venditori' | 'setter';

interface EditState {
  name: string;
  lastName: string;
  email: string;
  percentage: number;
  telegramId: string;
}

function emptyEdit(): EditState {
  return { name: '', lastName: '', email: '', percentage: 0, telegramId: '' };
}

function initials(name: string | null, lastName: string | null): string {
  return ((name?.[0] ?? '') + (lastName?.[0] ?? '')).toUpperCase() || '?';
}

function fullName(name: string | null, lastName: string | null): string {
  return [name, lastName].filter(Boolean).join(' ') || '—';
}

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6', '#f97316'];

@Component({
  selector: 'app-team',
  imports: [IconComponent, NgTemplateOutlet],
  styleUrl: './team.component.css',
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Team <span class="muted-pill">admin</span></h1>
          <p class="page-sub">Gestione venditori, setter e account di accesso al portale</p>
        </div>
        <button class="btn-primary" (click)="openNew()">
          <app-icon name="plus" [size]="15" />
          Nuovo {{ activeTab() === 'venditori' ? 'venditore' : 'setter' }}
        </button>
      </div>

      <!-- Tabs -->
      <div class="tab-row" role="tablist">
        <button role="tab" [class.active]="activeTab() === 'venditori'"
                [attr.aria-selected]="activeTab() === 'venditori'"
                (click)="setTab('venditori')">
          Venditori
          <span class="tab-count">{{ (sellersResource.value() ?? []).length }}</span>
        </button>
        <button role="tab" [class.active]="activeTab() === 'setter'"
                [attr.aria-selected]="activeTab() === 'setter'"
                (click)="setTab('setter')">
          Setter
          <span class="tab-count">{{ (settersResource.value() ?? []).length }}</span>
        </button>
      </div>

      @if (isLoading()) {
        <div class="empty"><span>Caricamento…</span></div>
      } @else {

        <!-- ──── VENDITORI TAB ──── -->
        @if (activeTab() === 'venditori') {
          <div class="team-list">
            <div class="list-header">
              <span class="col-person">Venditore</span>
              <span class="col-pct">%</span>
              <span class="col-telegram">Telegram</span>
              <span class="col-account">Account</span>
              <span class="col-actions"></span>
            </div>

            @if (editId() === 'new') {
              <div class="team-row editing">
                <ng-container *ngTemplateOutlet="editForm; context: { label: 'Crea venditore', onSave: saveNewSeller.bind(this) }" />
              </div>
            }

            @for (s of sellers(); track s.id; let idx = $index) {
              @if (editId() === s.id) {
                <div class="team-row editing">
                  <ng-container *ngTemplateOutlet="editForm; context: { label: 'Salva', onSave: saveSellerById.bind(this, s.id) }" />
                </div>
              } @else {
                <div class="team-row">
                  <div class="col-person person-cell">
                    <div class="avatar-sm" [style.background]="COLORS[idx % COLORS.length]">
                      {{ initials(s.name, s.lastName) }}
                    </div>
                    <div class="person-info">
                      <span class="person-name">{{ fullName(s.name, s.lastName) }}</span>
                      @if (s.email) { <span class="person-sub">{{ s.email }}</span> }
                    </div>
                  </div>
                  <div class="col-pct pct-cell">{{ s.percentage ?? '—' }}{{ s.percentage ? '%' : '' }}</div>
                  <div class="col-telegram meta-cell">{{ s.telegramId ?? '—' }}</div>
                  <div class="col-account">
                    @if (accountFor(s.id); as u) {
                      <span class="acc-chip" [class.inactive]="!u.isActive">
                        {{ u.isActive ? 'Attivo' : 'Disattivato' }}
                      </span>
                      @if (u.isActive) {
                        <button class="link-btn danger" [disabled]="acting() === s.id"
                                (click)="deactivateAccount(s.id, u)">
                          Disattiva
                        </button>
                      }
                    } @else {
                      <button class="link-btn" [disabled]="acting() === s.id"
                              (click)="openCreateAccount(s)">
                        + Account
                      </button>
                    }
                  </div>
                  <div class="col-actions row-actions">
                    <button class="icon-btn" title="Modifica" (click)="openEditSeller(s)">
                      <app-icon name="edit" [size]="14" />
                    </button>
                    <button class="icon-btn danger" title="Elimina" [disabled]="deleting() === s.id"
                            (click)="removeSeller(s.id)">
                      <app-icon name="trash" [size]="14" />
                    </button>
                  </div>
                </div>
              }
            }

            @if (sellers().length === 0 && editId() !== 'new') {
              <div class="empty-row">Nessun venditore. Clicca "Nuovo venditore" per aggiungerne uno.</div>
            }
          </div>
        }

        <!-- ──── SETTER TAB ──── -->
        @if (activeTab() === 'setter') {
          <div class="team-list">
            <div class="list-header">
              <span class="col-person">Setter</span>
              <span class="col-pct">%</span>
              <span class="col-telegram">Telegram</span>
              <span class="col-actions"></span>
            </div>

            @if (editId() === 'new') {
              <div class="team-row editing">
                <ng-container *ngTemplateOutlet="editForm; context: { label: 'Crea setter', onSave: saveNewSetter.bind(this) }" />
              </div>
            }

            @for (s of setters(); track s.id; let idx = $index) {
              @if (editId() === s.id) {
                <div class="team-row editing">
                  <ng-container *ngTemplateOutlet="editForm; context: { label: 'Salva', onSave: saveSetterById.bind(this, s.id) }" />
                </div>
              } @else {
                <div class="team-row">
                  <div class="col-person person-cell">
                    <div class="avatar-sm setter-av" [style.background]="COLORS[idx % COLORS.length]">
                      {{ initials(s.name, s.lastName) }}
                    </div>
                    <div class="person-info">
                      <span class="person-name">{{ fullName(s.name, s.lastName) }}</span>
                      @if (s.email) { <span class="person-sub">{{ s.email }}</span> }
                    </div>
                  </div>
                  <div class="col-pct pct-cell">{{ s.percentage ?? '—' }}{{ s.percentage ? '%' : '' }}</div>
                  <div class="col-telegram meta-cell">{{ s.telegramId ?? '—' }}</div>
                  <div class="col-actions row-actions">
                    <button class="icon-btn" title="Modifica" (click)="openEditSetter(s)">
                      <app-icon name="edit" [size]="14" />
                    </button>
                    <button class="icon-btn danger" title="Elimina" [disabled]="deleting() === s.id"
                            (click)="removeSetter(s.id)">
                      <app-icon name="trash" [size]="14" />
                    </button>
                  </div>
                </div>
              }
            }

            @if (setters().length === 0 && editId() !== 'new') {
              <div class="empty-row">Nessun setter. Clicca "Nuovo setter" per aggiungerne uno.</div>
            }
          </div>
        }
      }
    </div>

    <!-- ── Shared edit form template ── -->
    <ng-template #editForm let-label="label" let-onSave="onSave">
      <div class="edit-grid">
        <label class="ef-field">
          <span>Nome</span>
          <input type="text" [value]="editState()!.name"
                 (input)="patch('name', $any($event.target).value)" />
        </label>
        <label class="ef-field">
          <span>Cognome</span>
          <input type="text" [value]="editState()!.lastName"
                 (input)="patch('lastName', $any($event.target).value)" />
        </label>
        <label class="ef-field">
          <span>Email</span>
          <input type="email" [value]="editState()!.email"
                 (input)="patch('email', $any($event.target).value)" />
        </label>
        <label class="ef-field ef-narrow">
          <span>% commissione</span>
          <input type="number" min="0" max="100" step="0.5"
                 [value]="editState()!.percentage"
                 (input)="patch('percentage', +$any($event.target).value)" />
        </label>
        <label class="ef-field ef-full">
          <span>Telegram ID</span>
          <input type="text" [value]="editState()!.telegramId"
                 placeholder="@username"
                 (input)="patch('telegramId', $any($event.target).value)" />
        </label>
      </div>
      <div class="ef-actions">
        <button class="btn-ghost" (click)="cancelEdit()">Annulla</button>
        <button class="btn-primary" [disabled]="saving()" (click)="onSave()">
          {{ saving() ? 'Salvataggio…' : label }}
        </button>
      </div>
    </ng-template>

    <!-- ── Account creation modal ── -->
    @if (accountTarget()) {
      <div class="modal-overlay" role="dialog" aria-modal="true"
           (click)="accountTarget.set(null)" (keydown.escape)="accountTarget.set(null)">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <div>
              <div class="modal-title">Crea account — {{ fullName(accountTarget()!.name, accountTarget()!.lastName) }}</div>
              <div class="modal-sub">Il venditore potrà accedere al portale con queste credenziali</div>
            </div>
            <button class="icon-btn" (click)="accountTarget.set(null)" aria-label="Chiudi">
              <app-icon name="x" [size]="18" />
            </button>
          </div>

          <div class="modal-field">
            <label class="ap-label" for="acc-email">Email</label>
            <input id="acc-email" class="modal-input" type="email"
                   [value]="accEmail()"
                   (input)="accEmail.set($any($event.target).value)"
                   placeholder="email@esempio.com" />
          </div>
          <div class="modal-field">
            <label class="ap-label" for="acc-pwd">Password</label>
            <input id="acc-pwd" class="modal-input" type="text"
                   [value]="accPassword()"
                   (input)="accPassword.set($any($event.target).value)" />
            <span class="field-hint">Comunica la password al venditore dopo la creazione</span>
          </div>

          <div class="modal-footer">
            <button class="btn-ghost" (click)="accountTarget.set(null)">Annulla</button>
            <button class="btn-primary" [disabled]="!canCreateAcc() || creatingAcc()"
                    (click)="submitCreateAccount()">
              {{ creatingAcc() ? 'Creazione…' : 'Crea account' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class TeamComponent {
  protected readonly COLORS = COLORS;
  protected readonly initials = initials;
  protected readonly fullName = fullName;

  private readonly sellerApi = inject(SellerApiService);
  private readonly setterApi = inject(SetterApiService);
  private readonly authApi = inject(AuthApiService);
  private readonly toast = inject(ToastService);

  // ── Resources ─────────────────────────────────────────────────────
  readonly sellersResource = rxResource({ stream: () => this.sellerApi.getAll() });
  readonly settersResource = rxResource({ stream: () => this.setterApi.getAll() });
  readonly usersResource   = rxResource({ stream: () => this.authApi.getUsers() });

  readonly sellers = computed(() => this.sellersResource.value() ?? []);
  readonly setters = computed(() => this.settersResource.value() ?? []);

  readonly isLoading = computed(() =>
    this.sellersResource.isLoading() || this.settersResource.isLoading()
  );

  accountFor(sellerId: number): UserDto | null {
    return (this.usersResource.value() ?? []).find(
      u => Number(u.seller?.id) === Number(sellerId)
    ) ?? null;
  }

  // ── Tab ────────────────────────────────────────────────────────────
  readonly activeTab = signal<Tab>('venditori');

  setTab(tab: Tab): void {
    this.cancelEdit();
    this.activeTab.set(tab);
  }

  // ── Inline edit ────────────────────────────────────────────────────
  readonly editId    = signal<number | 'new' | null>(null);
  readonly editState = signal<EditState | null>(null);
  readonly saving    = signal(false);
  readonly deleting  = signal<number | null>(null);
  readonly acting    = signal<number | null>(null);

  openNew(): void {
    this.editId.set('new');
    this.editState.set(emptyEdit());
  }

  openEditSeller(s: SellerDto): void {
    this.editId.set(s.id);
    this.editState.set({
      name: s.name ?? '', lastName: s.lastName ?? '',
      email: s.email ?? '', percentage: s.percentage ?? 0,
      telegramId: s.telegramId ?? '',
    });
  }

  openEditSetter(s: SetterDto): void {
    this.editId.set(s.id);
    this.editState.set({
      name: s.name ?? '', lastName: s.lastName ?? '',
      email: s.email ?? '', percentage: s.percentage ?? 3,
      telegramId: s.telegramId ?? '',
    });
  }

  cancelEdit(): void {
    this.editId.set(null);
    this.editState.set(null);
  }

  patch(field: keyof EditState, value: string | number): void {
    this.editState.update(s => s ? { ...s, [field]: value } : s);
  }

  private buildDto(): Partial<Omit<SellerDto, 'id' | 'createdAt'>> {
    const s = this.editState()!;
    return {
      name: s.name || undefined,
      lastName: s.lastName || undefined,
      email: s.email || undefined,
      percentage: s.percentage || undefined,
      telegramId: s.telegramId || undefined,
    };
  }

  saveNewSeller(): void {
    if (!this.editState()) return;
    this.saving.set(true);
    this.sellerApi.create(this.buildDto()).subscribe({
      next: () => { this.saving.set(false); this.cancelEdit(); this.sellersResource.reload(); this.toast.success('Venditore creato'); },
      error: () => { this.saving.set(false); this.toast.error('Impossibile creare. Riprova.'); },
    });
  }

  saveSellerById(id: number): void {
    if (!this.editState()) return;
    this.saving.set(true);
    this.sellerApi.update(id, this.buildDto()).subscribe({
      next: () => { this.saving.set(false); this.cancelEdit(); this.sellersResource.reload(); this.toast.success('Venditore aggiornato'); },
      error: () => { this.saving.set(false); this.toast.error('Impossibile salvare. Riprova.'); },
    });
  }

  removeSeller(id: number): void {
    this.deleting.set(id);
    this.sellerApi.remove(id).subscribe({
      next: () => { this.deleting.set(null); this.sellersResource.reload(); this.toast.success('Venditore eliminato'); },
      error: () => { this.deleting.set(null); this.toast.error('Impossibile eliminare. Riprova.'); },
    });
  }

  saveNewSetter(): void {
    if (!this.editState()) return;
    this.saving.set(true);
    this.setterApi.create(this.buildDto()).subscribe({
      next: () => { this.saving.set(false); this.cancelEdit(); this.settersResource.reload(); this.toast.success('Setter creato'); },
      error: () => { this.saving.set(false); this.toast.error('Impossibile creare. Riprova.'); },
    });
  }

  saveSetterById(id: number): void {
    if (!this.editState()) return;
    this.saving.set(true);
    this.setterApi.update(id, this.buildDto()).subscribe({
      next: () => { this.saving.set(false); this.cancelEdit(); this.settersResource.reload(); this.toast.success('Setter aggiornato'); },
      error: () => { this.saving.set(false); this.toast.error('Impossibile salvare. Riprova.'); },
    });
  }

  removeSetter(id: number): void {
    this.deleting.set(id);
    this.setterApi.remove(id).subscribe({
      next: () => { this.deleting.set(null); this.settersResource.reload(); this.toast.success('Setter eliminato'); },
      error: () => { this.deleting.set(null); this.toast.error('Impossibile eliminare. Riprova.'); },
    });
  }

  // ── Account management ─────────────────────────────────────────────
  readonly accountTarget = signal<SellerDto | null>(null);
  readonly accEmail      = signal('');
  readonly accPassword   = signal('Imprendig2026!');
  readonly creatingAcc   = signal(false);

  readonly canCreateAcc = computed(() =>
    this.accEmail().includes('@') && this.accPassword().length >= 6
  );

  openCreateAccount(s: SellerDto): void {
    this.accEmail.set(s.email ?? '');
    this.accPassword.set('Imprendig2026!');
    this.accountTarget.set(s);
  }

  submitCreateAccount(): void {
    const target = this.accountTarget();
    if (!target || !this.canCreateAcc()) return;
    this.creatingAcc.set(true);
    this.authApi.register({
      email: this.accEmail().trim(),
      password: this.accPassword(),
      role: 'venditore',
      sellerId: Number(target.id),
    }).subscribe({
      next: () => {
        this.creatingAcc.set(false);
        this.accountTarget.set(null);
        this.toast.success(`Account creato per ${fullName(target.name, target.lastName)}`);
        this.usersResource.reload();
      },
      error: (err) => {
        this.creatingAcc.set(false);
        this.toast.error(err?.error?.message ?? 'Errore durante la creazione');
      },
    });
  }

  deactivateAccount(sellerId: number, user: UserDto): void {
    this.acting.set(sellerId);
    this.authApi.deactivate(user.id).subscribe({
      next: () => { this.acting.set(null); this.toast.success('Accesso disattivato'); this.usersResource.reload(); },
      error: () => { this.acting.set(null); this.toast.error('Impossibile disattivare. Riprova.'); },
    });
  }
}
