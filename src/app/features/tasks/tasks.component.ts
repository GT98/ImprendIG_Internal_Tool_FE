import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TaskApiService } from '../../tasks/task-api.service';
import { AuthService } from '../../auth/auth.service';
import { ToastService } from '../../shared/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { TaskKanbanComponent } from './task-kanban.component';
import { TaskListComponent } from './task-list.component';
import { TaskDetailComponent } from './task-detail.component';
import type { Task, TaskPriority, TaskStatus } from '../../models';

const STATUS_OPTIONS: { value: TaskStatus | ''; label: string }[] = [
  { value: '', label: 'Tutti gli stati' },
  { value: 'todo', label: 'Da fare' },
  { value: 'in_progress', label: 'In corso' },
  { value: 'review', label: 'In revisione' },
  { value: 'done', label: 'Fatto' },
];

const PRIORITY_OPTIONS: { value: TaskPriority | ''; label: string }[] = [
  { value: '', label: 'Tutte le priorità' },
  { value: 'urgent', label: 'Urgente' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Media' },
  { value: 'low', label: 'Bassa' },
];

@Component({
  selector: 'app-tasks',
  imports: [IconComponent, TaskKanbanComponent, TaskListComponent, TaskDetailComponent],
  styleUrl: './tasks.component.css',
  template: `
    <div class="page">
      <!-- Header -->
      <div class="page-head">
        <div>
          <h1>Task Tracker</h1>
          <p class="page-sub">Gestisci e traccia le attività del team.</p>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          @if (!tasksResource.isLoading()) {
            <span class="muted-pill">{{ filtered().length }}</span>
          }
          <button class="btn-primary" (click)="openCreate()">
            <app-icon name="plus" [size]="16" />
            Nuova attività
          </button>
        </div>
      </div>

      <!-- Toolbar riga 1: ricerca -->
      <div class="toolbar">
        <div class="search-box" style="flex:1;max-width:420px">
          <app-icon name="search" [size]="16" />
          <input
            type="search"
            placeholder="Cerca attività…"
            [value]="search()"
            (input)="search.set($any($event.target).value)"
            aria-label="Cerca attività"
          />
        </div>

        <!-- Reset filtri (visibile solo se ci sono filtri attivi) -->
        @if (hasActiveFilters()) {
          <button
            class="seg-btn"
            style="border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--ink-2)"
            (click)="resetFilters()"
          >
            <app-icon name="x" [size]="13" />
            Reset
          </button>
        }

        <!-- View toggle -->
        <div class="segmented" style="margin-left:auto" role="group" aria-label="Vista">
          <button
            class="seg-btn"
            [class.active]="view() === 'kanban'"
            (click)="view.set('kanban')"
            [attr.aria-pressed]="view() === 'kanban'"
          >
            <app-icon name="grid" [size]="14" />
            Kanban
          </button>
          <button
            class="seg-btn"
            [class.active]="view() === 'list'"
            (click)="view.set('list')"
            [attr.aria-pressed]="view() === 'list'"
          >
            <app-icon name="filter" [size]="14" />
            Lista
          </button>
        </div>
      </div>

      <!-- Toolbar riga 2: filtri combinati -->
      <div class="filter-bar">
        <!-- Assegnato a -->
        <div class="filter-chip" [class.filter-chip--active]="filterAssigneeId() !== ''">
          <app-icon name="users" [size]="13" />
          <select
            class="filter-select"
            [value]="filterAssigneeId()"
            (change)="filterAssigneeId.set($any($event.target).value)"
            aria-label="Filtra per assegnatario"
          >
            <option value="">Assegnato a: Tutti</option>
            <option value="me">Solo io</option>
            @for (u of usersResource.value() ?? []; track u.id) {
              <option [value]="u.id">{{ displayUserName(u) }}</option>
            }
          </select>
        </div>

        <!-- Stato -->
        <div class="filter-chip" [class.filter-chip--active]="filterStatus() !== ''">
          <app-icon name="activity" [size]="13" />
          <select
            class="filter-select"
            [value]="filterStatus()"
            (change)="filterStatus.set($any($event.target).value)"
            aria-label="Filtra per stato"
          >
            @for (opt of statusOptions; track opt.value) {
              <option [value]="opt.value">{{ opt.value === '' ? 'Stato: Tutti' : opt.label }}</option>
            }
          </select>
        </div>

        <!-- Priorità -->
        <div class="filter-chip" [class.filter-chip--active]="filterPriority() !== ''">
          <app-icon name="alertTriangle" [size]="13" />
          <select
            class="filter-select"
            [value]="filterPriority()"
            (change)="filterPriority.set($any($event.target).value)"
            aria-label="Filtra per priorità"
          >
            @for (opt of priorityOptions; track opt.value) {
              <option [value]="opt.value">{{ opt.value === '' ? 'Priorità: Tutte' : opt.label }}</option>
            }
          </select>
        </div>
      </div>

      <!-- Loading -->
      @if (tasksResource.isLoading()) {
        <div style="padding:48px;text-align:center;color:var(--ink-3)">
          <span>Caricamento…</span>
        </div>
      } @else {
        @if (view() === 'kanban') {
          <app-task-kanban
            [tasks]="filtered()"
            (taskClick)="openEdit($event)"
            (statusChange)="onStatusChange($event)"
          />
        } @else {
          <app-task-list
            [tasks]="filtered()"
            (taskClick)="openEdit($event)"
          />
        }
      }
    </div>

    <!-- Drawer -->
    @if (drawerOpen()) {
      <app-task-detail
        [task]="editingTask()"
        [users]="usersResource.value() ?? []"
        (saved)="onSaved($event)"
        (deleted)="onDeleted($event)"
        (closed)="closeDrawer()"
      />
    }
  `,
})
export class TasksComponent {
  private readonly api = inject(TaskApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly view = signal<'kanban' | 'list'>('kanban');
  readonly search = signal('');
  readonly filterAssigneeId = signal<string>('');
  readonly filterStatus = signal<string>('');
  readonly filterPriority = signal<string>('');
  readonly drawerOpen = signal(false);
  readonly editingTask = signal<Task | null>(null);

  readonly statusOptions = STATUS_OPTIONS;
  readonly priorityOptions = PRIORITY_OPTIONS;

  readonly tasksResource = rxResource({
    stream: () => this.api.getAll(),
  });

  readonly usersResource = rxResource({
    stream: () => this.api.getAssignableUsers(),
  });

  readonly localTasks = signal<Task[]>([]);

  readonly allTasks = computed(() => {
    const local = this.localTasks();
    return local.length > 0 ? local : (this.tasksResource.value() ?? []);
  });

  readonly hasActiveFilters = computed(() =>
    this.search().trim() !== '' ||
    this.filterAssigneeId() !== '' ||
    this.filterStatus() !== '' ||
    this.filterPriority() !== '',
  );

  readonly filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    const priority = this.filterPriority();
    const status = this.filterStatus();
    const assigneeId = this.filterAssigneeId();
    const currentUserId = this.auth.currentUser()?.id;

    return this.allTasks().filter(t => {
      const matchesSearch = !q || t.title.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q);
      const matchesPriority = !priority || t.priority === priority;
      const matchesStatus = !status || t.status === status;
      const matchesAssignee = !assigneeId ||
        (assigneeId === 'me' ? Number(t.assignedTo?.id) === currentUserId : Number(t.assignedTo?.id) === Number(assigneeId));
      return matchesSearch && matchesPriority && matchesStatus && matchesAssignee;
    });
  });

  displayUserName(u: { email: string; seller: { name: string; lastName: string } | null }): string {
    if (u.seller) return [u.seller.name, u.seller.lastName].filter(Boolean).join(' ').trim() || u.email;
    return u.email;
  }

  resetFilters(): void {
    this.search.set('');
    this.filterAssigneeId.set('');
    this.filterStatus.set('');
    this.filterPriority.set('');
  }

  openCreate(): void {
    this.editingTask.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(task: Task): void {
    this.editingTask.set(task);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.editingTask.set(null);
  }

  onSaved(task: Task): void {
    const current = this.tasksResource.value() ?? [];
    const idx = current.findIndex(t => t.id === task.id);
    if (idx >= 0) {
      const updated = [...current];
      updated[idx] = task;
      this.localTasks.set(updated);
    } else {
      this.localTasks.set([task, ...current]);
    }
    this.closeDrawer();
  }

  onDeleted(id: number): void {
    const current = this.tasksResource.value() ?? [];
    this.localTasks.set(current.filter(t => t.id !== id));
    this.closeDrawer();
  }

  onStatusChange(event: { task: Task; newStatus: string }): void {
    const { task, newStatus } = event;
    const current = this.tasksResource.value() ?? [];
    const optimistic = current.map(t => t.id === task.id ? { ...t, status: newStatus as Task['status'] } : t);
    this.localTasks.set(optimistic);

    this.api.update(task.id, { status: newStatus }).subscribe({
      next: updated => {
        const latest = this.localTasks();
        this.localTasks.set(latest.map(t => t.id === updated.id ? updated : t));
      },
      error: () => {
        this.toast.error('Errore aggiornamento stato');
        this.localTasks.set(current);
      },
    });
  }
}
