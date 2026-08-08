import { Component, inject, signal } from '@angular/core';
import { VoiceRecorderService } from './voice-recorder.service';
import { IconComponent } from '../../shared/icon.component';
import { ToastService } from '../../shared/toast.service';

const IS_IOS = /iP(hone|ad|od)/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');

@Component({
  selector: 'app-voice-recorder',
  imports: [IconComponent],
  styles: [`
    .rec-fab {
      position: fixed; bottom: 92px; right: 24px; z-index: 49;
      width: 52px; height: 52px; border-radius: 50%;
      background: var(--surface); color: var(--ink-2);
      box-shadow: var(--shadow-lg); display: flex; align-items: center; justify-content: center;
      border: 1.5px solid var(--border); transition: background .15s, color .15s;
    }
    .rec-fab:hover { background: var(--bg); color: var(--accent); }
    .rec-fab.recording { background: #fee2e2; color: #dc2626; border-color: #fca5a5; animation: rec-pulse 1.4s ease-in-out infinite; }

    @keyframes rec-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,.4); }
      50%       { box-shadow: 0 0 0 10px rgba(220,38,38,0); }
    }

    .rec-panel {
      position: fixed; bottom: 156px; right: 24px; z-index: 49;
      width: 300px; background: var(--surface); border-radius: var(--radius);
      box-shadow: var(--shadow-lg); border: 1px solid var(--border);
      padding: 16px;
    }

    .rec-timer-row {
      display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
    }
    .rec-dot {
      width: 10px; height: 10px; border-radius: 50%; background: #dc2626; flex-shrink: 0;
      animation: rec-dot-blink .9s ease-in-out infinite;
    }
    @keyframes rec-dot-blink { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }

    .rec-timer { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: .02em; }
    .rec-label { font-size: 12px; color: var(--ink-3); }
    .rec-ios-warn {
      display: flex; align-items: flex-start; gap: 6px;
      font-size: 11.5px; color: #92400e; background: #fef3c7;
      border-radius: 7px; padding: 8px 10px; margin-bottom: 12px; line-height: 1.4;
    }
    .rec-review-title {
      font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 4px;
    }
    .rec-review-dur {
      font-size: 12px; color: var(--ink-3); margin-bottom: 12px;
    }
    .rec-error {
      font-size: 12px; color: #dc2626; background: #fee2e2;
      border-radius: 7px; padding: 8px 10px; margin-bottom: 12px;
    }
    .rec-linked {
      font-size: 11.5px; color: var(--ink-3); margin-bottom: 10px;
      background: var(--accent-soft); border-radius: 6px; padding: 5px 8px;
    }
    .rec-actions { display: flex; gap: 8px; }
    .rec-actions .btn-ghost { flex: 1; padding: 8px 10px; font-size: 12.5px; }
    .rec-actions .btn-primary { flex: 1.5; font-size: 12.5px; }
  `],
  template: `
    <!-- FAB: visible when idle OR recording (shows pulse) -->
    @if (recorder.state() === 'idle' || recorder.state() === 'recording') {
      <button
        class="rec-fab"
        [class.recording]="recorder.state() === 'recording'"
        (click)="onFabClick()"
        [attr.aria-label]="recorder.state() === 'recording' ? 'Stop registrazione' : 'Avvia registrazione'"
      >
        <app-icon [name]="recorder.state() === 'recording' ? 'micOff' : 'mic'" [size]="22" />
      </button>
    }

    <!-- Expanded panel when recording -->
    @if (recorder.state() === 'recording') {
      <div class="rec-panel" role="region" aria-label="Registrazione in corso">
        <div class="rec-timer-row">
          <span class="rec-dot" aria-hidden="true"></span>
          <span class="rec-timer">{{ recorder.formatDuration(recorder.durationMs()) }}</span>
          <span class="rec-label">In registrazione</span>
        </div>
        @if (isIos) {
          <div class="rec-ios-warn">
            <app-icon name="alertTriangle" [size]="13" />
            Su iOS la registrazione potrebbe interrompersi passando ad altra app.
          </div>
        }
        <div class="rec-actions">
          <button class="btn-ghost" (click)="recorder.discard()">Annulla</button>
          <button class="btn-primary" (click)="recorder.stop()">
            <app-icon name="check" [size]="14" /> Stop
          </button>
        </div>
      </div>
    }

    <!-- Review panel when stopped -->
    @if (recorder.state() === 'stopped') {
      <div class="rec-panel" role="dialog" aria-label="Revisione registrazione">
        <div class="rec-review-title">Registrazione completata</div>
        <div class="rec-review-dur">Durata: {{ recorder.formatDuration(recorder.durationMs()) }}</div>
        @if (recorder.linkedLeadId()) {
          <div class="rec-linked">
            <app-icon name="phone" [size]="12" /> Collegata alla chiamata
          </div>
        }
        @if (recorder.error()) {
          <div class="rec-error">{{ recorder.error() }}</div>
        }
        <div class="rec-actions">
          <button class="btn-ghost" (click)="recorder.discard()">Scarta</button>
          <button class="btn-ghost" (click)="restart()">Riprendi</button>
          <button class="btn-primary" [disabled]="uploading()" (click)="save()">
            @if (uploading()) { Salvataggio… } @else { Salva }
          </button>
        </div>
      </div>
    }
  `,
})
export class VoiceRecorderComponent {
  readonly recorder = inject(VoiceRecorderService);
  private readonly toast = inject(ToastService);

  readonly uploading = signal(false);
  readonly isIos = IS_IOS;

  onFabClick(): void {
    if (this.recorder.state() === 'recording') {
      this.recorder.stop();
    } else {
      this.recorder.start();
    }
  }

  async restart(): Promise<void> {
    const leadId = this.recorder.linkedLeadId() ?? undefined;
    this.recorder.discard();
    await this.recorder.start(leadId);
  }

  async save(): Promise<void> {
    this.uploading.set(true);
    try {
      await this.recorder.upload();
      this.toast.success('Registrazione salvata');
    } catch {
      this.toast.error('Errore nel salvataggio. Riprova.');
    } finally {
      this.uploading.set(false);
    }
  }
}
