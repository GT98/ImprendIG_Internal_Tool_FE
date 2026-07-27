import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { LeadsService } from '../../leads/lead.service';
import type { Lead, LeadStatusOption } from '../../leads/lead.model';
import { ToastService } from '../../shared/toast.service';
import { IconComponent } from '../../shared/icon.component';

interface StatusStyle { bg: string; color: string }

const STATUS_PALETTE: Record<string, StatusStyle> = {
  nuovo:       { bg: '#dbeafe', color: '#1e40af' },
  contattato:  { bg: '#fef3c7', color: '#92400e' },
  qualificato: { bg: '#d1fae5', color: '#065f46' },
  interessato: { bg: '#ede9fe', color: '#6d28d9' },
  perso:       { bg: '#fee2e2', color: '#b91c1c' },
  chiuso:      { bg: '#d1fae5', color: '#065f46' },
};

const NEUTRAL: StatusStyle = { bg: '#f3f4f6', color: '#6b7280' };

@Component({
  selector: 'app-leads-list',
  imports: [IconComponent],
  styleUrl: './leads-list.component.css',
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Lead</h1>
          <p class="page-sub">Gestisci i lead e aggiorna il loro stato direttamente dalla lista.</p>
        </div>
        @if (!leadsResource.isLoading()) {
          <span class="muted-pill">{{ filtered().length }}</span>
        }
      </div>

      <!-- Status filter chips -->
      @if ((statusOptions.value() ?? []).length > 0) {
        <div class="status-chips" role="group" aria-label="Filtra per status">
          <button
            class="seg-btn"
            [class.active]="selectedStatus() === null"
            (click)="selectedStatus.set(null)"
          >
            Tutti
            <span class="chip-count">{{ displayedLeads().length }}</span>
          </button>
          @for (opt of statusOptions.value() ?? []; track opt.id) {
            <button
              class="seg-btn"
              [class.active]="selectedStatus() === opt.code"
              (click)="selectedStatus.set(opt.code)"
            >
              <span class="status-dot" [style.background]="statusStyle(opt.code).bg"></span>
              {{ opt.label }}
              <span class="chip-count">{{ countByStatus(opt.code) }}</span>
            </button>
          }
        </div>
      }

      <!-- Search -->
      <div class="toolbar">
        <div class="search-box">
          <app-icon name="search" [size]="16" />
          <input
            type="search"
            placeholder="Cerca per nome, email o telefono…"
            [value]="searchQuery()"
            (input)="searchQuery.set($any($event.target).value)"
            aria-label="Cerca lead"
          />
        </div>
      </div>

      @if (leadsResource.isLoading()) {
        <div class="empty"><span>Caricamento…</span></div>
      } @else if (filtered().length === 0) {
        <div class="empty">
          <app-icon name="target" [size]="32" />
          <span>{{ searchQuery() || selectedStatus() ? 'Nessun risultato' : 'Nessun lead trovato' }}</span>
        </div>
      } @else {
        <div class="leads-grid">
          @for (lead of filtered(); track lead.id) {
            <div class="lead-card">
              <!-- Header: name + status badge -->
              <div class="lc-head">
                <div>
                  <div class="lc-name">{{ fullName(lead) }}</div>
                  <div class="lc-contact">
                    @if (lead.email) { <span>{{ lead.email }}</span> }
                    @if (lead.phone) { <span>{{ lead.phone }}</span> }
                  </div>
                </div>
                <span
                  class="badge lc-badge"
                  [style.background]="statusStyle(currentOption(lead)?.code).bg"
                  [style.color]="statusStyle(currentOption(lead)?.code).color"
                >
                  {{ currentOption(lead)?.label ?? 'Nessuno' }}
                </span>
              </div>

              <!-- Seller + setter info -->
              @if (lead.seller || lead.setter) {
                <div class="lc-meta">
                  @if (lead.seller) {
                    <span class="lc-meta-item">
                      <app-icon name="users" [size]="12" />
                      {{ sellerName(lead.seller) }}
                    </span>
                  }
                  @if (lead.setter) {
                    <span class="lc-meta-item lc-setter">
                      <app-icon name="phone" [size]="12" />
                      {{ sellerName(lead.setter) }}
                    </span>
                  }
                </div>
              }

              <!-- Status change -->
              <div class="lc-status-row">
                <span class="lc-status-label">Cambia status:</span>
                <select
                  class="select-inline lc-select"
                  [attr.aria-label]="'Cambia status di ' + fullName(lead)"
                  (change)="updateStatus(lead, +$any($event.target).value); $any($event.target).value = ''"
                >
                  <option value="">— Seleziona —</option>
                  @for (opt of statusOptions.value() ?? []; track opt.id) {
                    <option [value]="opt.id">{{ opt.label }}</option>
                  }
                </select>
              </div>

              <!-- Notes -->
              @if (editNoteId() === lead.id) {
                <textarea
                  class="note-area"
                  [value]="editNoteText()"
                  (input)="editNoteText.set($any($event.target).value)"
                  placeholder="Aggiungi una nota…"
                  rows="3"
                  aria-label="Nota lead"
                ></textarea>
                <div class="lc-note-actions">
                  <button class="btn-primary" style="font-size:12px;padding:5px 12px" (click)="saveNote(lead)">Salva</button>
                  <button class="btn-ghost" style="font-size:12px;padding:5px 10px" (click)="cancelNote()">Annulla</button>
                </div>
              } @else {
                <button
                  class="lc-note"
                  (click)="startNote(lead)"
                  [attr.aria-label]="lead.notes ? 'Modifica nota' : 'Aggiungi nota'"
                >
                  {{ lead.notes ? truncate(lead.notes) : '+ Aggiungi nota' }}
                </button>
              }

              @if (lead.callStartDate) {
                <div class="lc-date">
                  <app-icon name="calendar" [size]="11" />
                  {{ formatDate(lead.callStartDate) }}
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class LeadsListComponent {
  private readonly leadsService = inject(LeadsService);
  private readonly toast = inject(ToastService);

  readonly searchQuery = signal('');
  readonly selectedStatus = signal<string | null>(null);

  readonly statusOptions = rxResource({
    stream: () => this.leadsService.getStatusOptions(),
  });

  readonly leadsResource = rxResource({
    stream: () => this.leadsService.getAll(),
  });

  readonly statusOverrides = signal<Record<number, LeadStatusOption | null>>({});

  readonly editNoteId = signal<number | null>(null);
  readonly editNoteText = signal('');

  readonly displayedLeads = computed(() => {
    const all = this.leadsResource.value() ?? [];
    const overrides = this.statusOverrides();
    return all.map(lead =>
      lead.id in overrides ? { ...lead, statusOption: overrides[lead.id] } : lead,
    );
  });

  readonly filtered = computed(() => {
    const all = this.displayedLeads();
    const q = this.searchQuery().toLowerCase().trim();
    const status = this.selectedStatus();
    return all.filter(lead => {
      const matchesStatus = !status || lead.statusOption?.code === status;
      const matchesQuery = !q ||
        (lead.name ?? '').toLowerCase().includes(q) ||
        (lead.surname ?? '').toLowerCase().includes(q) ||
        (lead.email ?? '').toLowerCase().includes(q) ||
        (lead.phone ?? '').toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  });

  currentOption(lead: Lead): LeadStatusOption | null {
    const overrides = this.statusOverrides();
    return lead.id in overrides ? overrides[lead.id] : lead.statusOption;
  }

  countByStatus(code: string): number {
    return this.displayedLeads().filter(l => l.statusOption?.code === code).length;
  }

  statusStyle(code: string | undefined): StatusStyle {
    if (!code) return NEUTRAL;
    return STATUS_PALETTE[code] ?? NEUTRAL;
  }

  fullName(lead: Lead): string {
    return [lead.name, lead.surname].filter(Boolean).join(' ') || '—';
  }

  sellerName(s: { name: string | null; lastName: string | null } | null | undefined): string {
    if (!s) return '—';
    return [s.name, s.lastName].filter(Boolean).join(' ') || '—';
  }

  truncate(text: string): string {
    return text.length > 130 ? text.slice(0, 130) + '…' : text;
  }

  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return iso;
    }
  }

  updateStatus(lead: Lead, statusOptionId: number): void {
    if (!statusOptionId) return;
    const option = this.statusOptions.value()?.find(o => o.id === statusOptionId) ?? null;
    this.statusOverrides.update(map => ({ ...map, [lead.id]: option }));
    this.leadsService.patch(String(lead.id), { statusOptionId }).subscribe({
      error: () => {
        this.statusOverrides.update(map => {
          const next = { ...map };
          delete next[lead.id];
          return next;
        });
        this.toast.error('Errore aggiornamento status');
      },
    });
  }

  startNote(lead: Lead): void {
    this.editNoteId.set(lead.id);
    this.editNoteText.set(lead.notes ?? '');
  }

  cancelNote(): void {
    this.editNoteId.set(null);
  }

  saveNote(lead: Lead): void {
    const text = this.editNoteText().trim();
    this.leadsService.patch(String(lead.id), { notes: text || null }).subscribe({
      next: () => {
        this.editNoteId.set(null);
        this.leadsResource.reload();
        this.toast.success('Nota salvata');
      },
      error: () => this.toast.error('Errore salvataggio nota'),
    });
  }
}
