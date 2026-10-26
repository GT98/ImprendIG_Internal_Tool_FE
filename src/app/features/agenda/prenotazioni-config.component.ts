import { Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  BookingApiService,
  BookingChannel,
  BookingLinkDto,
  BookingQuestion,
  BookingSettingsDto,
} from '../../booking/booking-api.service';
import { SellerApiService } from '../../seller/seller-api.service';
import { SetterApiService } from '../../setter/setter-api.service';
import { ToastService } from '../../shared/toast.service';
import { IconComponent } from '../../shared/icon.component';

const CHANNELS: { value: BookingChannel; label: string }[] = [
  { value: 'organic', label: 'Organico (DM setter)' },
  { value: 'ads', label: 'Ads' },
  { value: 'direct', label: 'Diretto' },
];

interface LinkForm {
  slug: string;
  label: string;
  setterId: number | null;
  clientId: number | null;
  channel: BookingChannel;
}

const emptyLink = (): LinkForm => ({ slug: '', label: '', setterId: null, clientId: null, channel: 'organic' });

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

// Admin: pagine di prenotazione delle academy e link tracciati delle setter
@Component({
  selector: 'app-prenotazioni-config',
  imports: [IconComponent],
  styleUrl: './prenotazioni-config.component.css',
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Prenotazioni <span class="muted-pill">admin</span></h1>
          <p class="page-sub">Pagine di prenotazione delle academy e link tracciati per setter e campagne</p>
        </div>
      </div>

      <h2 class="section-title">Pagine delle academy</h2>
      @if (drafts().length) {
        <div class="tabs" role="tablist" aria-label="Academy">
          @for (d of drafts(); track d.id; let i = $index) {
            <button type="button" role="tab" [id]="'academy-tab-' + d.id" [attr.aria-selected]="tab() === i" [attr.aria-controls]="'academy-panel'" [class.on]="tab() === i" (click)="tab.set(i)">
              <span class="dot" [class.live]="d.active" aria-hidden="true"></span>
              {{ d.title.split(' – ')[0] || d.client.name }}
              @if (issue(d.id); as w) {
                <span class="warn-dot" [attr.aria-label]="w.level === 'alert' ? 'percorso scoperto' : 'da controllare'" [class.alert]="w.level === 'alert'">!</span>
              }
              <span class="sr-only">{{ d.active ? '(attiva)' : '(spenta)' }}</span>
            </button>
          }
        </div>
      }
      <div class="academies" id="academy-panel" role="tabpanel">
        @if (drafts()[tab()]; as s) {
          @let si = tab();
          @if (coverageOf(s.id); as c) {
            <div class="coverage" [class.alert]="c.freeSlots7d === 0 && s.active" [class.ok]="c.freeSlots7d > 0 && !c.withoutHours.length" role="status">
              <strong>{{ c.sellers }} venditric{{ c.sellers === 1 ? 'e' : 'i' }} a rotazione · {{ c.freeSlots7d }} orari prenotabili nei prossimi 7 giorni</strong>
              @if (c.freeSlots7d === 0) {
                <span>Percorso scoperto: chi apre la pagina non vede nessun orario.</span>
              }
              @if (c.withoutHours.length) {
                <span>Senza orari settimanali: {{ c.withoutHours.join(', ') }}. Finché non li inseriscono in Disponibilità non ricevono call di questo percorso.</span>
              }
            </div>
          }
          <section class="card">
            <div class="card-head">
              <div>
                <h3>{{ s.client.name }}</h3>
                <a class="url" [href]="pageUrl(s.slug)" target="_blank" rel="noopener">{{ pageUrl(s.slug) }}</a>
              </div>
              <label class="switch">
                <input type="checkbox" [checked]="s.active" (change)="patch(si, { active: $any($event.target).checked })" />
                <span>{{ s.active ? 'Attiva' : 'Spenta' }}</span>
              </label>
            </div>

            <label class="field"><span>Titolo</span><input type="text" [value]="s.title" (input)="patch(si, { title: val($event) })" /></label>
            <div class="grid4">
              <label class="field"><span>Durata (min)</span><input type="number" min="10" [value]="s.durationMin" (input)="patch(si, { durationMin: +val($event) })" /></label>
              <label class="field"><span>Pausa dopo (min)</span><input type="number" min="0" [value]="s.bufferMin" (input)="patch(si, { bufferMin: +val($event) })" /></label>
              <label class="field"><span>Ogni (min)</span><input type="number" min="5" [value]="s.slotStepMin" (input)="patch(si, { slotStepMin: +val($event) })" /></label>
              <label class="field"><span>Preavviso (ore)</span><input type="number" min="0" [value]="s.minNoticeHours" (input)="patch(si, { minNoticeHours: +val($event) })" /></label>
              <label class="field"><span>Prenotabile fino a (giorni)</span><input type="number" min="1" [value]="s.horizonDays" (input)="patch(si, { horizonDays: +val($event) })" /></label>
              <label class="field"><span>Modificabile fino a (ore prima)</span><input type="number" min="0" [value]="s.changeLimitHours" (input)="patch(si, { changeLimitHours: +val($event) })" /></label>
              <label class="field"><span>Colore</span><input type="color" [value]="s.brand.color ?? '#4f46e5'" (input)="patchBrand(si, 'color', val($event))" /></label>
              <label class="field span2"><span>Logo (URL immagine)</span><input type="url" [value]="s.brand.logoUrl ?? ''" (input)="patchBrand(si, 'logoUrl', val($event))" /></label>
            </div>
            <label class="field"><span>Sottotitolo</span><input type="text" [value]="s.brand.subtitle ?? ''" (input)="patchBrand(si, 'subtitle', val($event))" /></label>

            <fieldset class="sellers">
              <legend>Venditrici a rotazione</legend>
              @for (v of sellers(); track v.id) {
                <label class="chip" [class.on]="s.sellerIds.includes(+v.id)">
                  <input type="checkbox" [checked]="s.sellerIds.includes(+v.id)" (change)="toggleSeller(si, +v.id)" />
                  {{ v.name }} {{ v.lastName ?? '' }}
                </label>
              }
            </fieldset>

            <fieldset class="questions">
              <legend>Domande del form (oltre a nome, email e telefono)</legend>
              @for (q of s.questions; track $index; let qi = $index; let first = $first; let last = $last) {
                <div class="q-card">
                  <div class="q-row">
                    <textarea rows="2" placeholder="Domanda" [value]="q.label" (input)="patchQuestion(si, qi, { label: val($event) })" aria-label="Testo della domanda"></textarea>
                    <select (change)="patchQuestion(si, qi, { type: $any(val($event)) })" aria-label="Tipo di risposta">
                      <option value="text" [selected]="q.type === 'text'">Testo breve</option>
                      <option value="textarea" [selected]="q.type === 'textarea'">Testo lungo</option>
                      <option value="radio" [selected]="q.type === 'radio'">Scelta (bottoni)</option>
                      <option value="select" [selected]="q.type === 'select'">Scelta (menu)</option>
                      <option value="confirm" [selected]="q.type === 'confirm'">Spunta di conferma</option>
                    </select>
                    <button type="button" class="icon-btn sm" [disabled]="first" (click)="moveQuestion(si, qi, -1)" aria-label="Sposta su"><app-icon name="arrowUp" [size]="13" /></button>
                    <button type="button" class="icon-btn sm" [disabled]="last" (click)="moveQuestion(si, qi, 1)" aria-label="Sposta giù"><app-icon name="arrowDown" [size]="13" /></button>
                    <button type="button" class="icon-btn sm" (click)="removeQuestion(si, qi)" aria-label="Rimuovi domanda"><app-icon name="trash" [size]="14" /></button>
                  </div>
                  @if (q.type === 'select' || q.type === 'radio') {
                    <input type="text" placeholder="Risposte separate da ;" [value]="(q.options ?? []).join('; ')" (change)="patchQuestion(si, qi, { options: splitOptions(val($event)) })" aria-label="Risposte possibili" />
                    <input type="text" placeholder="Risposte che fermano la prenotazione (separate da ;)" [value]="(q.blockingOptions ?? []).join('; ')" (change)="patchQuestion(si, qi, { blockingOptions: splitOptions(val($event)) })" aria-label="Risposte che fermano la prenotazione" />
                    @if (q.blockingOptions?.length) {
                      <input type="text" placeholder="Messaggio mostrato quando la prenotazione viene fermata" [value]="q.blockingMessage ?? ''" (input)="patchQuestion(si, qi, { blockingMessage: val($event) || undefined })" aria-label="Messaggio di blocco" />
                    }
                  }
                  <div class="q-flags">
                    <label class="req"><input type="checkbox" [checked]="q.required" (change)="patchQuestion(si, qi, { required: $any($event.target).checked })" /> Obbligatoria</label>
                    <label class="req"><input type="checkbox" [checked]="q.hideWhenRef" (change)="patchQuestion(si, qi, { hideWhenRef: $any($event.target).checked })" /> Nascondi a chi arriva dal link di una setter</label>
                  </div>
                </div>
              }
              <button type="button" class="btn-ghost sm" (click)="addQuestion(si)"><app-icon name="plus" [size]="14" /> Domanda</button>
            </fieldset>

            <div class="card-foot">
              @if (s.active && !s.sellerIds.length) {
                <span class="warn">Pagina attiva ma senza venditrici: non mostrerà orari.</span>
              }
              <button type="button" class="btn-primary" [disabled]="savingId() === s.id" (click)="saveSettings(s)">
                {{ savingId() === s.id ? 'Salvataggio…' : 'Salva' }}
              </button>
            </div>
          </section>
        } @else {
          <p class="muted">Nessuna pagina configurata: lancia lo script SQL delle prenotazioni.</p>
        }
      </div>

      <h2 class="section-title">Link tracciati</h2>
      <p class="muted small">Ogni setter manda il proprio link: la prenotazione arriva già con setter e canale. Il link resta valido per 30 giorni anche se la persona torna più tardi.</p>

      <form class="card link-form" (submit)="$event.preventDefault(); createLink()">
        <label class="field"><span>Setter</span>
          <select (change)="onSetter(+val($event) || null)">
            <option value="">— Nessuna —</option>
            @for (st of setters(); track st.id) {
              <option [value]="st.id" [selected]="linkForm().setterId === +st.id">{{ st.name }} {{ st.lastName ?? '' }}</option>
            }
          </select>
        </label>
        <label class="field"><span>Academy</span>
          <select (change)="patchLink({ clientId: +val($event) || null })">
            <option value="">Tutte</option>
            @for (s of drafts(); track s.id) {
              <option [value]="s.client.id" [selected]="linkForm().clientId === +s.client.id">{{ s.client.name }}</option>
            }
          </select>
        </label>
        <label class="field"><span>Canale</span>
          <select (change)="patchLink({ channel: $any(val($event)) })">
            @for (c of channels; track c.value) {
              <option [value]="c.value" [selected]="linkForm().channel === c.value">{{ c.label }}</option>
            }
          </select>
        </label>
        <label class="field"><span>Codice nel link</span><input type="text" placeholder="es. georgia" [value]="linkForm().slug" (input)="patchLink({ slug: slugify(val($event)) })" /></label>
        <label class="field grow"><span>Etichetta</span><input type="text" placeholder="es. Georgia – DM Instagram" [value]="linkForm().label" (input)="patchLink({ label: val($event) })" /></label>
        <button type="submit" class="btn-primary" [disabled]="creatingLink() || !linkForm().slug">Crea link</button>
      </form>

      <div class="table-wrap">
        <table class="links">
          <thead>
            <tr><th scope="col">Link</th><th scope="col">Setter</th><th scope="col">Academy</th><th scope="col">Canale</th><th scope="col" class="num">Prenotazioni</th><th scope="col"><span class="sr-only">Azioni</span></th></tr>
          </thead>
          <tbody>
            @for (l of links(); track l.id) {
              <tr [class.inactive]="!l.active">
                <td>
                  <strong>{{ l.label ?? l.slug }}</strong>
                  <span class="code">?ref={{ l.slug }}</span>
                </td>
                <td>{{ l.setter ? (l.setter.name + ' ' + (l.setter.lastName ?? '')) : '—' }}</td>
                <td>{{ l.client?.name ?? 'Tutte' }}</td>
                <td>{{ channelLabel(l.channel) }}</td>
                <td class="num">{{ l.bookingsCount }}</td>
                <td class="actions">
                  @for (s of linkPages(l); track s.slug) {
                    <button type="button" class="btn-ghost sm" (click)="copy(pageUrl(s.slug) + '?ref=' + l.slug)" [attr.aria-label]="'Copia link ' + s.client.name">
                      <app-icon name="copy" [size]="13" /> {{ s.slug }}
                    </button>
                  }
                  <button type="button" class="btn-ghost sm" (click)="toggleLink(l)">{{ l.active ? 'Disattiva' : 'Attiva' }}</button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="muted">Nessun link creato</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class PrenotazioniConfigComponent {
  /** Academy mostrata (una alla volta, a schede) */
  readonly tab = signal(0);

  readonly coverageResource = rxResource({ stream: () => this.api.coverage() });

  coverageOf(id: number) {
    return this.coverageResource.value()?.find(c => c.id === Number(id)) ?? null;
  }

  /** Segnale sulla scheda: scoperto (rosso) o qualcuna senza orari (giallo) */
  issue(id: number): { level: 'alert' | 'warn' } | null {
    const c = this.coverageOf(id);
    if (!c) return null;
    if (c.freeSlots7d === 0) return { level: 'alert' };
    return c.withoutHours.length ? { level: 'warn' } : null;
  }

  private readonly api = inject(BookingApiService);
  private readonly sellerApi = inject(SellerApiService);
  private readonly setterApi = inject(SetterApiService);
  private readonly toast = inject(ToastService);

  readonly settingsResource = rxResource({ stream: () => this.api.settings() });
  readonly linksResource = rxResource({ stream: () => this.api.links() });
  readonly sellersResource = rxResource({ stream: () => this.sellerApi.getAll() });
  readonly settersResource = rxResource({ stream: () => this.setterApi.getAll() });

  readonly drafts = signal<BookingSettingsDto[]>([]);
  readonly links = computed(() => this.linksResource.value() ?? []);
  readonly sellers = computed(() => this.sellersResource.value() ?? []);
  readonly setters = computed(() => this.settersResource.value() ?? []);
  readonly savingId = signal<number | null>(null);
  readonly linkForm = signal<LinkForm>(emptyLink());
  readonly creatingLink = signal(false);

  readonly channels = CHANNELS;
  readonly slugify = slugify;

  constructor() {
    effect(() => {
      const value = this.settingsResource.value();
      if (value) {
        this.drafts.set(value.map(s => ({ ...s, sellerIds: (s.sellerIds ?? []).map(Number), brand: { ...(s.brand ?? {}) }, questions: [...(s.questions ?? [])] })));
      }
    });
  }

  val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  pageUrl(slug: string): string {
    return `${window.location.origin}/prenota/${slug}`;
  }

  channelLabel(c: BookingChannel): string {
    return CHANNELS.find(x => x.value === c)?.label ?? c;
  }

  linkPages(l: BookingLinkDto): BookingSettingsDto[] {
    return this.drafts().filter(s => !l.client || Number(s.client.id) === Number(l.client.id));
  }

  splitOptions(v: string): string[] {
    return v.split(';').map(x => x.trim()).filter(Boolean);
  }

  moveQuestion(si: number, qi: number, dir: -1 | 1): void {
    this.update(si, s => {
      const questions = [...s.questions];
      [questions[qi], questions[qi + dir]] = [questions[qi + dir], questions[qi]];
      return { ...s, questions };
    });
  }

  private update(si: number, fn: (s: BookingSettingsDto) => BookingSettingsDto): void {
    this.drafts.update(list => list.map((s, i) => (i === si ? fn(s) : s)));
  }

  patch(si: number, p: Partial<BookingSettingsDto>): void {
    this.update(si, s => ({ ...s, ...p }));
  }

  patchBrand(si: number, key: 'color' | 'logoUrl' | 'subtitle', value: string): void {
    this.update(si, s => ({ ...s, brand: { ...s.brand, [key]: value || undefined } }));
  }

  toggleSeller(si: number, id: number): void {
    this.update(si, s => ({
      ...s,
      sellerIds: s.sellerIds.includes(id) ? s.sellerIds.filter(x => x !== id) : [...s.sellerIds, id],
    }));
  }

  addQuestion(si: number): void {
    this.update(si, s => ({ ...s, questions: [...s.questions, { key: `q${Date.now().toString(36)}`, label: '', type: 'text', required: false }] }));
  }

  patchQuestion(si: number, qi: number, p: Partial<BookingQuestion>): void {
    this.update(si, s => ({ ...s, questions: s.questions.map((q, i) => (i === qi ? { ...q, ...p } : q)) }));
  }

  removeQuestion(si: number, qi: number): void {
    this.update(si, s => ({ ...s, questions: s.questions.filter((_, i) => i !== qi) }));
  }

  saveSettings(s: BookingSettingsDto): void {
    const questions = s.questions.filter(q => q.label.trim());
    this.savingId.set(s.id);
    this.api.updateSettings(Number(s.id), {
      title: s.title,
      durationMin: s.durationMin,
      bufferMin: s.bufferMin,
      slotStepMin: s.slotStepMin,
      minNoticeHours: s.minNoticeHours,
      horizonDays: s.horizonDays,
      changeLimitHours: s.changeLimitHours,
      sellerIds: s.sellerIds,
      questions,
      brand: s.brand,
      active: s.active,
    }).subscribe({
      next: () => {
        this.coverageResource.reload();
        this.savingId.set(null);
        this.toast.success('Pagina salvata');
        this.settingsResource.reload();
      },
      error: err => {
        this.savingId.set(null);
        const msg = err?.error?.message;
        this.toast.error(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Impossibile salvare'));
      },
    });
  }

  patchLink(p: Partial<LinkForm>): void {
    this.linkForm.update(f => ({ ...f, ...p }));
  }

  onSetter(id: number | null): void {
    const st = this.setters().find(x => Number(x.id) === id);
    this.linkForm.update(f => ({
      ...f,
      setterId: id,
      slug: f.slug || (st ? slugify(st.name ?? '') : ''),
      label: f.label || (st ? `${st.name ?? ''} – DM` : ''),
    }));
  }

  createLink(): void {
    const f = this.linkForm();
    this.creatingLink.set(true);
    this.api.createLink({
      slug: f.slug,
      label: f.label.trim() || null,
      setterId: f.setterId,
      clientId: f.clientId,
      channel: f.channel,
    }).subscribe({
      next: () => {
        this.creatingLink.set(false);
        this.linkForm.set(emptyLink());
        this.toast.success('Link creato');
        this.linksResource.reload();
      },
      error: err => {
        this.creatingLink.set(false);
        this.toast.error(err?.error?.message ?? 'Impossibile creare il link');
      },
    });
  }

  toggleLink(l: BookingLinkDto): void {
    this.api.updateLink(Number(l.id), { active: !l.active }).subscribe({
      next: () => this.linksResource.reload(),
      error: () => this.toast.error('Impossibile aggiornare il link'),
    });
  }

  copy(text: string): void {
    navigator.clipboard.writeText(text).then(
      () => this.toast.success('Link copiato'),
      () => this.toast.error('Copia non riuscita'),
    );
  }
}
