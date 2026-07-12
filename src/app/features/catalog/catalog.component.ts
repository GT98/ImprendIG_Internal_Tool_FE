import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AuthService } from '../../auth/auth.service';
import { CatalogApiService, CatalogPricePlan, CatalogService, ITALIAN_STRIPE_CLIENT_ID } from '../../catalog/catalog-api.service';
import { ToastService } from '../../shared/toast.service';
import { IconComponent } from '../../shared/icon.component';
import { eur as eurFmt } from '../../utils';
import { TitleCasePipe } from '@angular/common';

interface ClientGroup {
  key: string;
  clientName: string;
  client: { id: number; name: string } | null;
  services: CatalogService[];
}

interface EditState {
  id: number;
  name: string;
  basePrice: string;
  installmentCount: string;
  installmentAmount: string;
  totalAmount: string;
  stripePaymentLink: string;
  stripePriceId: string;
  itaStripePriceId: string;
  itaStripePaymentLink: string;
}

interface GenerateModal {
  planId: number;
  planName: string;
  hasStripePrice: boolean;
  hasItaStripePrice: boolean;
}

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

@Component({
  selector: 'app-catalog',
  imports: [IconComponent, TitleCasePipe],
  styleUrl: './catalog.component.css',
  template: `
    <!-- Filter bar -->
    <div class="cat-filter" role="group" aria-label="Filtra per cliente">
      <button
        class="cat-chip"
        [class.active]="selectedClientId() === null"
        (click)="selectedClientId.set(null)"
      >
        Tutti
      </button>
      @for (c of clientsResource.value() ?? []; track c.id) {
        <button
          class="cat-chip"
          [class.active]="selectedClientId() === c.id"
          (click)="selectedClientId.set(c.id)"
        >
          {{ c.name | titlecase }}
        </button>
      }
    </div>

    <!-- Search bar -->
    <div class="cat-search-wrap">
      <input
        type="search"
        class="cat-search-input"
        placeholder="Cerca servizio o variante…"
        [value]="searchQuery()"
        (input)="searchQuery.set($any($event.target).value)"
        aria-label="Cerca servizio o variante"
      />
    </div>

    <!-- Loading / empty states -->
    @if (catalogResource.isLoading()) {
      <div class="cat-empty"><span>Caricamento…</span></div>
    } @else if (filteredGroups().length === 0) {
      <div class="cat-empty">
        <app-icon name="grid" [size]="32" />
        <span>{{ searchQuery() ? 'Nessun risultato per "' + searchQuery() + '"' : 'Nessun servizio trovato' }}</span>
      </div>
    } @else {
      <!-- Grouped by client -->
      @for (group of filteredGroups(); track group.key) {
        <div class="client-group">
          <!-- Client section header -->
          <div class="client-group-header">
            <span class="client-group-name">{{ group.clientName }}</span>
            <span class="client-group-count">{{ group.services.length }} {{ group.services.length === 1 ? 'servizio' : 'servizi' }}</span>
            <span class="client-group-line" aria-hidden="true"></span>
          </div>

          <!-- Services for this client -->
          <div class="client-group-services">
            @for (svc of group.services; track svc.id) {
              <div class="svc-card">
                <!-- Service header -->
                <div class="svc-header">
                  <span class="svc-name">{{ svc.name }}</span>
                  @if (svc.isActive) {
                    <span class="svc-badge active" aria-label="Attivo">Attivo</span>
                  } @else {
                    <span class="svc-badge" aria-label="Non attivo">Non attivo</span>
                  }
                </div>

                <!-- Variants -->
                @if ((svc.variants ?? []).length === 0) {
                  <p class="cat-muted">Nessuna variante</p>
                }
                @for (variant of svc.variants ?? []; track variant.id) {
                  <div class="variant-block">
                    <div class="variant-name">{{ variant.name }}</div>

                    @if ((variant.pricePlans ?? []).length === 0) {
                      <p class="cat-muted cat-muted-sm">Nessun piano</p>
                    }
                    @for (plan of variant.pricePlans ?? []; track plan.id) {
                      <div class="plan-row">
                        <div class="plan-info">
                          <span class="plan-name">{{ plan.name }}</span>
                          <span class="plan-price">
                            @if (plan.installmentCount && plan.installmentAmount) {
                              {{ plan.installmentCount }} rate da {{ eur(plan.installmentAmount) }}
                              @if (plan.totalAmount) { · Tot. {{ eur(plan.totalAmount) }} }
                            } @else if (plan.basePrice) {
                              {{ eur(plan.basePrice) }} una tantum
                            } @else {
                              —
                            }
                          </span>
                        </div>

                        <div class="plan-actions">
                          <!-- Copy link UAE -->
                          <button
                            class="btn-link"
                            [disabled]="!plan.stripePaymentLink"
                            [attr.aria-label]="plan.itaStripePaymentLink ? 'Copia link UAE per ' + plan.name : 'Copia link per ' + plan.name"
                            (click)="copyLink(plan)"
                          >
                            <app-icon name="copy" [size]="15" />
                            {{ plan.itaStripePaymentLink ? 'Copia link UAE' : 'Copia link' }}
                          </button>

                          <!-- Copy link ITA (solo se configurato) -->
                          @if (plan.itaStripePaymentLink) {
                            <button
                              class="btn-link btn-link-ita"
                              [attr.aria-label]="'Copia link ITA per ' + plan.name"
                              (click)="copyLinkIta(plan)"
                            >
                              <app-icon name="copy" [size]="15" />
                              Copia link ITA
                            </button>
                          }

                          <button
                            class="btn-generate"
                            [attr.aria-label]="'Genera link per ' + plan.name"
                            (click)="openGenerateModal(plan)"
                          >
                            <app-icon name="zap" [size]="15" />
                            Genera link
                          </button>

                          @if (isAdmin()) {
                            <button
                              class="btn-edit"
                              [attr.aria-label]="'Modifica ' + plan.name"
                              [attr.aria-expanded]="editState()?.id === plan.id"
                              (click)="toggleEdit(plan)"
                            >
                              <app-icon name="edit" [size]="15" />
                              Modifica
                            </button>
                          }
                        </div>
                      </div>

                      @if (isAdmin() && editState()?.id === plan.id) {
                        <div class="edit-panel" role="form" [attr.aria-label]="'Modifica ' + plan.name">
                          <div class="edit-grid">
                            <label class="edit-field">
                              <span>Nome</span>
                              <input
                                type="text"
                                [value]="editState()!.name"
                                (input)="patchEdit('name', $any($event.target).value)"
                                placeholder="Nome piano"
                              />
                            </label>
                            <label class="edit-field">
                              <span>Prezzo base (€)</span>
                              <input
                                type="number" min="0"
                                [value]="editState()!.basePrice"
                                (input)="patchEdit('basePrice', $any($event.target).value)"
                                placeholder="0"
                              />
                            </label>
                            <label class="edit-field">
                              <span>N. rate</span>
                              <input
                                type="number" min="0"
                                [value]="editState()!.installmentCount"
                                (input)="patchEdit('installmentCount', $any($event.target).value)"
                                placeholder="0"
                              />
                            </label>
                            <label class="edit-field">
                              <span>Importo rata (€)</span>
                              <input
                                type="number" min="0"
                                [value]="editState()!.installmentAmount"
                                (input)="patchEdit('installmentAmount', $any($event.target).value)"
                                placeholder="0"
                              />
                            </label>
                            <label class="edit-field">
                              <span>Totale (€)</span>
                              <input
                                type="number" min="0"
                                [value]="editState()!.totalAmount"
                                (input)="patchEdit('totalAmount', $any($event.target).value)"
                                placeholder="0"
                              />
                            </label>
                            <label class="edit-field edit-field-wide">
                              <span>Stripe Payment Link (UAE)</span>
                              <input
                                type="url"
                                [value]="editState()!.stripePaymentLink"
                                (input)="patchEdit('stripePaymentLink', $any($event.target).value)"
                                placeholder="https://buy.stripe.com/…"
                              />
                            </label>
                            <label class="edit-field edit-field-wide">
                              <span>Stripe Price ID (UAE)</span>
                              <input
                                type="text"
                                [value]="editState()!.stripePriceId"
                                (input)="patchEdit('stripePriceId', $any($event.target).value)"
                                placeholder="price_…"
                              />
                            </label>
                            <label class="edit-field edit-field-wide">
                              <span>Stripe Payment Link (ITA)</span>
                              <input
                                type="url"
                                [value]="editState()!.itaStripePaymentLink"
                                (input)="patchEdit('itaStripePaymentLink', $any($event.target).value)"
                                placeholder="https://buy.stripe.com/…"
                              />
                            </label>
                            <label class="edit-field edit-field-wide">
                              <span>Stripe Price ID (ITA)</span>
                              <input
                                type="text"
                                [value]="editState()!.itaStripePriceId"
                                (input)="patchEdit('itaStripePriceId', $any($event.target).value)"
                                placeholder="price_…"
                              />
                            </label>
                          </div>
                          <div class="edit-footer">
                            <button class="btn-save" [disabled]="saving()" (click)="savePlan()">
                              {{ saving() ? 'Salvataggio…' : 'Salva' }}
                            </button>
                            <button class="btn-cancel" (click)="editState.set(null)">Annulla</button>
                          </div>
                        </div>
                      }
                    }
                  </div>
                }
              </div>
            }
          </div>
        </div>
      }
    }

    <!-- ── Generate link modal ──────────────────────────────────── -->
    @if (generateModal()) {
      <div
        class="modal-overlay"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'Genera link per ' + generateModal()!.planName"
        (click)="closeGenerateModal()"
        (keydown.escape)="closeGenerateModal()"
      >
        <div class="modal" (click)="$event.stopPropagation()">

          <!-- Modal header -->
          <div class="modal-head">
            <div class="modal-title-wrap">
              <div class="modal-icon"><app-icon name="zap" [size]="18" /></div>
              <div>
                <h2 class="modal-title">Genera link checkout</h2>
                <p class="modal-sub">{{ generateModal()!.planName }}</p>
              </div>
            </div>
            <button class="icon-btn" aria-label="Chiudi" (click)="closeGenerateModal()">
              <app-icon name="x" [size]="20" />
            </button>
          </div>

          @if (!generateModal()!.hasStripePrice && !generateModal()!.hasItaStripePrice) {
            <!-- No stripePriceId configured at all -->
            <div class="modal-warning">
              <app-icon name="alertTriangle" [size]="18" />
              <span>Questo piano non ha nessuno <strong>Stripe Price ID</strong> configurato. Aggiungilo prima di generare il link.</span>
            </div>
          } @else if (generatedUrl()) {
            <!-- Generated URL result -->
            <div class="modal-result">
              <p class="modal-result-label">Link generato con successo</p>
              <div class="modal-url-box">
                <span class="modal-url-text">{{ generatedUrl() }}</span>
              </div>
              <div class="modal-result-actions">
                <button class="btn-save" (click)="copyGeneratedUrl()">
                  <app-icon name="copy" [size]="15" />
                  {{ urlCopied() ? 'Copiato!' : 'Copia link' }}
                </button>
                <button class="btn-cancel" (click)="resetGenerate()">Genera un altro</button>
              </div>
            </div>
          } @else {
            <!-- Form -->
            <div class="modal-body">

              <!-- Account toggle (solo se esiste ita price ID) -->
              @if (generateModal()!.hasItaStripePrice) {
                <div class="modal-field">
                  <span class="modal-label">Account Stripe</span>
                  <div class="modal-toggle-group" role="group" aria-label="Seleziona account Stripe">
                    <button
                      class="toggle-btn"
                      [class.active]="stripeAccount() === 'uae'"
                      (click)="setStripeAccount('uae')"
                    >
                      🇦🇪 UAE
                    </button>
                    <button
                      class="toggle-btn"
                      [class.active]="stripeAccount() === 'ita'"
                      (click)="setStripeAccount('ita')"
                    >
                      🇮🇹 Italia (CF)
                    </button>
                  </div>
                </div>
              }

              <!-- Toggle prova gratuita -->
              <div class="modal-field modal-field-row">
                <label class="modal-label" for="toggle-trial">Con prova gratuita</label>
                <input
                  id="toggle-trial"
                  type="checkbox"
                  class="modal-checkbox"
                  [checked]="withTrial()"
                  (change)="withTrial.set($any($event.target).checked)"
                  aria-label="Abilita prova gratuita"
                />
              </div>

              <!-- Date picker (visibile solo se prova abilitata) -->
              @if (withTrial()) {
                <label class="modal-field">
                  <span class="modal-label">Data fine prova</span>
                  <input
                    type="date"
                    class="modal-date-input"
                    [min]="minDate"
                    [value]="trialDate()"
                    (input)="trialDate.set($any($event.target).value)"
                    aria-label="Data fine prova gratuita"
                  />
                </label>
              }

              <!-- Toggle Codice Fiscale -->
              <div class="modal-field modal-field-row">
                <label class="modal-label" for="toggle-cf">Richiedi Codice Fiscale</label>
                <input
                  id="toggle-cf"
                  type="checkbox"
                  class="modal-checkbox"
                  [checked]="withCf()"
                  (change)="withCf.set($any($event.target).checked)"
                  aria-label="Richiedi Codice Fiscale al checkout"
                />
              </div>

              @if (isAdmin()) {
                <label class="modal-field">
                  <span class="modal-label">ID Venditore</span>
                  <input
                    type="number"
                    class="modal-date-input"
                    min="1"
                    placeholder="es. 3"
                    [value]="sellerIdOverride()"
                    (input)="sellerIdOverride.set($any($event.target).value)"
                    aria-label="ID Venditore"
                  />
                </label>
              }
            </div>

            <div class="modal-footer">
              <button
                class="btn-save"
                [disabled]="generating() || (withTrial() && !trialDate()) || !resolvedSellerId() || !canGenerate()"
                (click)="generateLink()"
              >
                @if (generating()) {
                  Generazione…
                } @else {
                  <app-icon name="zap" [size]="15" />
                  Genera link {{ stripeAccount() === 'ita' ? '(ITA)' : '' }}
                }
              </button>
              <button class="btn-cancel" (click)="closeGenerateModal()">Annulla</button>
              @if (isAdmin() && !resolvedSellerId()) {
                <span class="modal-hint">Inserisci l'ID venditore per procedere</span>
              }
              @if (!canGenerate()) {
                <span class="modal-hint">Price ID {{ stripeAccount() === 'ita' ? 'ITA' : 'UAE' }} non configurato per questo piano</span>
              }
            </div>
          }

        </div>
      </div>
    }
  `,
})
export class CatalogComponent {
  private readonly auth = inject(AuthService);
  private readonly catalogApi = inject(CatalogApiService);
  private readonly toast = inject(ToastService);

  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');
  readonly sellerId = computed(() => this.auth.currentUser()?.sellerId);

