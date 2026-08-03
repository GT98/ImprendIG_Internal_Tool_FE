import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { SellerApiService } from '../../seller/seller-api.service';
import { ReportingApiService } from '../../reporting/reporting-api.service';
import { IconComponent } from '../../shared/icon.component';
import { AvatarComponent } from '../../shared/avatar.component';
import type { Seller } from '../../models';

@Component({
  selector: 'app-profile',
  imports: [IconComponent, AvatarComponent],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Il mio profilo</h1>
          <p class="page-sub">Le tue informazioni e il tuo saldo.</p>
        </div>
      </div>

      <div class="profile-layout">

        <!-- Identity card -->
        <div class="card profile-card">
          <div class="profile-hero">
            <app-avatar [seller]="avatarSeller()" [size]="64" />
            <div class="profile-identity">
              <div class="profile-fullname">{{ displayName() }}</div>
              <div class="profile-email">{{ auth.currentUser()?.email }}</div>
              <span class="role-badge" [class.admin]="isAdmin()">
                {{ roleLabel() }}
              </span>
            </div>
          </div>
        </div>

        <!-- Seller details -->
        @if (sellersResource.isLoading()) {
          <div class="card"><div class="loading-row"><span class="spinner"></span> Caricamento dati venditore…</div></div>
        } @else if (mySeller()) {
          <div class="card">
            <div class="card-head">
              <span class="card-title">Dati venditore</span>
            </div>
            <div class="profile-fields">
              <div class="field-row">
                <span class="field-label"><app-icon name="users" [size]="14" /> Nome</span>
                <span class="field-val">{{ sellerFullName() }}</span>
              </div>
              @if (mySeller()!.percentage !== null) {
                <div class="field-row">
                  <span class="field-label"><app-icon name="chart" [size]="14" /> Commissione</span>
                  <span class="field-val">{{ mySeller()!.percentage }}%</span>
                </div>
              }
              @if (mySeller()!.telegramId) {
                <div class="field-row">
                  <span class="field-label"><app-icon name="send" [size]="14" /> Telegram ID</span>
                  <span class="field-val mono">{{ mySeller()!.telegramId }}</span>
                </div>
              }
              <div class="field-row">
                <span class="field-label"><app-icon name="calendar" [size]="14" /> Membro dal</span>
                <span class="field-val">{{ formatDate(mySeller()!.createdAt) }}</span>
              </div>
            </div>
          </div>
        } @else if (!sellersResource.isLoading() && auth.currentUser()?.sellerId) {
          <div class="card muted-card">Profilo venditore non trovato.</div>
        }

        <!-- Balance -->
        @if (auth.currentUser()?.sellerId) {
          <div class="card">
            <div class="card-head">
              <span class="card-title">Saldo</span>
              <span class="card-sub">credito o debito con l'azienda</span>
            </div>
            @if (balanceResource.isLoading()) {
              <div class="loading-row"><span class="spinner"></span> Caricamento saldo…</div>
            } @else if (balanceResource.error()) {
              <div class="muted-card">Nessun saldo registrato.</div>
            } @else {
              <div class="balance-display" [class.credit]="(balanceResource.value()?.current ?? 0) >= 0" [class.debit]="(balanceResource.value()?.current ?? 0) < 0">
                <app-icon [name]="(balanceResource.value()?.current ?? 0) >= 0 ? 'arrowUp' : 'arrowDown'" [size]="22" />
                <div>
                  <div class="balance-amount">{{ formatBalance(balanceResource.value()?.current ?? 0) }}</div>
                  <div class="balance-label">{{ (balanceResource.value()?.current ?? 0) >= 0 ? 'Credito' : 'Debito' }}</div>
                </div>
              </div>
              @if (balanceResource.value()?.notes) {
                <div class="balance-notes">
                  <app-icon name="info" [size]="13" /> {{ balanceResource.value()!.notes }}
                </div>
              }
            }
          </div>
        }

      </div>
    </div>
  `,
  styles: [`
    .profile-layout {
      display: flex; flex-direction: column; gap: 16px; max-width: 520px;
    }

    .profile-card { padding: 22px; }
    .profile-hero {
      display: flex; align-items: center; gap: 18px;
    }
    .profile-identity { flex: 1; min-width: 0; }
    .profile-fullname { font-size: 18px; font-weight: 800; letter-spacing: -.01em; }
    .profile-email { font-size: 13px; color: var(--ink-3); margin: 2px 0 8px; }
    .role-badge {
      display: inline-block; font-size: 11px; font-weight: 700;
      padding: 3px 10px; border-radius: 20px;
      background: var(--surface-2); color: var(--ink-2);
      border: 1px solid var(--border); text-transform: capitalize;
    }
    .role-badge.admin { background: var(--accent-soft); color: var(--accent); border-color: var(--accent-soft-2, #c7d2fe); }

    .profile-fields { display: flex; flex-direction: column; gap: 0; margin-top: 4px; }
    .field-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 0; border-bottom: 1px solid var(--border-2, #f3f4f6);
    }
    .field-row:last-child { border-bottom: none; }
    .field-label { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--ink-3); font-weight: 500; }
    .field-val { font-size: 13px; font-weight: 600; color: var(--ink); }
    .field-val.mono { font-family: var(--mono); }

    .balance-display {
      display: flex; align-items: center; gap: 14px;
      padding: 16px; border-radius: 10px; margin-top: 4px;
    }
    .balance-display.credit { background: #f0fdf4; color: #15803d; }
    .balance-display.debit { background: #fef2f2; color: #b91c1c; }
    .balance-amount { font-size: 22px; font-weight: 800; font-family: var(--mono); }
    .balance-label { font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
    .balance-notes {
      display: flex; align-items: center; gap: 6px;
      margin-top: 10px; font-size: 12px; color: var(--ink-3);
    }

    .loading-row {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 0; font-size: 13px; color: var(--ink-3);
    }
    .muted-card { font-size: 13px; color: var(--ink-3); padding: 4px 0; }

    .spinner {
      display: inline-block; width: 16px; height: 16px;
      border: 2px solid #e5e7eb; border-top-color: var(--accent);
      border-radius: 50%; animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 760px) {
      .profile-layout { max-width: 100%; }
      .profile-hero { gap: 12px; }
      .profile-fullname { font-size: 16px; }
    }
  `],
})
export class ProfileComponent {
  protected readonly auth = inject(AuthService);
  private readonly sellerApi = inject(SellerApiService);
  private readonly reportingApi = inject(ReportingApiService);

  private readonly user = computed(() => this.auth.currentUser());

  readonly sellersResource = rxResource({
    stream: () => this.sellerApi.getAll(),
  });

  readonly mySeller = computed(() => {
    const sid = this.user()?.sellerId;
    if (!sid) return null;
    return this.sellersResource.value()?.find(s => Number(s.id) === Number(sid)) ?? null;
  });

  readonly balanceResource = rxResource({
    params: () => this.user()?.sellerId ?? null,
    stream: ({ params: sid }) =>
      sid ? this.reportingApi.getBalance('seller', Number(sid)) : of(null),
  });

  readonly isAdmin = computed(() => this.user()?.role === 'admin');

  readonly roleLabel = computed(() => {
    const role = this.user()?.role ?? '';
    return role.charAt(0).toUpperCase() + role.slice(1);
  });

  readonly sellerFullName = computed(() => {
    const s = this.mySeller();
    return [s?.name, s?.lastName].filter(v => !!v).join(' ') || '—';
  });

  readonly displayName = computed(() => {
    const s = this.mySeller();
    if (s) {
      const full = [s.name, s.lastName].filter(v => !!v).join(' ');
      return full || (this.user()?.email ?? '');
    }
    return this.user()?.email ?? '';
  });

  readonly avatarSeller = computed((): Seller => {
    const name = this.displayName();
    const words = name.split(/\s+/).filter(w => w.length > 0);
    const initials = words.length > 1
      ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
    return { id: '', name, initials, color: '#4f46e5', role: this.user()?.role ?? '' };
  });

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  formatBalance(amount: number): string {
    const sign = amount >= 0 ? '+' : '';
    return `${sign}€ ${Math.abs(amount).toFixed(2)}`;
  }
}
