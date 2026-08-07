# Analisi Architetturale: Learning Platform

## Contesto e punto di partenza

Il sistema attuale funziona così:
- Cliente paga rata Stripe → webhook → installment marcato `paid`
- `TelegramSegment` mappa `(ServiceVariant + installmentNumber)` → `telegramChatId`
- Bot genera link invito monouso → venditore invia al cliente → cliente entra nel canale

Il cliente NON ha account web. Il suo unico accesso è il canale Telegram.
La learning platform digitalizza questo meccanismo: invece di sbloccare un canale Telegram, si sblocca un modulo video su web.

---

## Risposta alla domanda chiave: interno o separato?

### Raccomandazione: **app FE separata + stesso backend NestJS**

Non aggiungere la piattaforma learning all'interno del portale interno. Le ragioni sono architetturali, non di preferenza:

| Criterio | Portale interno (Angular) | Learning platform |
|----------|--------------------------|-------------------|
| **Utenti** | Team interno: seller, setter, admin (~20 persone) | Clienti paganti (potenzialmente migliaia) |
| **Auth** | JWT staff | JWT cliente (sistema separato) |
| **Scopo** | Tool operativo | Prodotto per il cliente |
| **SEO/SSR** | Non necessario | Utile per pagine pubbliche |
| **Branding** | internal.imprendig.it | academy.imprendig.it |
| **Esposizione dati** | Vede tutto (vendite, team, commissions) | Vede solo i propri corsi |

Mettere i clienti nel portale interno significherebbe: costruire un secondo sistema auth dentro lo stesso app, rischiare esposizione dati interni, forzare una UI pensata per seller ad accogliere student. Non ha senso.

**Il backend NestJS rimane uno solo.** Si estende con nuovi moduli (`customer-auth`, `learning`, `bunny`). Il frontend learning è una nuova app Next.js che parla con lo stesso NestJS.

---

## Schema architetturale

```
┌──────────────────────────────────────────────────────────────┐
│                    NestJS Backend (esistente)                  │
│                                                               │
│  ESISTENTE:                      NUOVO:                       │
│  ├─ StripeWebhook                ├─ CustomerAuthModule        │
│  ├─ InstallmentModule            ├─ LearningModule            │
│  ├─ SaleModule                   ├─ BunnyService              │
│  ├─ CustomerModule               └─ CustomerModuleAccess      │
│  ├─ TelegramSegmentModule                                     │
│  ├─ OnboardingFormModule                                      │
│  └─ AiModule                                                  │
│                                                               │
│              ↕ stessa DB Supabase PostgreSQL                  │
└──────────────────────────────────────────────────────────────┘
        ↑                              ↑
        │ JWT staff                    │ JWT customer
        │                              │
┌───────────────┐           ┌──────────────────────┐
│ Angular (FE   │           │  Next.js              │
│ portale       │           │  academy.imprendig.it │
│ interno)      │           │                       │
│               │           │  - Login/magic link   │
│  Solo team:   │           │  - Dashboard corsi    │
│  seller/admin │           │  - Player video       │
│  setter       │           │  - Progress tracking  │
└───────────────┘           └──────────────────────┘
```

---

## Cosa si riusa dal BE esistente (zero riscrittura)

| Modulo esistente | Come viene riusato |
|-----------------|-------------------|
| `Customer` entity | Il cliente ha già nome, email, CF, indirizzo |
| `Sale` entity | Sa quali piani ha acquistato il cliente |
| `Installment` entity | Sa quali rate sono pagate → quali moduli sbloccare |
| `PricePlan` + `ServiceVariant` | Definiscono il prodotto/corso |
| `TelegramSegmentModule` | Già mappa variant+installment → contenuto. Si AFFIANCA con LearningModule |
| `StripeWebhook processor` | Si estende: quando installment.status → 'paid', oltre al Telegram unlock, si chiama anche `learningService.unlockModule()` |

Il meccanismo di sblocco è identico a quello Telegram. Differisce solo nel "cosa" viene sbloccato.

---

## Nuovi moduli BE da creare

### 1. `CustomerAuthModule` — autenticazione clienti

**Strategia scelta: magic link via email**

