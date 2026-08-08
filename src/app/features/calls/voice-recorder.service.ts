import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CallRecording } from '../../models';
import { CallRecordingApiService } from './call-recording-api.service';

const PREFERRED_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'];

@Injectable({ providedIn: 'root' })
export class VoiceRecorderService {
  private readonly api = inject(CallRecordingApiService);

  readonly state = signal<'idle' | 'recording' | 'stopped'>('idle');
  readonly durationMs = signal(0);
  readonly blob = signal<Blob | null>(null);
  readonly linkedLeadId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly lastSavedAt = signal(0); // bumped after each successful upload — drawers can watch this

  private mediaRecorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private timerHandle: ReturnType<typeof setInterval> | null = null;
  private startedAt = 0;
  private mimeType = '';
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private visibilityHandler: (() => void) | null = null;

  async start(leadId?: string): Promise<void> {
    this.linkedLeadId.set(leadId ?? null);
    this.error.set(null);
    this.chunks = [];
    this.blob.set(null);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      this.error.set('Permesso microfono negato. Controlla le impostazioni del browser.');
      return;
    }

    this.mimeType = PREFERRED_MIME_TYPES.find(t => MediaRecorder.isTypeSupported(t)) ?? '';

    try {
      this.mediaRecorder = new MediaRecorder(
        this.stream,
        this.mimeType ? { mimeType: this.mimeType } : {},
      );
    } catch {
      this.error.set('Registrazione audio non supportata su questo browser.');
      this.releaseStream();
      return;
    }

    this.mediaRecorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      const b = new Blob(this.chunks, { type: this.mimeType || 'audio/webm' });
      this.blob.set(b);
      this.stopTimer();
      this.releaseStream();
      this.detachVisibilityListener();
      this.stopSilentAudioContext();
      this.state.set('stopped');
    };

    this.mediaRecorder.start(1000);
    this.startedAt = Date.now();
    this.durationMs.set(0);
    this.state.set('recording');
    this.startTimer();
    this.attachVisibilityListener();
    this.startSilentAudioContext();
  }

  stop(): void {
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }

  discard(): void {
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.stop();
    }
    this.releaseStream();
    this.stopTimer();
    this.detachVisibilityListener();
    this.stopSilentAudioContext();
    this.state.set('idle');
    this.blob.set(null);
    this.durationMs.set(0);
    this.error.set(null);
    this.linkedLeadId.set(null);
    this.chunks = [];
  }

  async upload(): Promise<CallRecording> {
    const b = this.blob();
    if (!b) throw new Error('Nessuna registrazione disponibile');

    const durationSeconds = Math.round(this.durationMs() / 1000);
    const rec = await firstValueFrom(
      this.api.upload(b, this.mimeType, this.linkedLeadId(), durationSeconds),
    );

    this.lastSavedAt.set(Date.now());
    this.discard();
    return rec;
  }

  formatDuration(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m.toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  }

  private startTimer(): void {
    this.timerHandle = setInterval(() => this.durationMs.set(Date.now() - this.startedAt), 500);
  }

  private stopTimer(): void {
    if (this.timerHandle) { clearInterval(this.timerHandle); this.timerHandle = null; }
  }

  private releaseStream(): void {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
  }

  private attachVisibilityListener(): void {
    this.visibilityHandler = () => {
      if (!document.hidden && this.state() === 'recording' && this.mediaRecorder?.state !== 'recording') {
        this.error.set('La registrazione si è interrotta in background. Riprova.');
        this.stopTimer();
        this.state.set('stopped');
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private detachVisibilityListener(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  // Keeps a silent AudioContext alive to help iOS continue in background
  private startSilentAudioContext(): void {
    try {
      this.audioCtx = new AudioContext();
      const gain = this.audioCtx.createGain();
      gain.gain.value = 0;
      const osc = this.audioCtx.createOscillator();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
    } catch { /* not critical */ }
  }

  private stopSilentAudioContext(): void {
    try { this.audioCtx?.close(); } catch { /* ignore */ }
    this.audioCtx = null;
  }
}
