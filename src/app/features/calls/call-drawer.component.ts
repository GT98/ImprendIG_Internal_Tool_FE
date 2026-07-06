import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { Call, Seller } from '../../models';
import { IconComponent } from '../../shared/icon.component';
import { AvatarComponent } from '../../shared/avatar.component';
import { StatusBadgeComponent, TypeChipComponent } from '../../shared/badge.component';
import { fmtDate, fmtDateTime, eur } from '../../utils';
import { LeadsService, LeadEventDto } from '../../leads/lead.service';
import { ToastService } from '../../shared/toast.service';
import { AuthService } from '../../auth/auth.service';

function sellerDisplayName(s: { name: string | null; lastName: string | null } | null): string {
  return [s?.name, s?.lastName].filter(Boolean).join(' ') || '—';
}

function parsePayload(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

@Component({
  selector: 'app-call-drawer',
  imports: [IconComponent, AvatarComponent, StatusBadgeComponent, TypeChipComponent],
  templateUrl: './call-drawer.component.html',
  styleUrl: './call-drawer.component.css',
})
export class CallDrawerComponent {
  readonly call = input.required<Call>();
  readonly seller = input.required<Seller>();
  readonly closed = output<void>();
  readonly saved = output<void>();

  private readonly leadsService = inject(LeadsService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  // ── existing resources ────────────────────────────────────────
  readonly statusOptionsResource = rxResource({
    stream: () => this.leadsService.getStatusOptions(),
  });

  // ── new resources ─────────────────────────────────────────────
  readonly sellersResource = rxResource({
    stream: () => this.leadsService.getSellers(),
  });

  readonly settersResource = rxResource({
    stream: () => this.leadsService.getSetters(),
  });

  readonly eventsResource = rxResource({
    params: () => this.call().id,
    stream: ({ params: id }) => this.leadsService.getEvents(id),
  });

  readonly fmtDateTime = fmtDateTime;
  readonly fmtDate = fmtDate;
  readonly eur = eur;
  readonly parsePayload = parsePayload;
  readonly sellerDisplayName = sellerDisplayName;
  readonly Boolean = Boolean;

  // ── existing signals ──────────────────────────────────────────
  readonly selectedOptionId = signal<number | null>(null);
  readonly notes = signal<string>('');
  readonly selectedSetterId = signal<number | null>(null);
  readonly saving = signal(false);

  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');

  // ── transfer signals ──────────────────────────────────────────
  readonly transferring = signal(false);
  readonly transferSellerId = signal<number | null>(null);
  readonly transferNote = signal('');

  // ── reschedule signals ────────────────────────────────────────
  readonly rescheduling = signal(false);
  readonly rescheduleDate = signal('');
  readonly rescheduleNote = signal('');

  readonly acting = signal(false);

  readonly typeLabels: Record<string, string> = {
    'demo': 'Demo',
    'follow-up': 'Follow-up',
    'closing': 'Closing',
  };

  readonly otherSellers = computed(() =>
    (this.sellersResource.value() ?? []).filter(s => String(s.id) !== this.call().sellerId),
  );

  readonly minDateTime = computed(() => new Date().toISOString().slice(0, 16));

  readonly events = computed<LeadEventDto[]>(() => this.eventsResource.value() ?? []);

  private readonly currentSellerId = computed(() => {
    const id = this.auth.currentUser()?.sellerId;
    return id != null ? Number(id) : null;
  });

  constructor() {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') this.closed.emit(); };
    window.addEventListener('keydown', handler);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('keydown', handler));
  }

  ngOnInit(): void {
    this.selectedOptionId.set(this.call().statusOptionId);
    this.notes.set(this.call().notes ?? '');
    this.rescheduleDate.set(this.call().when.slice(0, 16));
    this.selectedSetterId.set(this.call().setterId ? parseInt(this.call().setterId!) : null);
  }

  typeLabel(): string {
    return this.typeLabels[this.call().type] ?? '';
  }

  openTransfer(): void {
    this.rescheduling.set(false);
    this.transferSellerId.set(null);
    this.transferNote.set('');
    this.transferring.set(true);
  }

  openReschedule(): void {
    this.transferring.set(false);
    this.rescheduleDate.set(this.call().when.slice(0, 16));
    this.rescheduleNote.set('');
    this.rescheduling.set(true);
  }

  save(): void {
    this.saving.set(true);
    const statusOptionId = this.selectedOptionId();
    const notes = this.notes().trim() || null;
    const setterId = this.isAdmin() ? this.selectedSetterId() : undefined;
    this.leadsService.patch(this.call().id, { statusOptionId, notes, setterId }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Esito e note salvati correttamente');
        this.saved.emit();
        this.closed.emit();
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Impossibile salvare. Riprova tra un momento.');
      },
    });
  }

  submitTransfer(): void {
    const toId = this.transferSellerId();
    if (!toId) return;

    const allSellers = this.sellersResource.value() ?? [];
    const fromSeller = allSellers.find(s => Number(s.id) === Number(this.call().sellerId)) ?? null;
    const toSeller = allSellers.find(s => Number(s.id) === Number(toId)) ?? null;

    const payload = JSON.stringify({
      fromSellerId: Number(this.call().sellerId),
      fromName: sellerDisplayName(fromSeller),
      toSellerId: toId,
      toName: sellerDisplayName(toSeller),
    });

    this.acting.set(true);
    this.leadsService.patch(this.call().id, { sellerId: toId }).pipe(
      switchMap(() => this.leadsService.createEvent(this.call().id, {
        type: 'transfer',
        payload,
        note: this.transferNote().trim() || undefined,
        createdBySellerId: this.currentSellerId() ?? undefined,
      })),
    ).subscribe({
      next: () => {
        this.acting.set(false);
        this.transferring.set(false);
        this.toast.success('Chiamata trasferita correttamente');
        this.saved.emit();
        this.closed.emit();
      },
      error: () => {
        this.acting.set(false);
        this.toast.error('Impossibile trasferire la chiamata. Riprova.');
      },
    });
  }

  submitReschedule(): void {
    const dateStr = this.rescheduleDate();
    if (!dateStr) return;

    const oldDate = this.call().when;
    const newDate = new Date(dateStr).toISOString();
    const payload = JSON.stringify({ oldDate, newDate });

    this.acting.set(true);
    this.leadsService.patch(this.call().id, { callStartDate: newDate }).pipe(
      switchMap(() => this.leadsService.createEvent(this.call().id, {
        type: 'reschedule',
        payload,
        note: this.rescheduleNote().trim() || undefined,
        createdBySellerId: this.currentSellerId() ?? undefined,
      })),
    ).subscribe({
      next: () => {
        this.acting.set(false);
        this.rescheduling.set(false);
        this.toast.success('Chiamata riprogrammata correttamente');
        this.saved.emit();
        this.closed.emit();
      },
      error: () => {
        this.acting.set(false);
        this.toast.error('Impossibile riprogrammare la chiamata. Riprova.');
      },
    });
  }
}
