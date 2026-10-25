import { Component, computed, inject, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { PROSPECT_STATUS, ProspectStatus, ShiftApiService } from '../../shift/shift-api.service';
import { SetterApiService } from '../../setter/setter-api.service';
import { addDays, romeDate, romeLabel, romeTime } from '../../booking/rome-time';
import { ProspectCardComponent } from './prospect-card.component';

const PERIODS = [
  { days: 1, label: 'Oggi' },
  { days: 7, label: 'Ultimi 7 giorni' },
  { days: 30, label: 'Ultimi 30 giorni' },
  { days: 0, label: 'Tutto' },
];

// Tutti i lead ADS in tabella, come su Notion: filtri e dettaglio al clic
@Component({
  selector: 'app-prospect-table',
  imports: [ProspectCardComponent],
  styleUrl: './prospect-table.component.css',
  template: `
    <div class="filters">
      <input type="search" placeholder="Nome, email o telefono…" aria-label="Cerca lead" [value]="text()" (input)="text.set($any($event.target).value)" />
      <select aria-label="Periodo" (change)="days.set(+$any($event.target).value)">
        @for (p of periods; track p.days) {
          <option [value]="p.days" [selected]="days() === p.days">{{ p.label }}</option>
        }
      </select>
      <select aria-label="Stato" (change)="status.set($any($event.target).value)">
        <option value="">Tutti gli stati</option>
        @for (s of statuses; track s.key) {
          <option [value]="s.key" [selected]="status() === s.key">{{ s.label }}</option>
        }
      </select>
      <select aria-label="Setter proprietaria" (change)="setterId.set(+$any($event.target).value || 0)">
        <option value="0">Di: tutte le setter</option>
        @for (s of setters(); track s.id) {
          <option [value]="s.id" [selected]="setterId() === +s.id">{{ s.name }} {{ s.lastName ?? '' }}</option>
        }
      </select>
      <select aria-label="Turno" (change)="slot.set(+$any($event.target).value || 0)">
        <option value="0">Tutti i turni</option>
        <option value="1">1° turno (8–11)</option>
        <option value="2">2° turno (11–16)</option>
        <option value="3">3° turno (16–19)</option>
      </select>
    </div>

    @if (rows.isLoading() && !rows.value()) {
      <p class="muted">Caricamento…</p>
    } @else {
      <p class="count">{{ list().length }} lead{{ list().length === 500 ? ' (mostrati i più recenti)' : '' }}</p>
      <div class="table-wrap">
        <table class="pt">
          <thead>
            <tr>
              <th scope="col">Arrivato</th>
              <th scope="col">Nome</th>
              <th scope="col">Telefono</th>
              <th scope="col">Turno</th>
              <th scope="col">Di</th>
              <th scope="col">Stato</th>
              <th scope="col">Call</th>
            </tr>
          </thead>
          <tbody>
            @for (p of list(); track p.id) {
              <tr class="row" [class.open]="openId() === p.id" (click)="toggle(p.id)">
                <td class="nowrap">{{ arrived(p.arrivedAt) }}</td>
                <td>
                  <button type="button" class="name" [attr.aria-expanded]="openId() === p.id" (click)="$event.stopPropagation(); toggle(p.id)">{{ p.name }}</button>
                  @if (p.client) { <span class="sub">{{ p.client.name }}</span> }
                </td>
                <td class="nowrap">{{ p.phone ?? '—' }}</td>
                <td class="nowrap">{{ p.shiftSlot }}° turno</td>
                <td>{{ p.owner?.name ?? '—' }}</td>
                <td><span class="status" [attr.data-tone]="tone(p.status)">{{ statusLabel(p.status) }}</span></td>
                <td class="nowrap">
                  @if (p.call) {
                    {{ callLabel(p.call.startsAt) }}@if (p.call.outcome) { · {{ p.call.outcome }} }
                  } @else { — }
                </td>
              </tr>
              @if (openId() === p.id) {
                <tr class="detail">
                  <td colspan="7"><app-prospect-card [prospect]="p" [showShift]="true" (changed)="rows.reload(); changed.emit()" /></td>
                </tr>
              }
            } @empty {
              <tr><td colspan="7" class="muted empty-row">Nessun lead con questi filtri.</td></tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class ProspectTableComponent {
  private readonly api = inject(ShiftApiService);
  private readonly setterApi = inject(SetterApiService);

  /** Un lead è cambiato: la pagina aggiorna anche le altre viste */
  readonly changed = output<void>();

  readonly periods = PERIODS;
  readonly statuses = Object.entries(PROSPECT_STATUS).map(([key, v]) => ({ key: key as ProspectStatus, label: v.label }));

  readonly text = signal('');
  readonly days = signal(7);
  readonly status = signal('');
  readonly setterId = signal(0);
  readonly slot = signal(0);
  readonly openId = signal<number | null>(null);

  readonly settersResource = rxResource({ stream: () => this.setterApi.getAll() });
  readonly setters = computed(() => this.settersResource.value() ?? []);

  readonly rows = rxResource({
    params: () => ({
      text: this.text().trim() || undefined,
      status: this.status() || undefined,
      from: this.days() ? addDays(romeDate(new Date()), 1 - this.days()) : undefined,
      setterId: this.setterId() || undefined,
      slot: this.slot() || undefined,
    }),
    stream: ({ params }) => this.api.search(params),
  });
  readonly list = computed(() => this.rows.value() ?? []);

  toggle(id: number): void {
    this.openId.update(cur => (cur === id ? null : id));
  }

  reload(): void {
    this.rows.reload();
  }

  statusLabel(s: ProspectStatus): string {
    return PROSPECT_STATUS[s]?.label ?? s;
  }

  tone(s: ProspectStatus): string {
    return PROSPECT_STATUS[s]?.tone ?? 'gray';
  }

  arrived(iso: string): string {
    const today = romeDate(new Date());
    const day = romeDate(iso);
    if (day === today) return `oggi ${romeTime(iso)}`;
    if (day === addDays(today, -1)) return `ieri ${romeTime(iso)}`;
    return new Date(iso).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  callLabel(iso: string): string {
    return romeLabel(iso);
  }
}