  // ── Catalog state ────────────────────────────────────────────
  readonly selectedClientId = signal<number | null>(null);
  readonly searchQuery = signal('');

  readonly clientsResource = rxResource({
    stream: () => this.catalogApi.getClients(),
  });

  readonly catalogResource = rxResource({
    params: () => this.selectedClientId(),
    stream: ({ params: clientId }) =>
      this.catalogApi.getCatalog(clientId ?? undefined),
  });

  readonly eur = (v: number | null) => v != null ? eurFmt(v) : '—';

  readonly groupedServices = computed<ClientGroup[]>(() => {
    const services = this.catalogResource.value() ?? [];
    const map = new Map<string, ClientGroup>();
    for (const svc of services) {
      const key = svc.client ? String(svc.client.id) : '__none__';
      if (!map.has(key)) {
        map.set(key, { key, clientName: svc.client?.name ?? 'Senza cliente', client: svc.client ?? null, services: [] });
      }
      map.get(key)!.services.push(svc);
    }
    return [...map.values()].sort((a, b) => {
      if (!a.client) return 1;
      if (!b.client) return -1;
      return a.clientName.localeCompare(b.clientName);
    });
  });

  readonly filteredGroups = computed<ClientGroup[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const groups = this.groupedServices();
    if (!q) return groups;

    return groups
      .map(group => {
        const matchingServices = group.services
          .map(svc => {
            if (svc.name?.toLowerCase().includes(q)) return svc;
            const matchingVariants = (svc.variants ?? []).filter(v =>
              v.name?.toLowerCase().includes(q),
            );
            return matchingVariants.length > 0 ? { ...svc, variants: matchingVariants } : null;
          })
          .filter((s): s is CatalogService => s !== null);
        return matchingServices.length > 0 ? { ...group, services: matchingServices } : null;
      })
      .filter((g): g is ClientGroup => g !== null);
  });

  // ── Edit state (admin) ───────────────────────────────────────
  readonly editState = signal<EditState | null>(null);
  readonly saving = signal(false);

  // ── Generate modal state ─────────────────────────────────────
  readonly generateModal = signal<GenerateModal | null>(null);
  readonly stripeAccount = signal<'uae' | 'ita'>('uae');
  readonly withTrial = signal(true);
  readonly withCf = signal(false);
  readonly trialDate = signal('');
  readonly sellerIdOverride = signal('');
  readonly generating = signal(false);
  readonly generatedUrl = signal<string | null>(null);
  readonly urlCopied = signal(false);

  readonly minDate = tomorrow();

  readonly resolvedSellerId = computed<number | null>(() => {
    if (this.isAdmin()) {
      const v = Number(this.sellerIdOverride());
      return v > 0 ? v : null;
    }
    const sid = this.sellerId();
    if (sid == null) return null;
    const n = Number(sid);
    return n > 0 ? n : null;
  });

  /** Vero se il price ID dell'account selezionato è configurato */
  readonly canGenerate = computed(() => {
    const modal = this.generateModal();
    if (!modal) return false;
    return this.stripeAccount() === 'ita' ? modal.hasItaStripePrice : modal.hasStripePrice;
  });

  // ── Copy standard link ───────────────────────────────────────
  copyLink(plan: CatalogPricePlan): void {
    if (!plan.stripePaymentLink) return;
    const sid = this.sellerId();
    const url = sid != null
      ? `${plan.stripePaymentLink}?client_reference_id=${sid}`
      : plan.stripePaymentLink;
    navigator.clipboard.writeText(url).then(() => {
      this.toast.success('Link UAE copiato!');
    });
  }

  copyLinkIta(plan: CatalogPricePlan): void {
    if (!plan.itaStripePaymentLink) return;
    const sid = this.sellerId();
    const url = sid != null
      ? `${plan.itaStripePaymentLink}?client_reference_id=${sid}`
      : plan.itaStripePaymentLink;
    navigator.clipboard.writeText(url).then(() => {
      this.toast.success('Link ITA copiato!');
    });
  }

  // ── Generate modal ───────────────────────────────────────────
  openGenerateModal(plan: CatalogPricePlan): void {
    this.generateModal.set({
      planId: plan.id,
      planName: plan.name ?? '',
      hasStripePrice: !!plan.stripePriceId,
      hasItaStripePrice: !!plan.itaStripePriceId,
    });
    this.stripeAccount.set('uae');
    this.withTrial.set(true);
    this.withCf.set(false);
    this.trialDate.set('');
    this.sellerIdOverride.set('');
    this.generatedUrl.set(null);
    this.urlCopied.set(false);
  }

  setStripeAccount(account: 'uae' | 'ita'): void {
    this.stripeAccount.set(account);
    if (account === 'ita') this.withCf.set(true);
  }

  closeGenerateModal(): void {
    this.generateModal.set(null);
  }

  resetGenerate(): void {
    this.trialDate.set('');
    this.generatedUrl.set(null);
    this.urlCopied.set(false);
  }

  generateLink(): void {
    const modal = this.generateModal();
    const sellerId = this.resolvedSellerId();
    if (!modal || !sellerId || !this.canGenerate()) return;
    if (this.withTrial() && !this.trialDate()) return;

    const isIta = this.stripeAccount() === 'ita';

    this.generating.set(true);
    this.catalogApi.createCheckoutSession({
      pricePlanId: Number(modal.planId),
      sellerId: Number(sellerId),
      ...(this.withTrial() ? { trialEndDate: this.trialDate() } : {}),
      ...(isIta ? { stripeClientId: ITALIAN_STRIPE_CLIENT_ID } : {}),
      ...(this.withCf() ? { withCf: true } : {}),
    }).subscribe({
      next: ({ url }) => {
        this.generating.set(false);
        this.generatedUrl.set(url);
      },
      error: (err: { error?: { message?: string } }) => {
        this.generating.set(false);
        this.toast.error(err?.error?.message ?? 'Errore nella generazione del link');
      },
    });
  }

  copyGeneratedUrl(): void {
    const url = this.generatedUrl();
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      this.urlCopied.set(true);
      setTimeout(() => this.urlCopied.set(false), 2000);
    });
  }

  // ── Edit plan (admin) ────────────────────────────────────────
  toggleEdit(plan: CatalogPricePlan): void {
    if (this.editState()?.id === plan.id) {
      this.editState.set(null);
      return;
    }
    this.editState.set({
      id: plan.id,
      name: plan.name ?? '',
      basePrice: plan.basePrice != null ? String(plan.basePrice) : '',
      installmentCount: plan.installmentCount != null ? String(plan.installmentCount) : '',
      installmentAmount: plan.installmentAmount != null ? String(plan.installmentAmount) : '',
      totalAmount: plan.totalAmount != null ? String(plan.totalAmount) : '',
      stripePaymentLink: plan.stripePaymentLink ?? '',
      stripePriceId: plan.stripePriceId ?? '',
      itaStripePriceId: plan.itaStripePriceId ?? '',
      itaStripePaymentLink: plan.itaStripePaymentLink ?? '',
    });
  }

  patchEdit(field: keyof Omit<EditState, 'id'>, value: string): void {
    const s = this.editState();
    if (!s) return;
    this.editState.set({ ...s, [field]: value });
  }

  savePlan(): void {
    const s = this.editState();
    if (!s) return;
    this.saving.set(true);

    const dto = {
      name: s.name || undefined,
      basePrice: s.basePrice !== '' ? Number(s.basePrice) : undefined,
      installmentCount: s.installmentCount !== '' ? Number(s.installmentCount) : undefined,
      installmentAmount: s.installmentAmount !== '' ? Number(s.installmentAmount) : undefined,
      totalAmount: s.totalAmount !== '' ? Number(s.totalAmount) : undefined,
      stripePaymentLink: s.stripePaymentLink || undefined,
      stripePriceId: s.stripePriceId || undefined,
      itaStripePriceId: s.itaStripePriceId || undefined,
      itaStripePaymentLink: s.itaStripePaymentLink || undefined,
    };

    this.catalogApi.updatePricePlan(s.id, dto).subscribe({
      next: () => {
        this.saving.set(false);
        this.editState.set(null);
        this.catalogResource.reload();
        this.toast.success('Piano aggiornato');
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Errore nel salvataggio');
      },
    });
  }
}
