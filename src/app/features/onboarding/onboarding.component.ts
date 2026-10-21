import { Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { OnboardingFormApiService } from '../../customers/customer-api.service';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-onboarding',
  imports: [DatePipe, IconComponent],
  styles: [`
    :host { display: block; }






    .page-sub { font-size: 13px; color: var(--ink-3, #888); margin: 0 0 1.5rem; }

    .empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 64px 24px; color: var(--ink-3, #9ca3af); font-size: 14px; }

    /* Form submissions table */
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 8px 12px; font-size: 11px; font-weight: 700; color: var(--ink-3, #9ca3af); text-transform: uppercase; letter-spacing: .06em; border-bottom: 1.5px solid var(--border, #e5e7eb); white-space: nowrap; }
    td { padding: 10px 12px; border-bottom: 1px solid var(--border, #e5e7eb); color: var(--ink, #111827); vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--surface-alt, #f9fafb); }
    .name { font-weight: 500; }
    .secondary { font-size: 12px; color: var(--ink-3, #9ca3af); }
    .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .badge-ok { background: #d1fae5; color: #065f46; }
    .badge-pending { background: #fef3c7; color: #92400e; }
    .sent { color: #059669; font-size: 12px; }
    .not-sent { color: var(--ink-3, #9ca3af); font-size: 18px; line-height: 1; }
  `],
  template: `
    <div class="page">
          <p class="page-sub">Tracciamento dei form di onboarding inviati alle clienti.</p>

          @if (submissionsResource.isLoading()) {
            <div class="empty">Caricamento…</div>
          } @else if (!submissionsResource.value()?.length) {
            <div class="empty">
              <app-icon name="inbox" [size]="32" />
              <span>Nessun form ancora inviato</span>
            </div>
          } @else {
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Cliente</th>
                    <th scope="col">Venditore</th>
                    <th scope="col">Rata</th>
                    <th scope="col">Stato form</th>
                    <th scope="col">Link inviato</th>
                    <th scope="col">Compilato il</th>
                  </tr>
                </thead>
                <tbody>
                  @for (sub of submissionsResource.value()!; track sub.id) {
                    <tr>
                      <td>
                        <div class="name">{{ customerLabel(sub) }}</div>
                        @if (sub.customer?.email) {
                          <div class="secondary">{{ sub.customer!.email }}</div>
                        }
                      </td>
                      <td>{{ sellerLabel(sub) }}</td>
                      <td>{{ rataLabel(sub) }}</td>
                      <td>
                        <span class="badge" [class.badge-ok]="sub.status === 'completed'" [class.badge-pending]="sub.status === 'pending'">
                          {{ sub.status === 'completed' ? 'Compilato' : 'In attesa' }}
                        </span>
                      </td>
                      <td>
                        @if (sub.formLinkSentAt) {
                          <span class="sent" [title]="sub.formLinkSentAt | date:'dd/MM/yyyy HH:mm'">
                            ✓ {{ sub.formLinkSentAt | date:'dd/MM HH:mm' }}
                          </span>
                        } @else {
                          <span class="not-sent" title="Non ancora inviato">—</span>
                        }
                      </td>
                      <td>
                        @if (sub.submittedAt) {
                          {{ sub.submittedAt | date:'dd/MM/yyyy HH:mm' }}
                        } @else {
                          <span class="secondary">—</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
    </div>
  `,
})
export class OnboardingComponent {
  private readonly formApi = inject(OnboardingFormApiService);

  readonly submissionsResource = rxResource({
    stream: () => this.formApi.getSubmissions(),
  });


  customerLabel(sub: { customer: { name: string | null; surname: string | null; email: string | null } | null }): string {
    if (!sub.customer) return '—';
    return [sub.customer.name, sub.customer.surname].filter(Boolean).join(' ') || sub.customer.email || '—';
  }

  sellerLabel(sub: { installment: { sale: { seller: { name: string | null; lastName: string | null } | null } | null } | null }): string {
    const seller = sub.installment?.sale?.seller;
    if (!seller) return '—';
    return [seller.name, seller.lastName].filter(Boolean).join(' ') || '—';
  }

  rataLabel(sub: { installment: { installmentNumber: number } | null }): string {
    const n = sub.installment?.installmentNumber;
    if (n == null) return '—';
    return n === 0 ? 'acconto' : `rata ${n}`;
  }
}
