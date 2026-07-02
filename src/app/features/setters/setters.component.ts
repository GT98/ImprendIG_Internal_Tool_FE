import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { SetterApiService, SetterDto } from '../../setter/setter-api.service';
import { ToastService } from '../../shared/toast.service';
import { IconComponent } from '../../shared/icon.component';

interface EditState {
  name: string;
  lastName: string;
  email: string;
  percentage: number;
  telegramId: string;
}

function emptyEdit(): EditState {
  return { name: '', lastName: '', email: '', percentage: 3, telegramId: '' };
}

@Component({
  selector: 'app-setters',
  imports: [IconComponent],
  styleUrl: './setters.component.css',
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Setter <span class="muted-pill">admin</span></h1>
          <p class="page-sub">Gestione setter — figure che aprono le conversazioni con i lead</p>
        </div>
        <button class="btn-primary" (click)="openNew()">
          <app-icon name="plus" [size]="16" /> Nuovo setter
        </button>
      </div>

      @if (settersResource.isLoading()) {
        <div class="empty"><span>Caricamento…</span></div>
      } @else {
        <div class="setters-grid">
          @for (s of setters(); track s.id) {
            <div class="setter-card" [class.editing]="editId() === s.id">
              @if (editId() === s.id) {
                <!-- edit form -->
                <div class="edit-form">
                  <div class="ef-row">
                    <label class="ef-field">
                      <span>Nome</span>
                      <input type="text" [value]="editState()!.name"
                        (input)="patch('name', $any($event.target).value)" />
                    </label>
                    <label class="ef-field">
                      <span>Cognome</span>
                      <input type="text" [value]="editState()!.lastName"
                        (input)="patch('lastName', $any($event.target).value)" />
                    </label>
                  </div>
                  <div class="ef-row">
                    <label class="ef-field">
                      <span>Email</span>
                      <input type="email" [value]="editState()!.email"
                        (input)="patch('email', $any($event.target).value)" />
                    </label>
                    <label class="ef-field ef-narrow">
                      <span>% commissione</span>
                      <input type="number" min="0" max="100" step="0.5"
                        [value]="editState()!.percentage"
                        (input)="patch('percentage', +$any($event.target).value)" />
                    </label>
                  </div>
                  <label class="ef-field">
                    <span>Telegram ID</span>
                    <input type="text" [value]="editState()!.telegramId"
                      placeholder="@username"
                      (input)="patch('telegramId', $any($event.target).value)" />
                  </label>
                  <div class="ef-actions">
                    <button class="btn-ghost" (click)="cancelEdit()">Annulla</button>
                    <button class="btn-primary" [disabled]="saving()" (click)="save(s.id)">
                      {{ saving() ? 'Salvataggio…' : 'Salva' }}
                    </button>
                  </div>
                </div>
              } @else {
                <!-- read view -->
                <div class="setter-info">
                  <div class="setter-avatar">
                    {{ initials(s) }}
                  </div>
                  <div class="setter-details">
                    <div class="setter-name">{{ fullName(s) }}</div>
                    <div class="setter-meta">
                      @if (s.email) { <span>{{ s.email }}</span> }
                      @if (s.telegramId) { <span>{{ s.telegramId }}</span> }
                    </div>
                  </div>
                  <div class="setter-pct">{{ s.percentage ?? 3 }}%</div>
                </div>
                <div class="setter-card-actions">
                  <button class="btn-ghost sm" (click)="openEdit(s)">
                    <app-icon name="edit" [size]="14" /> Modifica
                  </button>
                  <button class="btn-danger sm" [disabled]="deleting() === s.id" (click)="remove(s.id)">
                    <app-icon name="trash" [size]="14" />
                    {{ deleting() === s.id ? '…' : 'Elimina' }}
                  </button>
                </div>
              }
            </div>
          }

          @if (editId() === 'new') {
            <div class="setter-card editing">
              <div class="edit-form">
                <div class="ef-row">
                  <label class="ef-field">
                    <span>Nome</span>
                    <input type="text" [value]="editState()!.name"
                      (input)="patch('name', $any($event.target).value)" />
                  </label>
                  <label class="ef-field">
                    <span>Cognome</span>
                    <input type="text" [value]="editState()!.lastName"
                      (input)="patch('lastName', $any($event.target).value)" />
                  </label>
                </div>
                <div class="ef-row">
                  <label class="ef-field">
                    <span>Email</span>
                    <input type="email" [value]="editState()!.email"
                      (input)="patch('email', $any($event.target).value)" />
                  </label>
                  <label class="ef-field ef-narrow">
                    <span>% commissione</span>
                    <input type="number" min="0" max="100" step="0.5"
                      [value]="editState()!.percentage"
                      (input)="patch('percentage', +$any($event.target).value)" />
                  </label>
                </div>
                <label class="ef-field">
                  <span>Telegram ID</span>
                  <input type="text" [value]="editState()!.telegramId"
                    placeholder="@username"
                    (input)="patch('telegramId', $any($event.target).value)" />
                </label>
                <div class="ef-actions">
                  <button class="btn-ghost" (click)="cancelEdit()">Annulla</button>
                  <button class="btn-primary" [disabled]="saving()" (click)="save(null)">
                    {{ saving() ? 'Salvataggio…' : 'Crea setter' }}
                  </button>
                </div>
              </div>
            </div>
          }

          @if (setters().length === 0 && editId() !== 'new') {
            <div class="empty-state">
              <p>Nessun setter ancora. Clicca "Nuovo setter" per aggiungerne uno.</p>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class SettersComponent {
  private readonly api = inject(SetterApiService);
  private readonly toast = inject(ToastService);

  readonly settersResource = rxResource({ stream: () => this.api.getAll() });
  readonly setters = computed(() => this.settersResource.value() ?? []);

  readonly editId = signal<number | 'new' | null>(null);
  readonly editState = signal<EditState | null>(null);
  readonly saving = signal(false);
  readonly deleting = signal<number | null>(null);

  fullName(s: SetterDto): string {
    return [s.name, s.lastName].filter(Boolean).join(' ') || '—';
  }

  initials(s: SetterDto): string {
    return ((s.name?.[0] ?? '') + (s.lastName?.[0] ?? '')).toUpperCase() || '?';
  }

  openNew(): void {
    this.editId.set('new');
    this.editState.set(emptyEdit());
  }

  openEdit(s: SetterDto): void {
    this.editId.set(s.id);
    this.editState.set({
      name: s.name ?? '',
      lastName: s.lastName ?? '',
      email: s.email ?? '',
      percentage: s.percentage ?? 3,
      telegramId: s.telegramId ?? '',
    });
  }

  cancelEdit(): void {
    this.editId.set(null);
    this.editState.set(null);
  }

  patch(field: keyof EditState, value: string | number): void {
    this.editState.update(s => s ? { ...s, [field]: value } : s);
  }

  save(id: number | null): void {
    const state = this.editState();
    if (!state) return;
    this.saving.set(true);
    const dto = {
      name: state.name || undefined,
      lastName: state.lastName || undefined,
      email: state.email || undefined,
      percentage: state.percentage,
      telegramId: state.telegramId || undefined,
    };
    const req$ = id ? this.api.update(id, dto) : this.api.create(dto);
    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.cancelEdit();
        this.settersResource.reload();
        this.toast.success(id ? 'Setter aggiornato' : 'Setter creato');
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Impossibile salvare. Riprova.');
      },
    });
  }

  remove(id: number): void {
    this.deleting.set(id);
    this.api.remove(id).subscribe({
      next: () => {
        this.deleting.set(null);
        this.settersResource.reload();
        this.toast.success('Setter eliminato');
      },
      error: () => {
        this.deleting.set(null);
        this.toast.error('Impossibile eliminare. Riprova.');
      },
    });
  }
}
