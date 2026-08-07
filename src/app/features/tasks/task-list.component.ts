import { Component, input, output } from '@angular/core';
import { IconComponent } from '../../shared/icon.component';
import type { AssignableUser, Task } from '../../models';

const STATUS_LABELS: Record<string, string> = {
  todo: 'Da fare',
  in_progress: 'In corso',
  review: 'In revisione',
  done: 'Fatto',
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  todo: { bg: '#dbeafe', color: '#1e40af' },
  in_progress: { bg: '#fef3c7', color: '#92400e' },
  review: { bg: '#ede9fe', color: '#6d28d9' },
  done: { bg: '#d1fae5', color: '#065f46' },
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Bassa',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
};

const PRIORITY_COLORS: Record<string, { bg: string; color: string }> = {
  low: { bg: '#f3f4f6', color: '#6b7280' },
  medium: { bg: '#dbeafe', color: '#1d4ed8' },
  high: { bg: '#ffedd5', color: '#c2410c' },
  urgent: { bg: '#fee2e2', color: '#b91c1c' },
};

@Component({
  selector: 'app-task-list',
  imports: [IconComponent],
  template: `
    <div class="table" role="table" aria-label="Lista attività">
      <!-- Header -->
      <div class="tr th" style="grid-template-columns:2.5fr 1.4fr .9fr .9fr .9fr 90px" role="row">
        <span role="columnheader">Titolo</span>
        <span role="columnheader">Assegnato a</span>
        <span role="columnheader">Priorità</span>
        <span role="columnheader">Stato</span>
        <span role="columnheader">Scadenza</span>
        <span role="columnheader">Azioni</span>
      </div>

      @if (tasks().length === 0) {
        <div style="padding:32px;text-align:center;color:var(--ink-3)">
          <app-icon name="checkSquare" [size]="32" />
          <p style="margin-top:10px;font-size:13.5px">Nessuna attività trovata</p>
        </div>
      }

      @for (task of tasks(); track task.id) {
        <button
          class="tr tr-click"
          style="grid-template-columns:2.5fr 1.4fr .9fr .9fr .9fr 90px"
          (click)="taskClick.emit(task)"
          role="row"
          [attr.aria-label]="'Apri attività: ' + task.title"
        >
          <span class="td-strong" style="text-align:left">{{ task.title }}</span>
          <span class="td-seller">
            @if (task.assignedTo) {
              <span
                class="avatar"
                style="width:26px;height:26px;font-size:10px;background:var(--accent-soft);color:var(--accent)"
              >{{ initials(task.assignedTo) }}</span>
              {{ displayName(task.assignedTo) }}
            } @else {
              <span class="td-empty">—</span>
            }
          </span>
          <span>
            <span
              class="badge"
              [style.background]="priorityColor(task.priority).bg"
              [style.color]="priorityColor(task.priority).color"
            >{{ priorityLabel(task.priority) }}</span>
          </span>
          <span>
            <span
              class="badge"
              [style.background]="statusColor(task.status).bg"
              [style.color]="statusColor(task.status).color"
            >{{ statusLabel(task.status) }}</span>
          </span>
          <span style="font-size:13px;color:var(--ink-2)" [style.color]="isOverdue(task) ? '#b91c1c' : ''">
            {{ task.dueDate ? formatDate(task.dueDate) : '—' }}
          </span>
          <span style="display:flex;gap:4px" (click)="$event.stopPropagation()">
            <button class="icon-btn" style="width:30px;height:30px" (click)="taskClick.emit(task)" aria-label="Modifica">
              <app-icon name="edit" [size]="15" />
            </button>
          </span>
        </button>
      }
    </div>
  `,
})
export class TaskListComponent {
  readonly tasks = input<Task[]>([]);
  readonly taskClick = output<Task>();

  statusLabel(s: string): string { return STATUS_LABELS[s] ?? s; }
  statusColor(s: string) { return STATUS_COLORS[s] ?? { bg: '#f3f4f6', color: '#6b7280' }; }
  priorityLabel(p: string): string { return PRIORITY_LABELS[p] ?? p; }
  priorityColor(p: string) { return PRIORITY_COLORS[p] ?? { bg: '#f3f4f6', color: '#6b7280' }; }

  displayName(u: { email: string; seller: { name: string; lastName: string } | null }): string {
    if (u.seller) return [u.seller.name, u.seller.lastName].filter(Boolean).join(' ') || u.email;
    return u.email;
  }

  initials(u: { email: string; seller: { name: string; lastName: string } | null }): string {
    if (u.seller) {
      return ((u.seller.name ?? '').charAt(0) + (u.seller.lastName ?? '').charAt(0)).toUpperCase() || '??';
    }
    return u.email.charAt(0).toUpperCase();
  }

  formatDate(date: string): string {
    try {
      return new Date(date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return date;
    }
  }

  isOverdue(task: Task): boolean {
    if (!task.dueDate || task.status === 'done') return false;
    return new Date(task.dueDate) < new Date(new Date().toISOString().slice(0, 10));
  }
}
