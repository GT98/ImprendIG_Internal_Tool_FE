import { Component, inject, input, linkedSignal, output, signal } from '@angular/core';
import { SaleApiService } from '../sales/sale-api.service';
import { ToastService } from './toast.service';
import { IconComponent } from './icon.component';
import { AffiancamentoDto, UpdateAffiancamentoDto, affiancamentoLabel, fmtIsoDate } from './affiancamento';

// Date di affiancamento per percorso. La data si imposta da sola al pagamento
// della rata di sblocco; l'admin può cambiare l'ordine dei percorsi o forzare una data.
@Component({
  selector: 'app-affiancamenti-editor',
  imports: [IconComponent],
  template: `
    @if (items().length === 0) {
      <span class="muted">Affiancamento non incluso nel piano</span>
    } @else {
      <ul class="aff-list">
        @for (a of items(); track a.clientId; let first = $first; let last = $last) {
          <li class="aff-item">
            @if (items().length > 1) {
              <span class="aff-pos" aria-hidden="true">{{ a.position }}°</span>
            }
            <span class="aff-name">{{ a.academy }}</span>

            @if (editable() && editingId() === a.clientId) {
              <input
                type="date"
                class="aff-input"
                [value]="draft()"
                (input)="draft.set($any($event.target).value)"
                [attr.aria-label]="'Data affiancamento ' + a.academy"
                [disabled]="saving()"
              />
              <button type="button" class="icon-btn sm" (click)="saveDate(a)" [disabled]="saving()" aria-label="Salva data">
                <app-icon name="check" [size]="14" />
              </button>
              <button type="button" class="icon-btn sm" (click)="editingId.set(null)" [disabled]="saving()" aria-label="Annulla">
                <app-icon name="x" [size]="14" />
              </button>
            } @else {
              <span class="aff-date" [class.pending]="!a.startDate">{{ label(a) }}</span>
              @if (a.endDate) {
                <span class="aff-end">→ {{ fmtDate(a.endDate) }}</span>
              }
              @if (a.durationMonths) {
                <span class="aff-tag">{{ a.durationMonths }} mesi</span>
              }
              @if (a.source === 'manual') {
                <span class="aff-tag">manuale</span>
              }
              @if (editable()) {
                <span class="aff-actions">
                  @if (canReorder() && items().length > 1) {
                    <button type="button" class="icon-btn sm" (click)="move(a, -1)" [disabled]="saving() || first"
                      [attr.aria-label]="'Sposta ' + a.academy + ' prima'">
                      <app-icon name="arrowUp" [size]="13" />
                    </button>
                    <button type="button" class="icon-btn sm" (click)="move(a, 1)" [disabled]="saving() || last"
                      [attr.aria-label]="'Sposta ' + a.academy + ' dopo'">
                      <app-icon name="arrowDown" [size]="13" />
                    </button>
                  }
                  <button type="button" class="icon-btn sm" (click)="startEdit(a)" [disabled]="saving()"
                    [attr.aria-label]="'Modifica data ' + a.academy">
                    <app-icon name="edit" [size]="13" />
                  </button>
                  @if (a.source === 'manual') {
                    <button type="button" class="icon-btn sm" (click)="resetDate(a)" [disabled]="saving()"
                      [attr.aria-label]="'Ripristina data automatica ' + a.academy">
                      <app-icon name="refresh" [size]="13" />
                    </button>
                  }
                </span>
              }
            }
          </li>
        }
      </ul>
      @if (editable() && canReorder() && items().length > 1) {
        <p class="aff-hint">Predefinito: UGC Level Up come primo percorso. Cambia l'ordine se la cliente ha scelto diversamente.</p>
      }
      @if (editable()) {
        <p class="aff-hint">La fine si calcola dall'inizio: +3 mesi per i piani Base, +6 per gli Avanzato.</p>
      }
    }
  `,
  styles: [`
    :host { display: block; }
    .aff-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    .aff-item { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 0.86rem; }
    .aff-pos { min-width: 22px; font-weight: 700; color: var(--ink-2); font-variant-numeric: tabular-nums; }
    .aff-name { font-weight: 600; color: var(--ink); }
    .aff-date { font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; }
    .aff-date.pending { color: var(--ink-2); font-weight: 600; }
    .aff-end { color: var(--ink-2); font-weight: 600; font-variant-numeric: tabular-nums; }
    .aff-tag { font-size: 0.7rem; font-weight: 700; padding: 1px 7px; border-radius: 20px; background: var(--surface-2); color: var(--ink-2); }
    .aff-actions { display: inline-flex; gap: 2px; margin-left: auto; }
    .aff-input { background: var(--surface); color: var(--ink); border: 1px solid var(--border); border-radius: 6px; padding: 3px 6px; font-size: 0.85rem; }
    .aff-hint { margin: 6px 0 0; font-size: 0.75rem; color: var(--ink-2); }
    .muted { color: var(--ink-2); font-size: 0.85rem; }
  `],
})
export class AffiancamentiEditorComponent {
  private readonly api = inject(SaleApiService);
  private readonly toast = inject(ToastService);

  readonly saleId = input.required<number>();
  readonly affiancamenti = input<AffiancamentoDto[] | undefined>([]);
  readonly editable = input(false);
  // l'ordine dei percorsi nei bundle lo cambia solo l'admin
  readonly canReorder = input(true);
  readonly changed = output<AffiancamentoDto[]>();

  readonly items = linkedSignal(() => this.affiancamenti() ?? []);
  readonly editingId = signal<number | null>(null);
  readonly draft = signal('');
  readonly saving = signal(false);

  readonly label = affiancamentoLabel;
  readonly fmtDate = fmtIsoDate;

  startEdit(a: AffiancamentoDto): void {
    this.draft.set(a.startDate ?? '');
    this.editingId.set(a.clientId);
  }

  saveDate(a: AffiancamentoDto): void {
    if (!this.draft()) return;
    this.save({ overrides: { [a.clientId]: this.draft() } }, 'Data affiancamento salvata');
  }

  resetDate(a: AffiancamentoDto): void {
    this.save({ overrides: { [a.clientId]: null } }, 'Data automatica ripristinata');
  }

  move(a: AffiancamentoDto, dir: -1 | 1): void {
    const order = this.items().map(i => Number(i.clientId));
    const idx = order.indexOf(Number(a.clientId));
    const to = idx + dir;
    if (to < 0 || to >= order.length) return;
    [order[idx], order[to]] = [order[to], order[idx]];
    this.save({ academyOrder: order }, 'Ordine dei percorsi aggiornato');
  }

  private save(dto: UpdateAffiancamentoDto, okMsg: string): void {
    this.saving.set(true);
    this.api.updateAffiancamento(Number(this.saleId()), dto).subscribe({
      next: res => {
        this.saving.set(false);
        this.editingId.set(null);
        this.items.set(res.affiancamenti);
        this.changed.emit(res.affiancamenti);
        this.toast.success(okMsg);
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Impossibile salvare');
      },
    });
  }
}
