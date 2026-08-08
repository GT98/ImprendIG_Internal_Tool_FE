import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  input,
  signal,
  ViewChild,
} from '@angular/core';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-audio-player',
  imports: [IconComponent],
  styles: [`
    .player { display:flex; align-items:center; gap:10px; background:var(--bg); border-radius:var(--radius-sm); padding:8px 12px; }
    .play-btn { width:34px; height:34px; border-radius:50%; background:var(--accent); color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .play-btn:disabled { opacity:.5; cursor:not-allowed; }
    .player-seek { flex:1; height:3px; -webkit-appearance:none; appearance:none; border-radius:2px; background:var(--border); outline:none; cursor:pointer; }
    .player-seek::-webkit-slider-thumb { -webkit-appearance:none; width:12px; height:12px; border-radius:50%; background:var(--accent); }
    .player-time { font-size:11px; color:var(--ink-3); white-space:nowrap; font-variant-numeric:tabular-nums; }
  `],
  template: `
    <div class="player">
      <button
        class="play-btn"
        (click)="togglePlay()"
        [disabled]="!src()"
        [attr.aria-label]="playing() ? 'Pausa' : 'Riproduci'"
      >
        <app-icon [name]="playing() ? 'pause' : 'play'" [size]="14" />
      </button>
      <input
        #seekBar
        type="range"
        class="player-seek"
        [value]="currentTime()"
        [max]="totalDuration()"
        step="0.1"
        aria-label="Posizione"
        (input)="seek($event)"
      />
      <span class="player-time">{{ fmt(currentTime()) }} / {{ fmt(totalDuration()) }}</span>
    </div>
    <audio #audioEl [src]="src()" (timeupdate)="onTimeUpdate()" (ended)="onEnded()" (loadedmetadata)="onMeta()"></audio>
  `,
})
export class AudioPlayerComponent implements AfterViewInit, OnDestroy {
  readonly src = input.required<string>();
  readonly durationSeconds = input<number | null>(null);

  @ViewChild('audioEl') private audioRef!: ElementRef<HTMLAudioElement>;

  readonly playing = signal(false);
  readonly currentTime = signal(0);
  readonly totalDuration = signal(0);

  ngAfterViewInit(): void {
    if (this.durationSeconds()) {
      this.totalDuration.set(this.durationSeconds()!);
    }
  }

  ngOnDestroy(): void {
    const el = this.audioRef?.nativeElement;
    if (el) { el.pause(); el.src = ''; }
  }

  togglePlay(): void {
    const el = this.audioRef.nativeElement;
    if (this.playing()) {
      el.pause();
      this.playing.set(false);
    } else {
      el.play().then(() => this.playing.set(true)).catch(() => {});
    }
  }

  seek(e: Event): void {
    const val = Number((e.target as HTMLInputElement).value);
    this.audioRef.nativeElement.currentTime = val;
    this.currentTime.set(val);
  }

  onTimeUpdate(): void {
    this.currentTime.set(this.audioRef.nativeElement.currentTime);
  }

  onMeta(): void {
    const dur = this.audioRef.nativeElement.duration;
    if (isFinite(dur)) this.totalDuration.set(dur);
  }

  onEnded(): void {
    this.playing.set(false);
    this.currentTime.set(0);
    this.audioRef.nativeElement.currentTime = 0;
  }

  fmt(s: number): string {
    const sec = Math.floor(s);
    const m = Math.floor(sec / 60);
    return `${m.toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;
  }
}
