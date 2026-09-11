import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { ReferralApiService, ReferralDto } from '../../referral/referral-api.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-area-referral',
  imports: [],
  templateUrl: './area-referral.component.html',
  styleUrl: './area-referral.component.css',
})
export class AreaReferralComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ReferralApiService);

  readonly user = computed(() => this.auth.currentUser());

  readonly shareLink = computed(() => {
    const token = this.user()?.referralToken;
    if (!token) return null;
    const portalBase = environment.apiUrl.replace('/api', '').replace(':3000', '');
    // Usa il dominio FE, non il BE
    return `${window.location.origin}/r/${token}`;
  });

  readonly copied = signal(false);

  readonly referralsResource = rxResource({
    params: () => true,
    stream: () => this.api.getMy(),
  });

  readonly statsResource = rxResource({
    params: () => true,
    stream: () => this.api.getMyStats(),
  });

  readonly referrals = computed(() => this.referralsResource.value() ?? []);
  readonly stats = computed(() => this.statsResource.value());

  readonly firstName = computed(() => {
    const email = this.user()?.email ?? '';
    return email.split('@')[0] ?? 'Benvenuta';
  });

  copyLink() {
    const link = this.shareLink();
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  statusLabel(status: ReferralDto['status']): string {
    return { pending: 'In attesa', converted: 'Convertita', paid: 'Pagata' }[status] ?? status;
  }

  statusClass(status: ReferralDto['status']): string {
    return { pending: 'badge--pending', converted: 'badge--converted', paid: 'badge--paid' }[status] ?? '';
  }

  formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('it-IT');
  }
}
