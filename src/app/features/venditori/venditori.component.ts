import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AuthApiService, UserDto } from '../../auth/auth-api.service';
import { LeadsService } from '../../leads/lead.service';
import { ToastService } from '../../shared/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { AvatarComponent } from '../../shared/avatar.component';
import { Seller } from '../../models';

const SELLER_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6'];

function toDisplaySeller(s: { id: number; name: string | null; lastName: string | null }, idx: number): Seller {
  const name = [s.name, s.lastName].filter(Boolean).join(' ') || '—';
  const initials = ((s.name ?? '').charAt(0) + (s.lastName ?? '').charAt(0)).toUpperCase() || '?';
  return { id: String(s.id), name, initials, color: SELLER_COLORS[idx % SELLER_COLORS.length], role: 'Venditore' };
}

interface SellerWithAccount {
  id: number;
  name: string;
  email: string | null;
  percentage: number | null;
  seller: Seller;
  user: UserDto | null;
}

@Component({
  selector: 'app-venditori',
  imports: [IconComponent, AvatarComponent],
  styleUrl: './venditori.component.css',
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Venditori <span class="muted-pill">admin</span></h1>
          <p class="page-sub">Gestione venditori e account di accesso al portale</p>
        </div>
      </div>

      @if (isLoading()) {
        <div class="empty"><span>Caricamento…</span></div>
      } @else {
        <div class="sellers-grid">
          @for (s of sellersWithAccounts(); track s.id) {
            <div class="seller-card">
              <div class="sc-head">
                <app-avatar [seller]="s.seller" [size]="44" />
                <div class="sc-info">
                  <div class="sc-name">{{ s.name }}</div>
                  <div class="sc-email">{{ s.email ?? '—' }}</div>
                </div>
                <div class="sc-pct" [class.no-pct]="!s.percentage">
                  {{ s.percentage ? s.percentage + '%' : '—' }}
                </div>
              </div>

              <div class="sc-account">
                @if (s.user) {
                  <div class="acc-row">
                    <span class="acc-badge" [class.inactive]="!s.user.isActive">
                      @if (s.user.isActive) { Attivo } @else { Disattivato }
                    </span>
                    <span class="acc-email">{{ s.user.email }}</span>
                  </div>
                  @if (s.user.isActive) {
                    <button class="btn-ghost btn-sm danger"
                            [disabled]="acting() === s.id"
                            (click)="deactivate(s)">
                      @if (acting() === s.id) { … }
                      @else { Disattiva accesso }
                    </button>
                  } @else {
                    <span class="acc-note">Account disattivato</span>
                  }
                } @else {
                  <span class="acc-badge no-acc">Nessun account</span>
                  <button class="btn-primary btn-sm"
                          [disabled]="acting() === s.id"
                          (click)="openCreate(s)">
                    <app-icon name="plus" [size]="13" />
                    Crea account
                  </button>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>

    @if (createTarget()) {
      <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Crea account"
           (click)="createTarget.set(null)" (keydown.escape)="createTarget.set(null)">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <div>
              <div class="modal-title">Crea account per {{ createTarget()!.name }}</div>
              <div class="modal-sub">Il venditore potrà accedere al portale con queste credenziali</div>
            </div>
            <button class="icon-btn" (click)="createTarget.set(null)" aria-label="Chiudi">
              <app-icon name="x" [size]="18" />
            </button>
          </div>

          <div class="modal-field">
            <label class="ap-label" for="cr-email">Email</label>
            <input id="cr-email" class="modal-input" type="email"
                   [value]="newEmail()"
                   (input)="newEmail.set($any($event.target).value)"
                   placeholder="email@esempio.com" />
          </div>
          <div class="modal-field">
            <label class="ap-label" for="cr-pwd">Password</label>
            <input id="cr-pwd" class="modal-input" type="text"
                   [value]="newPassword()"
                   (input)="newPassword.set($any($event.target).value)"
                   placeholder="Imprendig2026!" />
            <span class="field-hint">Comunica la password al venditore dopo la creazione</span>
          </div>

          <div class="modal-footer">
            <button class="btn-ghost" (click)="createTarget.set(null)">Annulla</button>
            <button class="btn-primary" [disabled]="!canCreate() || creating()" (click)="submitCreate()">
              @if (creating()) { Creazione… } @else { Crea account }
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class VenditoriComponent {
  private readonly authApi = inject(AuthApiService);
  private readonly leadsService = inject(LeadsService);
  private readonly toast = inject(ToastService);

  readonly sellersResource = rxResource({ stream: () => this.leadsService.getSellers() });
  readonly usersResource = rxResource({ stream: () => this.authApi.getUsers() });

  readonly isLoading = computed(() => this.sellersResource.isLoading() || this.usersResource.isLoading());

  readonly sellersWithAccounts = computed<SellerWithAccount[]>(() => {
    const sellers = this.sellersResource.value() ?? [];
    const users = this.usersResource.value() ?? [];
    return sellers.map((s, idx) => {
      const user = users.find(u => Number(u.seller?.id) === Number(s.id)) ?? null;
      return {
        id: s.id,
        name: [s.name, s.lastName].filter(Boolean).join(' ') || '—',
        email: (s as any).email ?? null,
        percentage: (s as any).percentage ?? null,
        seller: toDisplaySeller(s, idx),
        user,
      };
    });
  });

  readonly acting = signal<number | null>(null);

  // ── Create modal ────────────────────────────────────────────────────
  readonly createTarget = signal<SellerWithAccount | null>(null);
  readonly newEmail = signal('');
  readonly newPassword = signal('Imprendig2026!');
  readonly creating = signal(false);

  readonly canCreate = computed(() => !!this.newEmail().includes('@') && this.newPassword().length >= 6);

  openCreate(s: SellerWithAccount): void {
    this.newEmail.set(s.email ?? '');
    this.newPassword.set('Imprendig2026!');
    this.createTarget.set(s);
  }

  submitCreate(): void {
    const target = this.createTarget();
    if (!target || !this.canCreate()) return;

    this.creating.set(true);
    this.authApi.register({
      email: this.newEmail().trim(),
      password: this.newPassword(),
      role: 'venditore',
      sellerId: target.id,
    }).subscribe({
      next: () => {
        this.creating.set(false);
        this.createTarget.set(null);
        this.toast.success(`Account creato per ${target.name}`);
        this.usersResource.reload();
      },
      error: (err) => {
        this.creating.set(false);
        const msg = err?.error?.message ?? 'Errore durante la creazione';
        this.toast.error(msg);
      },
    });
  }

  deactivate(s: SellerWithAccount): void {
    if (!s.user) return;
    this.acting.set(s.id);
    this.authApi.deactivate(s.user.id).subscribe({
      next: () => {
        this.acting.set(null);
        this.toast.success(`Accesso disattivato per ${s.name}`);
        this.usersResource.reload();
      },
      error: () => {
        this.acting.set(null);
        this.toast.error('Impossibile disattivare. Riprova.');
      },
    });
  }
}
