import { Component, input, output, signal } from '@angular/core';
import { PROSPECT_STATUS, Prospect, ProspectStatus } from '../../shift/shift-api.service';
import { addDays, romeDate, romeTime } from '../../booking/rome-time';

const shortDay = (d: string) =>
  new Date(d).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', weekday: 'short', day: 'numeric', month: 'short' });
import { ProspectCardComponent } from './prospect-card.component';

// Lead in righe compatte: al clic si apre la scheda completa
@Component({
  selector: 'app-prospect-rows',
  imports: [ProspectCardComponent],
  styleUrl: './prospect-rows.component.css',
  template: `
    <ul class="pr-list">
      @for (p of prospects(); track p.id) {
        <li [class.open]="openId() === p.id">
          <button type="button" class="pr-row" [attr.aria-expanded]="openId() === p.id" (click)="toggle(p.id)">
            <span class="pr-who">
              <strong>{{ p.name }}</strong>
              <span>{{ p.client?.name ?? 'Academy n.d.' }} · arrivato {{ arrived(p.arrivedAt) }} · {{ p.shiftSlot }}° turno di {{ day(p.shiftDate) }}</span>
            </span>
            @if (showOwner()) {
              <span class="pr-owner">{{ p.owner?.name ?? 'Nessuna setter' }}</span>
            }
            <span class="badge" [attr.data-tone]="tone(p.status)"><span class="badge-dot"></span>{{ label(p.status) }}</span>
          </button>
          @if (openId() === p.id) {
            <div class="pr-card"><app-prospect-card [prospect]="p" [showShift]="true" (changed)="changed.emit()" /></div>
          }
        </li>
      }
    </ul>
  `,
})
export class ProspectRowsComponent {
  readonly prospects = input.required<Prospect[]>();
  readonly showOwner = input(false);
  readonly changed = output<void>();

  readonly openId = signal<number | null>(null);

  toggle(id: number): void {
    this.openId.update(cur => (cur === id ? null : id));
  }

  label(s: ProspectStatus): string {
    return PROSPECT_STATUS[s]?.label ?? s;
  }

  tone(s: ProspectStatus): string {
    return PROSPECT_STATUS[s]?.tone ?? 'gray';
  }

  arrived(iso: string): string {
    const today = romeDate(new Date());
    const d = romeDate(iso);
    if (d === today) return `oggi ${romeTime(iso)}`;
    if (d === addDays(today, -1)) return `ieri ${romeTime(iso)}`;
    return `${shortDay(iso)} ${romeTime(iso)}`;
  }

  day(date: string): string {
    const today = romeDate(new Date());
    if (date === today) return 'oggi';
    if (date === addDays(today, -1)) return 'ieri';
    if (date === addDays(today, 1)) return 'domani';
    return shortDay(`${date}T12:00:00Z`);
  }
}