Il cliente non deve ricordare una password. Riceve email con link che lo autentica direttamente. Questo si integra perfettamente con il flusso già esistente (l'onboarding form usa già token monouso).

```
POST /customer-auth/request-link   { email }
  → cerca Customer by email
  → genera token UUID, salva in customer_auth_tokens (TTL 15 min)
  → invia email con: https://academy.imprendig.it/auth/verify?token=xxx

GET  /customer-auth/verify/:token
  → valida token non scaduto
  → restituisce JWT customer (payload: { customerId, email, role: 'customer' })
```

**Entity: `CustomerAuthToken`** (nuova tabella)
```sql
CREATE TABLE customer_auth_tokens (
  id         BIGSERIAL PRIMARY KEY,
  customer_id BIGINT REFERENCES customers(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  used       BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**JWT separato per customer**: stesso `JwtModule`, ma `payload.role = 'customer'`. Il `RolesGuard` esistente viene esteso con il ruolo `customer`. Le API riservate ai clienti usano `@Roles('customer')`.

**Alternativa più semplice**: email + password con reset link. Meno elegante ma più familiare per alcuni utenti. Facile da aggiungere dopo.

---

### 2. `LearningModule` — mappatura contenuti

Questo modulo replica in digitale ciò che `TelegramSegment` fa per Telegram.

**Entity: `LearningSection`** (nuova tabella)
```sql
CREATE TABLE learning_sections (
  id                  BIGSERIAL PRIMARY KEY,
  service_variant_id  BIGINT REFERENCES service_variants(id),
  installment_number  INT NOT NULL,          -- quale rata sblocca questa sezione
  title               TEXT NOT NULL,          -- "Modulo 1 - Fondamenta"
  description         TEXT,
  bunny_folder_id     TEXT,                   -- ID cartella su Bunny.net (contiene i video)
  sort_order          INT DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_variant_id, installment_number)
);
```

**Entity: `LearningVideo`** (nuova tabella)
```sql
CREATE TABLE learning_videos (
  id                 BIGSERIAL PRIMARY KEY,
  learning_section_id BIGINT REFERENCES learning_sections(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  bunny_video_id     TEXT NOT NULL,           -- GUID del video su Bunny.net
  duration_seconds   INT,
  sort_order         INT DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);
```

**Entity: `CustomerModuleAccess`** (nuova tabella)
```sql
CREATE TABLE customer_module_access (
  id                  BIGSERIAL PRIMARY KEY,
  customer_id         BIGINT REFERENCES customers(id) ON DELETE CASCADE,
  learning_section_id BIGINT REFERENCES learning_sections(id) ON DELETE CASCADE,
  installment_id      BIGINT REFERENCES installments(id),
  unlocked_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, learning_section_id)
);
```

**API endpoints** (tutti `@Roles('customer')`):
```
GET /learning/my-courses
  → Restituisce i corsi acquistati dal customer autenticato
  → Raggruppa le LearningSection per ServiceVariant
  → Per ogni sezione indica: locked | unlocked

GET /learning/section/:id/videos
  → Verifica CustomerModuleAccess per questa sezione
  → Se accesso OK: restituisce lista video con signed Bunny URL (TTL 4h)
  → Se no: 403 Forbidden

POST /learning/video/:id/progress  { watchedSeconds, completed }
  → Salva il progresso di visione (opzionale, fase 2)
```

**API admin** (`@Roles('admin')`):
```
POST /learning/sections          → Crea sezione e collegamento a ServiceVariant
PATCH /learning/sections/:id     → Modifica titolo/folder
POST /learning/videos            → Aggiunge video a una sezione
PATCH /learning/videos/:id       → Modifica titolo/ordine/video
GET /learning/admin/access/:customerId   → Vedi accessi di un cliente
POST /learning/admin/access/unlock      → Sblocco manuale (override admin)
```

---

### 3. `BunnyService` — integrazione Bunny.net

Bunny.net ha tre prodotti rilevanti:
- **Bunny Stream**: hosting video + transcodifica (quello che serve)
- **Bunny Storage**: file storage generico
- **Bunny CDN**: delivery

**Signed URL** per proteggere i video:
```typescript
// BunnyService.generateSignedEmbedUrl(videoId: string): string
const expires = Math.floor(Date.now() / 1000) + 4 * 3600; // 4 ore
const token = crypto
  .createHash('sha256')
  .update(BUNNY_TOKEN_KEY + videoId + expires)
  .digest('hex');

return `https://iframe.mediadelivery.net/embed/${LIBRARY_ID}/${videoId}`
  + `?token=${token}&expires=${expires}&autoplay=false`;
```

`BUNNY_TOKEN_KEY` e `BUNNY_LIBRARY_ID` vanno in `.env`. Il cliente vede solo l'URL con token — scade in 4 ore, non può essere condiviso. Il contenuto è protetto.

**Struttura Bunny consigliata**:
```
Bunny Library: "ImprendIG Academy"
  └── Cartelle (folder):
      ├── modulo-1/
      │   ├── video-1-introduzione.mp4
      │   └── video-2-fondamenta.mp4
      ├── modulo-2/
      │   └── ...
      └── modulo-3/
```

Ogni `LearningSection` punta a una cartella. Ogni `LearningVideo` punta a un singolo video ID di Bunny.

**API Bunny** (opzionale, per admin panel):
```typescript
// BunnyService può anche:
getVideosInFolder(folderId) // per sincronizzare lista video dal pannello Bunny
getVideoInfo(videoId)       // durata, thumbnail, encoding status
```

---

### 4. Estensione del Webhook Stripe

Nell'esistente `stripe-events.processor.ts`, nella funzione `handleInvoicePaymentSucceeded()`, dopo il blocco Telegram, si aggiunge:

```typescript
// ESISTENTE (rimane invariato)
await this.onboardingFormService.notifySeller(...); // Telegram unlock

