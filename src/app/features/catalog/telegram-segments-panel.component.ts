import { Component, input, OnInit, signal, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogApiService, TelegramSegment, CreateTelegramSegmentDto } from '../../catalog/catalog-api.service';

interface SegmentForm {
  installmentNumber: number | null;
  telegramChatId: string;
  messageTemplate: string;
}

@Component({
  selector: 'app-telegram-segments-panel',
  imports: [FormsModule],
  styles: [`
    .tg-panel { margin-top: 1rem; border-top: 1px solid var(--border, #e5e7eb); padding-top: 1rem; }
    .tg-title { font-size: 13px; font-weight: 600; color: var(--ink-2, #555); margin-bottom: .5rem; display: flex; align-items: center; gap: .4rem; }
    .tg-table { width: 100%; font-size: 12px; border-collapse: collapse; }
    .tg-table th { text-align: left; color: var(--ink-3, #888); font-weight: 500; padding: 4px 6px; border-bottom: 1px solid var(--border, #e5e7eb); }
    .tg-table td { padding: 4px 6px; border-bottom: 1px solid var(--border-light, #f3f4f6); vertical-align: top; }
    .tg-msg { max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tg-add { margin-top: .75rem; display: grid; grid-template-columns: 60px 1fr 1fr auto; gap: .4rem; align-items: start; }
    .tg-add input, .tg-add textarea { font-size: 12px; padding: 4px 6px; border: 1px solid var(--border, #ddd); border-radius: 4px; width: 100%; box-sizing: border-box; }
    .tg-add textarea { resize: vertical; min-height: 40px; }
    .btn-sm { font-size: 11px; padding: 3px 8px; border: none; border-radius: 4px; cursor: pointer; }
    .btn-add { background: #2563eb; color: #fff; }
    .btn-add:disabled { opacity: .5; cursor: default; }
    .btn-del { background: #fee2e2; color: #dc2626; }
    .btn-edit { background: #f0fdf4; color: #15803d; }
    .btn-save { background: #2563eb; color: #fff; }
    .btn-cancel { background: #f3f4f6; color: #555; }
    .edit-row input, .edit-row textarea { width: 100%; font-size: 12px; padding: 3px 5px; border: 1px solid #93c5fd; border-radius: 3px; box-sizing: border-box; }
    .empty-note { font-size: 12px; color: var(--ink-3, #888); padding: 4px 0; }
    .err { color: #dc2626; font-size: 11px; margin-top: 4px; }
  `],
  template: `
    <div class="tg-panel">
      <div class="tg-title">
        <span>🔒 Sblocchi Telegram</span>
        <span style="font-weight:400;color:var(--ink-3)">(rata # → canale)</span>
      </div>

      @if (loading()) {
        <div class="empty-note">Caricamento…</div>
      } @else {
        <table class="tg-table">
          <thead>
            <tr>
              <th>Rata #</th>
              <th>Chat ID</th>
              <th>Messaggio DM</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (seg of segments(); track seg.id) {
              @if (editingId() === seg.id) {
                <tr class="edit-row">
                  <td><input type="number" [(ngModel)]="editForm.installmentNumber" /></td>
                  <td><input type="text" [(ngModel)]="editForm.telegramChatId" placeholder="-100…" /></td>
                  <td><textarea [(ngModel)]="editForm.messageTemplate" rows="2"></textarea></td>
                  <td style="white-space:nowrap">
                    <button class="btn-sm btn-save" (click)="saveEdit(seg)">Salva</button>
                    <button class="btn-sm btn-cancel" style="margin-left:4px" (click)="cancelEdit()">✕</button>
                  </td>
                </tr>
              } @else {
                <tr>
                  <td>{{ seg.installmentNumber === 0 ? 'Acconto' : seg.installmentNumber }}</td>
                  <td style="font-family:monospace;font-size:11px">{{ seg.telegramChatId }}</td>
                  <td class="tg-msg" [title]="seg.messageTemplate">{{ seg.messageTemplate }}</td>
                  <td style="white-space:nowrap">
                    <button class="btn-sm btn-edit" (click)="startEdit(seg)">✏️</button>
                    <button class="btn-sm btn-del" style="margin-left:4px" (click)="deleteSegment(seg.id)">🗑</button>
                  </td>
                </tr>
              }
            } @empty {
              <tr><td colspan="4" class="empty-note">Nessuno sblocco configurato per questa variante</td></tr>
            }
          </tbody>
        </table>

        <div class="tg-add">
          <input type="number" [ngModel]="newInstNum()" (ngModelChange)="newInstNum.set($event === '' || $event === null ? null : +$event)" placeholder="Rata #" min="0" />
          <input type="text" [ngModel]="newChatId()" (ngModelChange)="newChatId.set($event)" placeholder="Chat ID (es. -1001234…)" />
          <textarea [ngModel]="newMessage()" (ngModelChange)="newMessage.set($event)" placeholder="Testo DM da inviare al cliente" rows="2"></textarea>
          <button class="btn-sm btn-add" [disabled]="!canAdd()" (click)="addSegment()">+ Aggiungi</button>
        </div>
        @if (error()) {
          <div class="err">{{ error() }}</div>
        }
      }
    </div>
  `,
})
export class TelegramSegmentsPanelComponent implements OnInit {
  readonly variantId = input.required<number>();

