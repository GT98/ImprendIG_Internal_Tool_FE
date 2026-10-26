import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PublicBookingApiService, PublicBookingView } from '../../booking/booking-api.service';
import { addDays, romeDate, romeLabel } from '../../booking/rome-time';
import { SlotPickerComponent } from './slot-picker.component';

type Mode = 'loading' | 'view' | 'move' | 'confirm-cancel' | 'error';

// Link nelle email: la persona sposta o annulla la propria call
import { brandVars } from './brand';
@Component({
  selector: 'app-prenota-gestisci',
  imports: [SlotPickerComponent],
  styleUrl: './prenota.component.css',
  template: `
    <div class="wrap" [style]="brand()">
      <main class="card">
        <header class="head">
          @if (view()?.settings?.brand?.logoUrl) {
            <img class="logo" [src]="view()!.settings.brand.logoUrl" alt="" />
          }
          <div>
            <h1>{{ view()?.settings?.title ?? 'La tua call' }}</h1>
            @if (view(); as v) {
              <p class="meta"><span>{{ v.settings.durationMin }} minuti</span><span aria-hidden="true">·</span><span>Videochiamata</span></p>
            }
          </div>
        </header>

        @if (notice()) {
          <p class="notice" role="status">{{ notice() }}</p>
        }

        @switch (mode()) {
          @case ('loading') {
            <p class="state">Caricamento…</p>
          }
          @case ('error') {
            <div class="state">
              <p class="state-title">Prenotazione non trovata</p>
              <p>Il link potrebbe essere incompleto. Controlla l'email di conferma.</p>
            </div>
          }
          @case ('view') {
            @if (view(); as v) {
              <div class="done">
                @if (v.status === 'cancelled') {
                  <h2>Questa call è stata annullata</h2>
                  <p class="done-when">{{ label(v.startsAt) }}</p>
                  <a class="submit as-link" [href]="'/prenota/' + v.settings.slug">Prenota un nuovo orario</a>
                } @else {
                  <h2>Ciao {{ v.name }}, la tua call è</h2>
                  <p class="done-when">{{ label(v.startsAt) }}</p>
                  @if (v.sellerName) {
                    <p>Ti seguirà {{ v.sellerName }}.</p>
                  }
                  @if (v.meetUrl) {
                    <p><a class="submit as-link" [href]="v.meetUrl" target="_blank" rel="noopener">Entra nella call (Google Meet)</a></p>
                  }
                  @if (v.canChange) {
                    <div class="actions">
                      <button type="button" class="btn-outline" (click)="startMove()">Sposta la call</button>
                      <button type="button" class="link-btn danger" (click)="mode.set('confirm-cancel')">Annulla la call</button>
                    </div>
                  } @else if (v.status === 'confirmed') {
                    <p class="muted">La call si può spostare o annullare da qui fino a {{ v.settings.changeLimitHours }} ore prima. Per cambiamenti dell'ultimo momento scrivi alla tua consulente.</p>
                  }
                }
              </div>
            }
          }
          @case ('move') {
            <div class="chosen">
              <div>
                <span class="chosen-label">Orario attuale</span>
                <strong>{{ label(view()!.startsAt) }}</strong>
              </div>
              <button type="button" class="link-btn" (click)="mode.set('view')">Torna indietro</button>
            </div>
            @if (slotsLoading()) {
              <p class="state">Caricamento degli orari disponibili…</p>
            } @else {
              <app-slot-picker [slots]="slots()" [current]="view()!.startsAt" (picked)="move($event)" />
            }
          }
          @case ('confirm-cancel') {
            <div class="done">
              <h2>Vuoi annullare la call?</h2>
              <p class="done-when">{{ label(view()!.startsAt) }}</p>
              <p>Se ti serve solo un altro orario puoi spostarla invece di annullarla.</p>
              <div class="actions">
                <button type="button" class="submit danger-bg" [disabled]="busy()" (click)="cancel()">
                  {{ busy() ? 'Annullamento…' : 'Sì, annulla la call' }}
                </button>
                <button type="button" class="link-btn" (click)="mode.set('view')">No, tienila</button>
              </div>
            </div>
          }
        }
      </main>
    </div>
  `,
  styles: [`
    .actions { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 18px; }
    .btn-outline {
      padding: 12px 22px; border-radius: 12px; border: 1.5px solid var(--brand); background: #fff;
      color: var(--brand-ink); font-weight: 800; font-size: 15px; cursor: pointer;
    }
    .as-link { display: inline-block; text-decoration: none; padding: 13px 22px; }
    .danger { color: #b91c1c; }
    .danger-bg { background: #b91c1c; width: 100%; max-width: 320px; }
  `],
})
export class GestisciComponent {
  private readonly api = inject(PublicBookingApiService);
  private readonly token = inject(ActivatedRoute).snapshot.paramMap.get('token') ?? '';

  readonly mode = signal<Mode>('loading');
  readonly view = signal<PublicBookingView | null>(null);
  readonly slots = signal<string[]>([]);
  readonly slotsLoading = signal(false);
  readonly busy = signal(false);
  readonly notice = signal('');

  readonly brand = computed(() => brandVars(this.view()?.settings?.brand));
  readonly label = romeLabel;

  constructor() {
    this.api.manage(this.token).subscribe({
      next: v => {
        this.view.set(v);
        this.mode.set('view');
      },
      error: () => this.mode.set('error'),
    });
  }

  startMove(): void {
    this.notice.set('');
    this.mode.set('move');
    this.loadSlots();
  }

  private loadSlots(): void {
    const v = this.view();
    if (!v) return;
    this.slotsLoading.set(true);
    const from = romeDate(new Date());
    this.api.manageSlots(this.token, from, addDays(from, v.settings.horizonDays)).subscribe({
      next: s => {
        this.slots.set(s);
        this.slotsLoading.set(false);
      },
      error: () => {
        this.slotsLoading.set(false);
        this.notice.set('Non riusciamo a caricare gli orari. Riprova tra poco.');
      },
    });
  }

  move(startsAt: string): void {
    this.busy.set(true);
    this.api.reschedule(this.token, startsAt).subscribe({
      next: v => {
        this.busy.set(false);
        this.view.set(v);
        this.notice.set('Fatto! Ti abbiamo inviato un\'email con il nuovo orario.');
        this.mode.set('view');
      },
      error: (err: HttpErrorResponse) => {
        this.busy.set(false);
        this.notice.set(
          err.status === 409
            ? 'Quell\'orario è stato appena preso. Scegline un altro.'
            : 'Non è stato possibile spostare la call. Riprova.',
        );
        this.loadSlots();
      },
    });
  }

  cancel(): void {
    this.busy.set(true);
    this.api.cancel(this.token).subscribe({
      next: v => {
        this.busy.set(false);
        this.view.set(v);
        this.notice.set('La call è stata annullata. Ti abbiamo inviato una conferma via email.');
        this.mode.set('view');
      },
      error: () => {
        this.busy.set(false);
        this.notice.set('Non è stato possibile annullare la call. Riprova.');
      },
    });
  }
}
