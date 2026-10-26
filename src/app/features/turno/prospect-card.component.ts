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
// Il lead è della setter del suo turno: le altre lo vedono ma non possono contattarlo.
@Component({
  selector: 'app-prospect-card',
  imports: [IconComponent],
  styleUrl: './prospect-card.component.css',
  template: `
    @let p = prospect();
    <article class="pc" [attr.aria-label]="p.name">
      <header class="pc-head">
        <div class="pc-id">
          <span class="pc-mono" aria-hidden="true">{{ initials() }}</span>
          <div>
            <h3>{{ p.name }}</h3>
            <span class="pc-meta">
              {{ p.client?.name ?? 'Academy n.d.' }} · arrivato {{ arrived() }}{{ showShift() ? ' · ' + slotLabel() + ' di ' + shortDay(p.shiftDate) : '' }}
            </span>
          </div>
        </div>
        <span class="badge" [attr.data-tone]="tone()"><span class="badge-dot"></span>{{ statusLabel() }}</span>
      </header>

      <div class="pc-grid">
        <div>
          <span class="dg-label">Setter</span>
          <span class="dg-val sm">{{ p.owner ? (isMine() ? 'Tu' : p.owner.name) : 'Nessuna' }}</span>
        </div>
        <div>
          <span class="dg-label">Primo contatto</span>
          <span class="dg-val sm">{{ p.firstContactAt ? time(p.firstContactAt) : '—' }}</span>
        </div>
        <div>
          <span class="dg-label">Telefono</span>
          <span class="dg-val sm">{{ p.phone ?? '—' }}</span>
        </div>
        <div>
          <span class="dg-label">Email</span>
          <span class="dg-val sm ellipsis" [title]="p.email ?? ''">{{ p.email ?? '—' }}</span>
        </div>
      </div>

      @if (answerList().length) {
        <div class="pc-answers">
          @for (a of answerList(); track a.k) {
            <div class="kv"><span>{{ a.k }}</span><strong>{{ a.v }}</strong></div>
          }
        </div>
      }

      @if (p.call) {
        <div class="kv call" [class.cancelled]="p.call.status === 'cancelled'">
          <span><app-icon name="calendar" [size]="13" /> Call {{ p.call.status === 'cancelled' ? 'annullata' : 'prenotata' }}</span>
          <strong>{{ label(p.call.startsAt) }}{{ p.call.outcome ? ' · ' + p.call.outcome : '' }}</strong>
        </div>
      }

      @if (canWork()) {
        <div class="pc-actions">
          <button type="button" class="btn-primary sm" (click)="contact('call')" [disabled]="!p.phone || busy()">
            <app-icon name="phone" [size]="14" /> Chiama
          </button>
          <button type="button" class="btn-ghost sm" (click)="contact('whatsapp')" [disabled]="!p.phone || busy()">
            <app-icon name="send" [size]="14" /> WhatsApp
          </button>
          <span class="spacer"></span>
          <select class="select-inline" [attr.aria-label]="'Stato di ' + p.name" (change)="setStatus($any($event.target).value)" [disabled]="busy()">
            @for (s of statuses; track s.key) {
              <option [value]="s.key" [selected]="s.key === p.status" [disabled]="s.key === 'call_prenotata' && !p.call">{{ s.label }}</option>
            }
          </select>
          <button type="button" class="btn-ghost-xs" (click)="notesOpen.set(!notesOpen())" [attr.aria-expanded]="notesOpen()">
            <app-icon name="edit" [size]="13" /> Note{{ p.notes ? ' •' : '' }}
          </button>
        </div>
      } @else {
        <p class="pc-locked">Lead di {{ p.owner?.name }}: può contattarlo solo lei.</p>
      }

      @if (notesOpen() && canWork()) {
        <div class="pc-notes">
          <textarea class="note-area" [attr.aria-label]="'Note su ' + p.name" placeholder="Es. risponde dopo le 18, vuole info sui pagamenti…" [value]="p.notes ?? ''" (input)="draft.set($any($event.target).value)"></textarea>
          <button type="button" class="btn-primary sm" (click)="saveNotes()" [disabled]="busy() || draft() === null">Salva note</button>
        </div>
      } @else if (p.notes) {
        <p class="pc-note-preview"><span class="dg-label">Note</span>{{ p.notes }}</p>
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

  readonly statuses = Object.entries(PROSPECT_STATUS).map(([key, v]) => ({ key: key as ProspectStatus, label: v.label }));
  readonly statusLabel = computed(() => PROSPECT_STATUS[this.prospect().status]?.label ?? this.prospect().status);
  readonly tone = computed(() => PROSPECT_STATUS[this.prospect().status]?.tone ?? 'gray');
  // campi tecnici di Meta, non risposte del form
  readonly answerList = computed(() =>
    Object.entries(this.prospect().answers ?? {})
      .filter(([k]) => !/^is[ _](qualified|organic)$|^inbox[ _]url$/i.test(k))
      .map(([k, v]) => ({ k, v })),
  );
  readonly initials = computed(() =>
    this.prospect().name.split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join(''),
  );
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
    const o = this.prospect().owner;
    return o != null && o.id === this.mySetterId();
  });
  /** Lead di un'altra setter: lo vedo ma non posso contattarlo (gli admin sì) */
  readonly takenByOther = computed(() => this.prospect().owner != null && !this.isMine() && this.mySetterId() != null);
  readonly canWork = computed(() => !this.takenByOther());

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

  contact(channel: Channel): void {
    // WhatsApp: apro la scheda subito, nel clic, così il browser non la blocca come popup
    const tab = channel === 'whatsapp' ? window.open('', '_blank') : null;
    this.busy.set(true);
    this.api.contact(this.prospect().id, channel).subscribe({
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
        this.fail(err, 'Contatto non riuscito');
      },
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