  private readonly api = inject(CatalogApiService);

  readonly segments = signal<TelegramSegment[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly editingId = signal<number | null>(null);

  readonly newInstNum = signal<number | null>(null);
  readonly newChatId = signal('');
  readonly newMessage = signal('');
  editForm: SegmentForm = { installmentNumber: null, telegramChatId: '', messageTemplate: '' };

  readonly canAdd = computed(() =>
    this.newInstNum() !== null &&
    this.newChatId().trim().length > 0 &&
    this.newMessage().trim().length > 0
  );

  ngOnInit() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.api.getTelegramSegments(this.variantId()).subscribe({
      next: segs => { this.segments.set(segs); this.loading.set(false); },
      error: () => { this.error.set('Errore caricamento segmenti'); this.loading.set(false); },
    });
  }

  addSegment() {
    if (!this.canAdd()) return;
    const dto: CreateTelegramSegmentDto = {
      serviceVariantId: this.variantId(),
      installmentNumber: this.newInstNum()!,
      telegramChatId: this.newChatId().trim(),
      messageTemplate: this.newMessage().trim(),
    };
    this.api.createTelegramSegment(dto).subscribe({
      next: seg => {
        this.segments.update(list =>
          [...list, seg].sort((a, b) => a.installmentNumber - b.installmentNumber)
        );
        this.newInstNum.set(null);
        this.newChatId.set('');
        this.newMessage.set('');
        this.error.set(null);
      },
      error: () => this.error.set('Errore creazione segmento'),
    });
  }

  startEdit(seg: TelegramSegment) {
    this.editingId.set(seg.id);
    this.editForm = {
      installmentNumber: seg.installmentNumber,
      telegramChatId: seg.telegramChatId,
      messageTemplate: seg.messageTemplate,
    };
  }

  cancelEdit() {
    this.editingId.set(null);
  }

  saveEdit(seg: TelegramSegment) {
    this.api.updateTelegramSegment(seg.id, {
      installmentNumber: this.editForm.installmentNumber ?? seg.installmentNumber,
      telegramChatId: this.editForm.telegramChatId.trim(),
      messageTemplate: this.editForm.messageTemplate.trim(),
    }).subscribe({
      next: updated => {
        this.segments.update(list =>
          list.map(s => s.id === updated.id ? updated : s)
            .sort((a, b) => a.installmentNumber - b.installmentNumber)
        );
        this.editingId.set(null);
        this.error.set(null);
      },
      error: () => this.error.set('Errore salvataggio'),
    });
  }

  deleteSegment(id: number) {
    this.api.deleteTelegramSegment(id).subscribe({
      next: () => this.segments.update(list => list.filter(s => s.id !== id)),
      error: () => this.error.set('Errore eliminazione'),
    });
  }
}