// NUOVO (aggiunto in parallelo)
await this.learningService.unlockForCustomer(
  sale.customer.id,
  sale.pricePlan.serviceVariant.id,
  installment.installmentNumber,
  installment.id
);
```

`learningService.unlockForCustomer()`:
1. Trova `LearningSection` by `(serviceVariantId, installmentNumber)`
2. Crea record `CustomerModuleAccess` se non esiste
3. Fire-and-forget, non blocca il flusso Stripe

I due sistemi (Telegram + Learning) sono completamente indipendenti. Un cliente può avere accesso a entrambi o solo uno, senza interferenze.

---

## Frontend: Next.js per la Learning Platform

**Perché Next.js invece di Angular:**
- SSR per le pagine pubbliche (landing del corso, SEO)
- App Router moderno, più adatto a routing customer-facing
- Ottimo supporto a video player (react-player, next/video)
- Deploy su Vercel in minuti (zero config)
- Il team Angular rimane per il portale interno — le due app sono indipendenti

**Struttura pagine:**

```
/                          → Landing pubblica (descrizione corsi disponibili)
/login                     → Inserisci email → ricevi magic link
/auth/verify?token=xxx     → Verifica token → redirect a /dashboard
/dashboard                 → I miei corsi (lista ServiceVariant acquistati)
/corso/[variantSlug]       → Dettaglio corso con moduli (locked/unlocked)
/corso/[variantSlug]/modulo/[sectionId]  → Player video + lista lezioni
/profilo                   → Dati personali (readonly, da Customer)
```

**Stack consigliato:**
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS (consistente con il BE, zero nuove regole da imparare)
- `react-player` o player iframe Bunny nativo per video
- `swr` o `@tanstack/query` per data fetching

---

## Flusso utente completo (dal pagamento all'accesso)

```
1. Cliente paga rata su Stripe
   ↓
2. Stripe webhook → installment.status = 'paid'
   ↓ (parallelo)
   ├─ [esistente] Telegram unlock → venditore riceve link → cliente entra in canale
   └─ [nuovo] CustomerModuleAccess creato per questo cliente + sezione
   ↓
3. Cliente riceve email (esistente onboarding form, si può estendere con link alla piattaforma):
   "Il modulo X è stato sbloccato! Accedi su academy.imprendig.it"
   ↓
4. Cliente va su academy.imprendig.it → inserisce email
   ↓
5. Riceve magic link → click → JWT cookie settato
   ↓
6. Dashboard: vede i propri corsi. I moduli già pagati sono accessibili (verde),
   quelli futuri sono bloccati con "Disponibile con la rata N" (grigio)
   ↓
7. Clicca su modulo sbloccato → BE verifica CustomerModuleAccess → restituisce signed Bunny URLs
   ↓
8. Video player con URL firmato (scade in 4h, non condivisibile)
```

---

## Stima effort

| Fase | Descrizione | Giorni |
|------|-------------|--------|
| BE: CustomerAuth | Entity + magic link flow + JWT customer | 1 |
| BE: LearningModule | Entity + service + controller + Bunny signed URL | 2 |
| BE: estensione Stripe | Unlock learning in parallelo al Telegram | 0.5 |
| FE Next.js: auth flow | Login + verify + dashboard base | 2 |
| FE Next.js: corso + player | Moduli, locked/unlocked UI, video player | 3 |
| Admin panel (in portale interno) | Gestione sezioni/video (Angular, già esistente) | 1.5 |
| **Totale MVP** | | **~10 giorni** |

Il portale interno Angular può ricevere una sezione admin per caricare/associare i video Bunny alle sezioni — non serve un pannello separato.

---

## Cose da decidere prima di implementare

1. **Email per magic link**: serve un servizio email (Resend, SendGrid, Postmark). Il BE non ha attualmente un email service. Resend è il più semplice (SDK minimal, free tier 3000 email/mese).

2. **Bunny Library ID**: va creato su bunny.net, caricati i video, e salvati i GUID. I GUID dei video vanno inseriti nel pannello admin.

3. **Dominio**: `academy.imprendig.it` va configurato. Deploy Next.js su Vercel (5 minuti). 

4. **Notifica email al cliente**: quando si sblocca un modulo, conviene inviare email "Il modulo X è disponibile". Si fa nel `learningService.unlockForCustomer()` con il servizio email scelto.

5. **Progress tracking** (opzionale fase 2): tracciare quanti secondi di video ha visto il cliente. Richiede una tabella `video_progress` e chiamate periodiche dal player.

---

## Alternativa: usare il portale interno con ruolo `customer`

**Non consigliato.** Richiederebbe:
- Aggiungere `customer` al sistema di ruoli esistente
- Filtrare TUTTI gli endpoint esistenti per nascondere dati interni
- Costruire una UX completamente diversa dentro la stessa shell Angular
- Il cliente vedrebbe la sidebar con "Chiamate", "Vendite", "Provvigioni" etc (anche se bloccate)
- Impossibile dare un URL con brand pulito (`academy.imprendig.it`)

Il costo di tenere le due app separate è zero: stesso BE, stesso DB, deploy Next.js in 5 minuti su Vercel.