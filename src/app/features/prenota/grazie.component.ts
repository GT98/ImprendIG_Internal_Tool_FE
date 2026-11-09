import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PublicBookingApiService, PublicBookingView } from '../../booking/booking-api.service';
import { romeLabel } from '../../booking/rome-time';
import { brandVars } from './brand';

type View = PublicBookingView & { videoUrl: string | null };

const DEFAULT_TITLE = 'Ci siamo! Il tuo percorso inizia adesso';
const DEFAULT_TEXT =
  'Hai appena fatto la cosa più difficile: smettere di andare a tentativi e chiedere un metodo. Prima della call, guarda il video qui sotto.';

// Pagina di ringraziamento dopo la prenotazione (da ads e da organico). Si apre solo col codice di una
// prenotazione vera (/grazie/:token): senza codice o con un codice sbagliato non mostra il video.
@Component({
  selector: 'app-prenota-grazie',
  styleUrls: ['./prenota.component.css', './grazie.component.css'],
  template: `
    <div class="wrap" [style]="brand()">
      <main class="card ty">
        @switch (state()) {
          @case ('loading') {
            <p class="state">Un attimo…</p>
          }
          @case ('error') {
            <div class="state">
              <p class="state-title">Pagina non disponibile</p>
              <p>Questa pagina si apre dopo aver prenotato una call. Controlla l'email di conferma.</p>
            </div>
          }
          @case ('ready') {
            @if (view(); as v) {
              <header class="ty-head">
                @if (v.settings.brand.logoUrl) {
                  <img class="logo" [src]="v.settings.brand.logoUrl" alt="" />
                }
                <p class="ty-badge"><span aria-hidden="true">✓</span> Call prenotata</p>
                <h1 class="ty-title">{{ copy().title }}</h1>
                <p class="ty-text">{{ copy().text }}</p>
              </header>

              @if (video(); as src) {
                <div class="ty-video">
                  <iframe [src]="src" title="Video prima della call" loading="eager"
                          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                          allowfullscreen></iframe>
                </div>
              }

              @if (copy().highlight) {
                <p class="ty-highlight">{{ copy().highlight }}</p>
              }

              <section class="ty-call" aria-label="La tua call">
                <div>
                  <span class="ty-label">La tua call</span>
                  <strong class="ty-when">{{ label(v.startsAt) }}</strong>
                  @if (v.sellerName) {
                    <span class="ty-who">con {{ v.sellerName }} · {{ v.settings.durationMin }} minuti in videochiamata</span>
                  }
                </div>
                <a class="ty-manage" [href]="'/gestisci/' + token">Sposta o annulla</a>
              </section>
              <p class="muted ty-mail">Ti abbiamo mandato un'email con il link della videochiamata e l'invito per il calendario. Se non la trovi, guarda in spam o promozioni.</p>
            }
          }
        }
      </main>
    </div>
  `,
})
export class GrazieComponent {
  private readonly api = inject(PublicBookingApiService);
  private readonly sanitizer = inject(DomSanitizer);
  readonly token = inject(ActivatedRoute).snapshot.paramMap.get('token') ?? '';

  readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  readonly view = signal<View | null>(null);
  readonly label = romeLabel;

  readonly brand = computed(() => brandVars(this.view()?.settings.brand));
  readonly copy = computed(() => {
    const t = this.view()?.settings.brand.thankYou;
    return {
      title: t?.title?.trim() || DEFAULT_TITLE,
      text: t?.text?.trim() || DEFAULT_TEXT,
      highlight: t?.highlight?.trim() || '',
    };
  });
  /** link firmato dal backend (unico host ammesso: il player di Bunny) */
  readonly video = computed<SafeResourceUrl | null>(() => {
    const u = this.view()?.videoUrl;
    return u && u.startsWith('https://iframe.mediadelivery.net/embed/')
      ? this.sanitizer.bypassSecurityTrustResourceUrl(u)
      : null;
  });

  constructor() {
    this.api.thankYou(this.token).subscribe({
      next: v => {
        if (v.status === 'cancelled') {
          this.state.set('error');
          return;
        }
        this.view.set(v);
        this.state.set('ready');
      },
      error: () => this.state.set('error'),
    });
  }
}
