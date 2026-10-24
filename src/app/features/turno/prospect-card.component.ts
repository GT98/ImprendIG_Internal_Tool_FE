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
import { AuthService } from '../../auth/auth.service';
import { addDays, romeDate, romeLabel, romeLongDay, romeTime } from '../../booking/rome-time';

const SLOT_LABEL: Record<number, string> = { 1: '1° turno', 2: '2° turno', 3: '3° turno' };

type Channel = 'call' | 'whatsapp';

// Un lead ADS: chiamata, WhatsApp, link di prenotazione, stato e note.
// Mostra chi ne è responsabile e avvisa prima di contattare un lead seguito da un'altra.
@Component({
  selector: 'app-prospect-card',
  imports: [IconComponent],
  styleUrl: './prospect-card.component.css',
  template: `
    @let p = prospect();
    <article class="pc" [class.done]="p.status !== 'nuovo'" [class.other]="takenByOther()" [attr.aria-label]="p.name">
      <header class="pc-head">
        <div class="pc-title">
          <strong>{{ p.name }}</strong>
          @if (p.client) { <span class="chip">{{ p.client.name }}</span> }
          <span class="status" [attr.data-tone]="tone()">{{ statusLabel() }}</span>
        </div>
        <span class="pc-when">
          arrivato {{ arrived() }}
          @if (showShift()) { · {{ slotLabel() }} di {{ shortDay(p.shiftDate) }} }
        </span>
      </header>

      <p class="owner" [class.mine]="isMine()" [class.taken]="takenByOther()">
        <app-icon name="users" [size]="13" />
        @if (p.handledBy) {
          {{ isMine() ? 'Lo stai seguendo tu' : 'Lo segue ' + p.handledBy.name }}{{ p.firstContactAt ? ' dalle ' + time(p.firstContactAt) : '' }}
        } @else if (p.shiftSetter) {
          Di turno: {{ p.shiftSetter }} · nessuno l'ha ancora contattato
        } @else {
          Nessuna setter di turno · nessuno l'ha ancora contattato
        }
      </p>

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
      </div>

      @if (p.call) {
        <p class="call" [class.cancelled]="p.call.status === 'cancelled'">
          <app-icon name="calendar" [size]="14" />
          Call {{ p.call.status === 'cancelled' ? 'annullata' : '' }} {{ label(p.call.startsAt) }}
          @if (p.call.outcome) { · esito: <strong>{{ p.call.outcome }}</strong> }
        </p>
      }

      @if (conflict(); as c) {
        <div class="conflict" role="alert">
          <span><strong>Attenzione:</strong> questo lead lo sta già seguendo {{ c.by }}. Vuoi contattarlo lo stesso?</span>
          <div class="conflict-actions">
            <button type="button" class="btn-ghost sm" (click)="conflict.set(null)">Lascio a {{ c.by }}</button>
            <button type="button" class="btn-primary sm" (click)="contact(c.channel, true)">Contatta comunque</button>
          </div>
        </div>
      }

      <div class="actions">
        <button type="button" class="btn-primary sm" (click)="contact('call')" [disabled]="!p.phone || busy()">
          <app-icon name="phone" [size]="14" /> Chiama
        </button>
        <button type="button" class="btn-ghost sm wa" (click)="contact('whatsapp')" [disabled]="!p.phone || busy()">
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
  private readonly auth = inject(AuthService);

  readonly prospect = input.required<Prospect>();
  readonly showShift = input(false);
  readonly changed = output<void>();

  readonly busy = signal(false);
  readonly notesOpen = signal(false);
  readonly draft = signal<string | null>(null);
  readonly conflict = signal<{ by: string; channel: Channel } | null>(null);

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

  private readonly mySetterId = computed(() => {
    const id = this.auth.currentUser()?.setterId;
    return id != null ? Number(id) : null;
  });
  readonly isMine = computed(() => {
    const h = this.prospect().handledBy;
    return h != null && h.id === this.mySetterId();
  });
  readonly takenByOther = computed(() => this.prospect().handledBy != null && !this.isMine() && this.mySetterId() != null);

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

  contact(channel: Channel, force = false): void {
    // WhatsApp: apro la scheda subito, nel clic, così il browser non la blocca come popup
    const tab = channel === 'whatsapp' ? window.open('', '_blank') : null;
    this.busy.set(true);
    this.conflict.set(null);
    this.api.contact(this.prospect().id, channel, force).subscribe({
      next: ({ url }) => {
        this.busy.set(false);
        if (channel === 'call') {
          window.location.href = url;
          this.toast.success(`Chiamata a ${this.prospect().phone}`);
        } else if (tab) {
          tab.location.href = url;
        } else {
          window.location.href = url;
        }
        this.changed.emit();
      },
      error: (err: HttpErrorResponse) => {
        tab?.close();
        if (err.status === 409 && err.error?.takenBy) {
          this.busy.set(false);
          this.conflict.set({ by: err.error.takenBy, channel });
          return;
        }
        this.fail(err, 'Contatto non riuscito');
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
