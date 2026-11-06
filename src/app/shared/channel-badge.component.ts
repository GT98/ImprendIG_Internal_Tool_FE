import { Component, computed, input } from '@angular/core';
import type { CallChannel } from '../models';

const LABELS: Record<CallChannel, string> = {
  ads: 'ADS',
  organic: 'Organico',
  direct: 'Link diretto',
};

/**
 * Canale da cui arriva una chiamata. Di default mostra solo "ADS" (le altre sono la norma);
 * con `all` mostra anche organico / link diretto.
 */
@Component({
  selector: 'app-channel-badge',
  template: `
    @if (label(); as l) {
      <span class="channel-badge" [class.ads]="channel() === 'ads'" [attr.title]="title()">{{ l }}</span>
    }
  `,
  styles: `
    :host { display: inline; }
    .channel-badge {
      display: inline-block;
      vertical-align: middle;
      margin-left: 4px;
      padding: 1px 7px;
      border-radius: 20px;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: .04em;
      line-height: 16px;
      color: var(--ink-2);
      background: var(--surface-2);
      border: 1px solid var(--border);
    }
    .channel-badge.ads {
      color: #9a3412;
      background: color-mix(in srgb, #f97316 14%, transparent);
      border-color: color-mix(in srgb, #f97316 35%, transparent);
    }
    :host-context([data-theme='dark']) .channel-badge.ads { color: #fdba74; }
  `,
})
export class ChannelBadgeComponent {
  readonly channel = input<CallChannel | null | undefined>(null);
  readonly all = input(false);

  readonly label = computed(() => {
    const c = this.channel();
    if (!c) return null;
    if (c !== 'ads' && !this.all()) return null;
    return LABELS[c];
  });

  readonly title = computed(() =>
    this.channel() === 'ads'
      ? 'Arriva dalle ADS (link ADS della setter o form Meta)'
      : null,
  );
}
