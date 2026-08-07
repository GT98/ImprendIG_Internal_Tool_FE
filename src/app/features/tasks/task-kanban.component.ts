import { Component, input, OnChanges, output, signal, SimpleChanges } from '@angular/core';
import { CdkDrag, CdkDropList, CdkDropListGroup, CdkDragDrop } from '@angular/cdk/drag-drop';
import { IconComponent } from '../../shared/icon.component';
import type { Task } from '../../models';

interface Column {
  id: string;
  label: string;
  dot: string;
}

const COLUMNS: Column[] = [
  { id: 'todo', label: 'Da fare', dot: '#3b82f6' },
  { id: 'in_progress', label: 'In corso', dot: '#f59e0b' },
  { id: 'review', label: 'In revisione', dot: '#8b5cf6' },
  { id: 'done', label: 'Fatto', dot: '#10b981' },
];

const PRIORITY_COLORS: Record<string, { bg: string; color: string }> = {
  low: { bg: '#f3f4f6', color: '#6b7280' },
  medium: { bg: '#dbeafe', color: '#1d4ed8' },
  high: { bg: '#ffedd5', color: '#c2410c' },
  urgent: { bg: '#fee2e2', color: '#b91c1c' },
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Bassa', medium: 'Media', high: 'Alta', urgent: 'Urgente',
};

@Component({
  selector: 'app-task-kanban',
  imports: [CdkDrag, CdkDropList, CdkDropListGroup, IconComponent],
  styles: [`
    .kanban-board { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; align-items: start; }
    .task-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 13px; box-shadow: var(--shadow-sm); cursor: pointer; transition: .13s; margin-bottom: 8px; }
    .task-card:hover { border-color: var(--accent-soft-2); transform: translateY(-1px); box-shadow: var(--shadow); }
    .cdk-drag-preview { border: 1px solid var(--accent-soft-2); border-radius: var(--radius-sm); padding: 13px; background: var(--surface); box-shadow: var(--shadow-lg); opacity: .95; }
    .cdk-drag-placeholder { opacity: 0.3; }
    .cdk-drag-animating { transition: transform 200ms cubic-bezier(0, 0, 0.2, 1); }
    .drop-list.cdk-drop-list-dragging .task-card:not(.cdk-drag-placeholder) { transition: transform 200ms cubic-bezier(0, 0, 0.2, 1); }
  `],
  template: `
    <div class="kanban-board" cdkDropListGroup>
      @for (col of columns; track col.id) {
        <div class="kanban-col">
          <div class="kanban-head">
            <span class="kanban-dot" [style.background]="col.dot"></span>
            <span class="kanban-title">{{ col.label }}</span>
            <span class="kanban-count">{{ byColumn(col.id).length }}</span>
          </div>

          <div
            class="kanban-cards drop-list"
            cdkDropList
            [cdkDropListData]="col.id"
            (cdkDropListDropped)="onDrop($event)"
            [attr.aria-label]="'Colonna ' + col.label"
            style="min-height:60px"
          >
            @for (task of byColumn(col.id); track task.id) {
              <div
                class="task-card"
                cdkDrag
                [cdkDragData]="task"
                (click)="taskClick.emit(task)"
                [attr.aria-label]="'Attività: ' + task.title"
                role="button"
                tabindex="0"
                (keydown.enter)="taskClick.emit(task)"
              >
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px">
                  <span style="font-weight:700;font-size:13.5px;line-height:1.35">{{ task.title }}</span>
                  <span
                    class="badge"
                    style="font-size:11px;padding:2px 7px;flex-shrink:0"
                    [style.background]="priorityColor(task.priority).bg"
                    [style.color]="priorityColor(task.priority).color"
                  >{{ priorityLabel(task.priority) }}</span>
                </div>
                @if (task.description) {
                  <p style="font-size:12px;color:var(--ink-3);margin-bottom:8px;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">
                    {{ task.description }}
                  </p>
                }
                <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px">
                  @if (task.assignedTo) {
                    <span style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--ink-2)">
                      <span class="avatar" style="width:22px;height:22px;font-size:9px;background:var(--accent-soft);color:var(--accent)">
                        {{ initials(task.assignedTo) }}
                      </span>
                      {{ displayName(task.assignedTo) }}
                    </span>
                  } @else {
                    <span></span>
                  }
                  @if (task.dueDate) {
                    <span
                      style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600"
                      [style.color]="isOverdue(task) ? '#b91c1c' : 'var(--ink-3)'"
                    >
                      <app-icon name="calendar" [size]="11" />
                      {{ formatDate(task.dueDate) }}
                    </span>
                  }
                </div>
              </div>
            }

            @if (byColumn(col.id).length === 0) {
              <div class="kanban-empty">Nessuna attività</div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class TaskKanbanComponent implements OnChanges {
  readonly tasks = input<Task[]>([]);
  readonly taskClick = output<Task>();
  readonly statusChange = output<{ task: Task; newStatus: string }>();

  readonly columns = COLUMNS;

  private tasksByCol = signal<Record<string, Task[]>>({});

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tasks']) {
      const map: Record<string, Task[]> = {};
      for (const col of COLUMNS) map[col.id] = [];
      for (const t of this.tasks()) {
        const col = map[t.status] ? t.status : 'todo';
        map[col].push(t);
      }
      this.tasksByCol.set(map);
    }
  }

  byColumn(colId: string): Task[] {
    return this.tasksByCol()[colId] ?? [];
  }

  onDrop(event: CdkDragDrop<string>): void {
    const task: Task = event.item.data;
    const newStatus = event.container.data;
    if (task.status === newStatus) return;
    this.statusChange.emit({ task, newStatus });
  }

  priorityColor(p: string) { return PRIORITY_COLORS[p] ?? { bg: '#f3f4f6', color: '#6b7280' }; }
  priorityLabel(p: string): string { return PRIORITY_LABELS[p] ?? p; }

  displayName(u: { email: string; seller: { name: string; lastName: string } | null }): string {
    if (u.seller) return [u.seller.name, u.seller.lastName].filter(Boolean).join(' ').trim() || u.email;
    return u.email;
  }

  initials(u: { email: string; seller: { name: string; lastName: string } | null }): string {
    if (u.seller) {
      const i = ((u.seller.name ?? '').charAt(0) + (u.seller.lastName ?? '').charAt(0)).toUpperCase();
      return i || u.email.charAt(0).toUpperCase();
    }
    return u.email.charAt(0).toUpperCase();
  }

  formatDate(date: string): string {
    try {
      return new Date(date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
    } catch {
      return date;
    }
  }

  isOverdue(task: Task): boolean {
    if (!task.dueDate || task.status === 'done') return false;
    return new Date(task.dueDate) < new Date(new Date().toISOString().slice(0, 10));
  }
}
