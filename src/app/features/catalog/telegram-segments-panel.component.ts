import { Component, input, OnInit, signal, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogApiService, TelegramSegment, CreateTelegramSegmentDto } from '../../catalog/catalog-api.service';
import { IconComponent } from '../../shared/icon.component';

interface SegmentForm {
  installmentNumber: number | null;
  telegramChatId: string;
  messageTemplate: string;
}

@Component({
  selector: 'app-telegram-segments-panel',
  imports: [FormsModule, IconComponent],
  styles: [`
    .tg-panel { padding: 1rem 1.25rem; }

    /* Title */
    .tg-title { font-size: 12px; font-weight: 700; color: var(--ink-2, #6b7280); text-transform: uppercase; letter-spacing: .06em; margin-bottom: .75rem; display: flex; align-items: center; gap: .4rem; }
    .tg-title-sub { font-weight: 400; color: var(--ink-3, #9ca3af); text-transform: none; letter-spacing: 0; }

    /* Table */
    .tg-table { width: 100%; font-size: 13px; border-collapse: collapse; margin-bottom: .75rem; }
    .tg-table th { text-align: left; color: var(--ink-3, #9ca3af); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: 6px 10px; border-bottom: 1.5px solid var(--border, #e5e7eb); }
    .tg-table td { padding: 8px 10px; border-bottom: 1px solid color-mix(in srgb, var(--border, #e5e7eb) 60%, transparent); vertical-align: middle; color: var(--ink, #111827); }
    .tg-table tr:last-child td { border-bottom: none; }
    .tg-mono { font-family: monospace; font-size: 12px; color: var(--ink-2, #6b7280); }
    .tg-msg { max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ink-2, #6b7280); font-size: 12px; }
    .tg-actions { display: flex; gap: 6px; justify-content: flex-end; }

    /* Buttons */
    .btn-icon { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: var(--radius-sm, 10px); font-size: 12px; font-weight: 600; cursor: pointer; transition: background .15s, color .15s, border-color .15s; border: 1.5px solid; }
    .btn-edit-row { border-color: var(--border, #e5e7eb); background: transparent; color: var(--ink-2, #6b7280); }
    .btn-edit-row:hover { border-color: var(--ink-2, #6b7280); color: var(--ink, #111827); }
    .btn-del-row { border-color: #fca5a5; background: transparent; color: #dc2626; }
    .btn-del-row:hover { background: #fee2e2; border-color: #f87171; }
    .btn-save-inline { border-color: var(--accent); background: var(--accent); color: #fff; }
    .btn-save-inline:hover { opacity: .9; }
    .btn-cancel-inline { border-color: var(--border, #e5e7eb); background: transparent; color: var(--ink-2, #6b7280); }
    .btn-cancel-inline:hover { border-color: var(--ink-2, #6b7280); color: var(--ink, #111827); }

    /* Edit row inputs */
    .edit-row td { background: color-mix(in srgb, var(--accent) 4%, transparent); }
    .edit-row input, .edit-row textarea { width: 100%; padding: 6px 8px; border: 1.5px solid #93c5fd; border-radius: 6px; font-size: 12px; box-sizing: border-box; outline: none; }
    .edit-row input:focus, .edit-row textarea:focus { border-color: var(--accent); }

    /* Add form */
    .tg-add-section { border-top: 1px solid var(--border, #e5e7eb); padding-top: .75rem; margin-top: .25rem; }
    .tg-add-grid { display: grid; grid-template-columns: 80px 1fr 1fr; gap: 8px; margin-bottom: 8px; }
    .tg-add-field { display: flex; flex-direction: column; gap: 3px; }
    .tg-add-label { font-size: 10px; font-weight: 700; color: var(--ink-3, #9ca3af); text-transform: uppercase; letter-spacing: .04em; }
    .tg-add-input { padding: 7px 10px; border: 1.5px solid var(--border, #e5e7eb); border-radius: 8px; font-size: 13px; color: var(--ink, #111827); background: var(--surface, #fff); outline: none; transition: border-color .15s; width: 100%; box-sizing: border-box; }
    .tg-add-input:focus { border-color: var(--accent); }
    .tg-add-input::placeholder { color: var(--ink-3, #9ca3af); }
    .tg-add-textarea { resize: vertical; min-height: 48px; }
    .tg-add-footer { display: flex; align-items: center; gap: 8px; }
    .btn-add { display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; border-radius: var(--radius-sm, 10px); border: none; background: var(--accent); color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity .15s; }
    .btn-add:disabled { opacity: .4; cursor: not-allowed; }
    .btn-add:not(:disabled):hover { opacity: .88; }

    /* States */
    .empty-note { font-size: 13px; color: var(--ink-3, #9ca3af); padding: 6px 0 4px; }
    .err { color: #dc2626; font-size: 12px; margin-top: 4px; }
    .loading-note { font-size: 13px; color: var(--ink-3, #9ca3af); padding: 4px 0; }
  `],
  template: `
    <div class="tg-panel">
      <div class="tg-title">
        <span>Sblocchi Telegram</span>
        <span class="tg-title-sub">(rata # → canale)</span>
      </div>

      @if (loading()) {
        <div class="loading-note">Caricamento…</div>
      } @else {
        <table class="tg-table" aria-label="Sblocchi Telegram configurati">
          <thead>
            <tr>
              <th scope="col">Rata #</th>
              <th scope="col">Chat ID</th>
              <th scope="col">Messaggio DM</th>
              <th scope="col" aria-label="Azioni"></th>
            </tr>
          </thead>
          <tbody>
            @for (seg of segments(); track seg.id) {
              @if (editingId() === seg.id) {
                <tr class="edit-row">
                  <td><input type="number" [(ngModel)]="editForm.installmentNumber" aria-label="Numero rata" /></td>
                  <td><input type="text" [(ngModel)]="editForm.telegramChatId" placeholder="-100…" aria-label="Chat ID" /></td>
                  <td><textarea [(ngModel)]="editForm.messageTemplate" rows="2" aria-label="Messaggio DM"></textarea></td>
                  <td>
                    <div class="tg-actions">
                      <button class="btn-icon btn-save-inline" (click)="saveEdit(seg)" aria-label="Salva">Salva</button>
                      <button class="btn-icon btn-cancel-inline" (click)="cancelEdit()" aria-label="Annulla">Annulla</button>
                    </div>
                  </td>
                </tr>
              } @else {
                <tr>
                  <td>{{ seg.installmentNumber === 0 ? 'Acconto' : 'Rata ' + seg.installmentNumber }}</td>
                  <td class="tg-mono">{{ seg.telegramChatId }}</td>
                  <td class="tg-msg" [title]="seg.messageTemplate">{{ seg.messageTemplate }}</td>
                  <td>
                    <div class="tg-actions">
                      <button class="btn-icon btn-edit-row" (click)="startEdit(seg)" [attr.aria-label]="'Modifica sblocco rata ' + seg.installmentNumber">
                        <app-icon name="edit" [size]="13" />
                      </button>
                      <button class="btn-icon btn-del-row" (click)="deleteSegment(seg.id)" [attr.aria-label]="'Elimina sblocco rata ' + seg.installmentNumber">
                        <app-icon name="x" [size]="13" />
                      </button>
                    </div>
                  </td>
                </tr>
              }
            } @empty {
              <tr>
                <td colspan="4" class="empty-note">Nessuno sblocco configurato per questa variante</td>
              </tr>
            }
          </tbody>
        </table>

        <div class="tg-add-section">
          <div class="tg-add-grid">
            <label class="tg-add-field">
              <span class="tg-add-label">Rata #</span>
              <input
                class="tg-add-input"
                type="number"
                min="0"
                placeholder="0"
                [ngModel]="newInstNum()"
                (ngModelChange)="newInstNum.set($event === '' || $event === null ? null : +$event)"
                aria-label="Numero rata"
              />
            </label>
            <label class="tg-add-field">
              <span class="tg-add-label">Chat ID</span>
              <input
                class="tg-add-input"
                type="text"
                placeholder="-1001234…"
                [ngModel]="newChatId()"
                (ngModelChange)="newChatId.set($event)"
                aria-label="Chat ID Telegram"
              />
            </label>
            <label class="tg-add-field">
              <span class="tg-add-label">Messaggio DM</span>
              <textarea
                class="tg-add-input tg-add-textarea"
                rows="2"
                placeholder="Testo da inviare al cliente…"
                [ngModel]="newMessage()"
                (ngModelChange)="newMessage.set($event)"
                aria-label="Testo messaggio DM"
              ></textarea>
            </label>
          </div>
          <div class="tg-add-footer">
            <button class="btn-add" [disabled]="!canAdd()" (click)="addSegment()">
              <app-icon name="plus" [size]="14" />
              Aggiungi
            </button>
            @if (error()) {
              <span class="err" role="alert">{{ error() }}</span>
            }
          </div>
        </div>
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
