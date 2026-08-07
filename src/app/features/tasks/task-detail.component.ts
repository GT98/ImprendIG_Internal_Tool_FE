import { Component, computed, inject, input, OnChanges, output, signal } from '@angular/core';
import { TaskApiService, CreateTaskDto } from '../../tasks/task-api.service';
import { ToastService } from '../../shared/toast.service';
import { IconComponent } from '../../shared/icon.component';
import type { AssignableUser, Task, TaskPriority, TaskStatus } from '../../models';

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'Da fare' },
  { value: 'in_progress', label: 'In corso' },
  { value: 'review', label: 'In revisione' },
  { value: 'done', label: 'Fatto' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Bassa' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

@Component({
  selector: 'app-task-detail',
  imports: [IconComponent],
  template: `
    <div class="drawer-overlay" (click)="onOverlayClick($event)" role="dialog" aria-modal="true" [attr.aria-label]="task() ? 'Modifica attività' : 'Nuova attività'">
      <div class="drawer" (click)="$event.stopPropagation()">
        <div class="drawer-head">
          <div>
            <h2>{{ task() ? 'Modifica attività' : 'Nuova attività' }}</h2>
            @if (task()) {
              <p class="drawer-sub">Creata il {{ formatDate(task()!.createdAt) }}</p>
            }
          </div>
          <button class="icon-btn" (click)="closed.emit()" aria-label="Chiudi">
            <app-icon name="x" [size]="20" />
          </button>
        </div>

        <div style="display:flex;flex-direction:column;gap:14px">
          <!-- Title -->
          <div class="modal-field">
            <label for="task-title" style="font-size:12px;font-weight:700;color:var(--ink-2)">Titolo *</label>
            <input
              id="task-title"
              class="modal-input"
              type="text"
              placeholder="Inserisci titolo…"
              [value]="titleVal()"
              (input)="titleVal.set($any($event.target).value)"
            />
          </div>

          <!-- Description -->
          <div class="modal-field">
            <label for="task-desc" style="font-size:12px;font-weight:700;color:var(--ink-2)">Descrizione</label>
            <textarea
              id="task-desc"
              class="modal-input modal-textarea"
              placeholder="Aggiungi una descrizione…"
              rows="3"
              [value]="descVal()"
              (input)="descVal.set($any($event.target).value)"
            ></textarea>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <!-- Status -->
            <div class="modal-field">
              <label for="task-status" style="font-size:12px;font-weight:700;color:var(--ink-2)">Stato</label>
              <select
                id="task-status"
                class="modal-select"
                [value]="statusVal()"
                (change)="statusVal.set($any($event.target).value)"
              >
                @for (opt of statusOptions; track opt.value) {
                  <option [value]="opt.value">{{ opt.label }}</option>
                }
              </select>
            </div>

            <!-- Priority -->
            <div class="modal-field">
              <label for="task-priority" style="font-size:12px;font-weight:700;color:var(--ink-2)">Priorità</label>
              <select
                id="task-priority"
                class="modal-select"
                [value]="priorityVal()"
                (change)="priorityVal.set($any($event.target).value)"
              >
                @for (opt of priorityOptions; track opt.value) {
                  <option [value]="opt.value">{{ opt.label }}</option>
                }
              </select>
            </div>
          </div>

          <!-- Due date -->
          <div class="modal-field">
            <label for="task-due" style="font-size:12px;font-weight:700;color:var(--ink-2)">Scadenza</label>
            <input
              id="task-due"
              class="modal-input"
              type="date"
              [value]="dueDateVal()"
              (change)="dueDateVal.set($any($event.target).value)"
            />
          </div>

          <!-- Assignee -->
          <div class="modal-field">
            <label for="task-assignee" style="font-size:12px;font-weight:700;color:var(--ink-2)">Assegnato a</label>
            <select
              id="task-assignee"
              class="modal-select"
              [value]="assignedToIdVal()"
              (change)="assignedToIdVal.set($any($event.target).value ? +$any($event.target).value : null)"
            >
              <option value="">— Nessuno —</option>
              @for (u of users(); track u.id) {
                <option [value]="u.id">{{ displayName(u) }}</option>
              }
            </select>
          </div>
        </div>

        <!-- Footer actions -->
        <div style="display:flex;gap:8px;margin-top:24px;align-items:center">
          @if (task()) {
            <button class="btn-ghost" style="color:#dc2626;border-color:#fee2e2" (click)="onDelete()">
              <app-icon name="trash" [size]="15" />
              Elimina
            </button>
          }
          <div style="flex:1"></div>
          <button class="btn-ghost" (click)="closed.emit()">Annulla</button>
          <button
            class="btn-primary"
            [disabled]="!canSave()"
            (click)="onSave()"
          >
            {{ task() ? 'Salva modifiche' : 'Crea attività' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class TaskDetailComponent implements OnChanges {
  private readonly api = inject(TaskApiService);
  private readonly toast = inject(ToastService);

  readonly task = input<Task | null>(null);
  readonly users = input<AssignableUser[]>([]);

  readonly saved = output<Task>();
  readonly deleted = output<number>();
  readonly closed = output<void>();

  readonly statusOptions = STATUS_OPTIONS;
  readonly priorityOptions = PRIORITY_OPTIONS;

  readonly titleVal = signal('');
  readonly descVal = signal('');
  readonly statusVal = signal<string>('todo');
  readonly priorityVal = signal<string>('medium');
  readonly dueDateVal = signal('');
  readonly assignedToIdVal = signal<number | null>(null);

  readonly canSave = computed(() => this.titleVal().trim().length > 0);

  ngOnChanges(): void {
    const t = this.task();
    this.titleVal.set(t?.title ?? '');
    this.descVal.set(t?.description ?? '');
    this.statusVal.set(t?.status ?? 'todo');
    this.priorityVal.set(t?.priority ?? 'medium');
    this.dueDateVal.set(t?.dueDate ?? '');
    this.assignedToIdVal.set(t?.assignedTo?.id ?? null);
  }

  displayName(u: AssignableUser): string {
    if (u.seller) return [u.seller.name, u.seller.lastName].filter(Boolean).join(' ') || u.email;
    return u.email;
  }

  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return iso;
    }
  }

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }

  onSave(): void {
    const dto: CreateTaskDto = {
      title: this.titleVal().trim(),
      description: this.descVal().trim() || null,
      status: this.statusVal(),
      priority: this.priorityVal(),
      dueDate: this.dueDateVal() || null,
      assignedToId: this.assignedToIdVal(),
    };

    const t = this.task();
    if (t) {
      this.api.update(t.id, dto).subscribe({
        next: updated => {
          this.toast.success('Attività aggiornata');
          this.saved.emit(updated);
        },
        error: () => this.toast.error('Errore aggiornamento attività'),
      });
    } else {
      this.api.create(dto).subscribe({
        next: created => {
          this.toast.success('Attività creata');
          this.saved.emit(created);
        },
        error: () => this.toast.error('Errore creazione attività'),
      });
    }
  }

  onDelete(): void {
    const t = this.task();
    if (!t) return;
    if (!confirm('Eliminare questa attività?')) return;
    this.api.remove(t.id).subscribe({
      next: () => {
        this.toast.success('Attività eliminata');
        this.deleted.emit(t.id);
      },
      error: () => this.toast.error('Errore eliminazione attività'),
    });
  }
}
