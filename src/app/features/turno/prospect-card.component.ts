import { Component, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  PROSPECT_STATUS,
  Prospect,
  ProspectStatus,
  ShiftApiService,
} from '../../shift/shift-api.service';
import { ToastService } from '../../shared/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { addDays, romeDate, romeLabel, romeLongDay, romeTime } from '../../booking/rome-time';

const SLOT_LABEL: Record<number, string> = { 1: '1° turno', 2: '2° turno', 3: '3° turno' };

// Un lead ADS nella coda del turno: contatto WhatsApp, link di prenotazione, stato e note
@Component({
  selector: 'app-prospect-card',
  imports: [IconComponent],
  styleUrl: './prospect-card.component.css',
  template: `
    @let p = prospect();
    <article class="pc" [class.done]="p.status !== 'nuovo'" [attr.aria-label]="p.name">
      <header class="pc-head">
        <div class="pc-title">
          <strong>{{ p.name }}</strong>
          @if (p.client) { <span class="chip">{{ p.client.name }}</span> }
          <span class="status" [attr.data-tone]="tone()">{{ statusLabel() }}</span>
        </div>
        <span class="pc-when">
          arrivato {{ arrived() }}
          @if (showShift()) {
            · {{ slotLabel() }} di {{ shortDay(p.shiftDate) }}{{ p.shiftSetter ? ' (' + p.shiftSetter + ')' : '' }}
          }
        </span>
      </header>

      @if (answerList().length) {
        <ul class="answers">
          @for (a of answerList(); track a.k) {
            <li><span>{{ a.k }}</span> {{ a.v }}</li>
          }
        </ul>
      }

      <div class="contacts">
        @if (p.phone) { <span><app-icon name="phone" [size]="13" /> {{ p.phone }}</span> }
        @if (p.email) { <span>{{ p.email }}</span> }
        @if (p.handledBy) {
          <span class="muted">· lavorato da {{ p.handledBy.name }}{{ p.firstContactAt ? ' alle ' + time(p.firstContactAt) : '' }}</span>
        }
      </div>

      @if (p.call) {
        <p class="call" [class.cancelled]="p.call.status === 'cancelled'">
          <app-icon name="calendar" [size]="14" />
          Call {{ p.call.status === 'cancelled' ? 'annullata' : '' }} {{ label(p.call.startsAt) }}
          @if (p.call.outcome) { · esito: <strong>{{ p.call.outcome }}</strong> }
        </p>
      }

      <div class="actions">
        <button type="button" class="btn-primary sm wa" (click)="whatsapp()" [disabled]="!p.phone || busy()">
          <app-icon name="send" [size]="14" /> WhatsApp
        </button>
        <button type="button" class="btn-ghost sm" (click)="copyBookingLink()" [disabled]="busy()">
          <app-icon name="copy" [size]="14" /> Link prenotazione
        </button>
        <select class="status-select" [attr.aria-label]="'Stato di ' + p.name" (change)="setStatus($any($event.target).value)" [disabled]="busy()">
          @for (s of statuses; track s.key) {
            <option [value]="s.key" [selected]="s.key === p.status" [disabled]="s.key === 'call_prenotata' && !p.call">{{ s.label }}</option>
          }
        </select>
        <button type="button" class="btn-ghost sm" (click)="notesOpen.set(!notesOpen())" [attr.aria-expanded]="notesOpen()">
          <app-icon name="edit" [size]="14" /> Note{{ p.notes ? ' •' : '' }}
        </button>
      </div>

      @if (notesOpen()) {
        <div class="notes">
          <textarea rows="3" [attr.aria-label]="'Note su ' + p.name" placeholder="Es. risponde dopo le 18, vuole info sui pagamenti…" [value]="p.notes ?? ''" (input)="draft.set($any($event.target).value)"></textarea>
          <button type="button" class="btn-primary sm" (click)="saveNotes()" [disabled]="busy() || draft() === null">Salva note</button>
        </div>
      } @else if (p.notes) {
        <p class="notes-preview">{{ p.notes }}</p>
      }
    </article>
  `,
})
export class ProspectCardComponent {
  private readonly api = inject(ShiftApiService);
  private readonly toast = inject(ToastService);

  readonly prospect = input.required<Prospect>();
  readonly showShift = input(false);
  readonly changed = output<void>();

  readonly busy = signal(false);
  readonly notesOpen = signal(false);
  readonly draft = signal<string | null>(null);

  readonly statuses = Object.entries(PROSPECT_STATUS).map(([key, v]) => ({ key: key as ProspectStatus, label: v.label }));
  readonly statusLabel = computed(() => PROSPECT_STATUS[this.prospect().status]?.label ?? this.prospect().status);
  readonly tone = computed(() => PROSPECT_STATUS[this.prospect().status]?.tone ?? 'gray');
  readonly answerList = computed(() => Object.entries(this.prospect().answers ?? {}).map(([k, v]) => ({ k, v })));
  readonly slotLabel = computed(() => SLOT_LABEL[this.prospect().shiftSlot] ?? '');
  readonly arrived = computed(() => {
    const at = this.prospect().arrivedAt;
    const today = romeDate(new Date());
    const day = romeDate(at);
    if (day === today) return `oggi alle ${romeTime(at)}`;
    if (day === addDays(today, -1)) return `ieri alle ${romeTime(at)}`;
    return romeLabel(at);
  });

  readonly label = romeLabel;
  readonly time = romeTime;

  shortDay(date: string): string {
    return romeLongDay(`${date}T12:00:00Z`);
  }

  private fail(err: HttpErrorResponse, fallback: string): void {
    this.busy.set(false);
    const msg = err.error?.message;
    this.toast.error(typeof msg === 'string' ? msg : fallback);
  }

  whatsapp(): void {
    // apro la scheda subito, nel clic, così il browser non la blocca come popup
    const tab = window.open('', '_blank');
    this.busy.set(true);
    this.api.whatsapp(this.prospect().id).subscribe({
      next: ({ url }) => {
        this.busy.set(false);
        if (tab) tab.location.href = url;
        else window.location.href = url;
        this.changed.emit();
      },
      error: err => {
        tab?.close();
        this.fail(err, 'WhatsApp non disponibile per questo lead');
      },
    });
  }

  copyBookingLink(): void {
    this.busy.set(true);
    this.api.bookingLink(this.prospect().id).subscribe({
      next: ({ url }) => {
        this.busy.set(false);
        navigator.clipboard.writeText(url).then(
          () => this.toast.success('Link di prenotazione copiato: mandalo in chat'),
          () => this.toast.warning(url),
        );
      },
      error: err => this.fail(err, 'Link non disponibile'),
    });
  }

  setStatus(status: ProspectStatus): void {
    this.busy.set(true);
    this.api.update(this.prospect().id, { status }).subscribe({
      next: () => {
        this.busy.set(false);
        this.changed.emit();
      },
      error: err => this.fail(err, 'Stato non salvato'),
    });
  }

  saveNotes(): void {
    const notes = this.draft();
    if (notes === null) return;
    this.busy.set(true);
    this.api.update(this.prospect().id, { notes }).subscribe({
      next: () => {
        this.busy.set(false);
        this.draft.set(null);
        this.notesOpen.set(false);
        this.toast.success('Note salvate');
        this.changed.emit();
      },
      error: err => this.fail(err, 'Note non salvate'),
    });
  }
}
