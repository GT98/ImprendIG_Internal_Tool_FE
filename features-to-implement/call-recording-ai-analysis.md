# Piano: Registrazione e analisi AI delle chiamate

## Context

Il team usa Notion AI per registrare, trascrivere e analizzare le chiamate di vendita. Si vuole
integrare la stessa funzionalità nel portale, direttamente nella pagina "Chiamate" dove già esiste
il drawer di dettaglio di ogni lead. L'obiettivo è: registra → trascrivi → analisi AI con
strengths, miglioramenti, next steps.

**Risposta alla domanda tecnica:**
- **Fattibile sì**, complessità media (2-3 giorni).
- **Gemini è la scelta giusta**: `@google/generative-ai` v0.24.1 è già installato nel BE e attivo.
  Gemini 1.5 Flash supporta input audio diretto (WebM, MP3, OGG, ecc.).
  Zero nuove dipendenze o API key da configurare.
- **Alternativa** (solo se la qualità di trascrizione in italiano risultasse insufficiente):
  Groq Whisper (`whisper-large-v3`, gratuito, ~10s per 5 min audio) aggiungendo solo
  `groq-sdk` e `GROQ_API_KEY`. Upgrade facile a posteriori.

---

## Architettura

### Flusso completo

```
FE: click "Registra"
  → MediaRecorder API (browser built-in, WebM/Opus)
  → click "Stop" → blob audio in memoria
  → POST /call-analysis/:leadId  (multipart/form-data, campo: audio)
BE:
  → Multer riceve il buffer
  → Lead context (name, seller, service, notes) caricato da LeadService
  → Gemini 1.5 Flash: trascrizione audio (inline base64 per < ~15 min)
  → Gemini 2.0 Flash: analisi trascrizione + contesto
  → Salva transcript + analysis JSON nella tabella call_analyses
  → Restituisce risultato al FE
FE: mostra panel analisi (summary, score, punti forza, miglioramenti, next steps)
```

---

## Database

### Nuova tabella `call_analyses` (SQL da eseguire su Supabase)

```sql
CREATE TABLE IF NOT EXISTS call_analyses (
  id              BIGSERIAL PRIMARY KEY,
  lead_id         BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  transcript      TEXT NOT NULL,
  analysis        JSONB NOT NULL,
  duration_seconds INT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON call_analyses(lead_id);
```

**Struttura JSON `analysis`:**
```json
{
  "summary": "Chiamata con prospect interessato...",
  "outcome": "positive",
  "score": 7,
  "strengths": ["Apertura efficace", "Gestione obiezione prezzo"],
  "improvements": ["Domande di qualificazione mancanti", "Chiusura troppo frettolosa"],
  "nextSteps": ["Inviare proposta entro domani", "Richiama tra 3 giorni"],
  "keyObjections": ["Prezzo alto rispetto ai competitor"],
  "sentiment": "curioso ma cauto"
}
```

---

## Backend — Nuovo modulo `src/call-analysis/`

### File da creare

**`call-analysis.entity.ts`**
```typescript
@Entity('call_analyses')
export class CallAnalysis {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id: number;
  @ManyToOne(() => Lead, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' }) lead: Lead;
  @Column({ type: 'bigint', name: 'lead_id' }) leadId: number;
  @Column({ type: 'text' }) transcript: string;
  @Column({ type: 'jsonb' }) analysis: Record<string, unknown>;
  @Column({ type: 'int', nullable: true, name: 'duration_seconds' }) durationSeconds: number | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
```

**`call-analysis.service.ts`** — metodo principale:

```typescript
async transcribeAndAnalyze(leadId: number, audioBuffer: Buffer, mimeType: string, durationSeconds?: number): Promise<CallAnalysis> {
  // 1. Carica contesto lead
  const lead = await this.leadService.findOne(leadId);

  // 2. Trascrizione con Gemini 1.5 Flash (inline base64)
  const model15 = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const transcriptResult = await model15.generateContent([
    { inlineData: { data: audioBuffer.toString('base64'), mimeType } },
    'Trascrivi questa registrazione audio in italiano. Restituisci solo il testo trascritto, senza commenti.'
  ]);
  const transcript = transcriptResult.response.text();

  // 3. Analisi con Gemini 2.0 Flash
  const model20 = this.genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' });
  const analysisResult = await model20.generateContent([ANALYSIS_PROMPT(lead, transcript)]);
  const analysis = JSON.parse(analysisResult.response.text());

  // 4. Salva e restituisce
  return this.repo.save({ leadId, transcript, analysis, durationSeconds });
}
```

**`call-analysis.controller.ts`**
```
POST /call-analysis/:leadId   @UseInterceptors(FileInterceptor('audio'))  @Roles('seller','admin')
GET  /call-analysis/:leadId   @Roles('seller','admin')
```

**Prompt analisi** — passato come stringa con: nome prospect, venditore, servizio, note, trascrizione.
Risposta forzata a JSON con il formato definito sopra.

**`call-analysis.module.ts`** — imports: `TypeOrmModule.forFeature([CallAnalysis])`, `LeadModule`
Aggiungere a `AppModule`.

---

## Frontend — UI nel drawer chiamata

### File da modificare: `calls.component.ts`

Il drawer di dettaglio chiamata (già esistente) riceve un nuovo pannello "Analisi AI" nella parte inferiore.

**Nuovo stato nel componente:**
```typescript
readonly isRecording = signal(false);
readonly analysisLoading = signal(false);
readonly callAnalysis = signal<CallAnalysisDto | null>(null);
private mediaRecorder?: MediaRecorder;
private audioChunks: Blob[] = [];
private recordingStart?: number;
```

**Recording flow:**
```typescript
async startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  this.mediaRecorder = new MediaRecorder(stream);
  this.audioChunks = [];
  this.recordingStart = Date.now();
  this.mediaRecorder.ondataavailable = e => this.audioChunks.push(e.data);
  this.mediaRecorder.onstop = () => this.uploadAndAnalyze();
  this.mediaRecorder.start();
  this.isRecording.set(true);
}

stopRecording() {
  this.mediaRecorder?.stop();
  this.isRecording.set(false);
}

private async uploadAndAnalyze() {
  this.analysisLoading.set(true);
  const duration = Math.round((Date.now() - this.recordingStart!) / 1000);
  const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
  const form = new FormData();
  form.append('audio', blob, 'call.webm');
  form.append('durationSeconds', String(duration));
  const result = await this.callAnalysisApi.analyze(this.selectedCall().id, form);
  this.callAnalysis.set(result);
  this.analysisLoading.set(false);
}
```

**Template (in fondo al drawer):**
```
─── Analisi AI ──────────────────────────
[● Registra] / [■ Stop] / timer: 01:23

--- quando analysis disponibile ---
[Score: 7/10 ●●●●●●●○○○]
Summary: "..."
✓ Punti di forza (list)
↗ Da migliorare (list)
→ Prossimi passi (list)
💬 Obiezioni emerse (list)
```

### Nuovo file: `call-analysis-api.service.ts`
```typescript
@Injectable({ providedIn: 'root' })
export class CallAnalysisApiService {
  analyze(leadId: number, form: FormData): Promise<CallAnalysisDto>
  getByLeadId(leadId: number): Promise<CallAnalysisDto | null>
}
```

---

## File da modificare/creare

| File | Azione |
|------|--------|
| `imprendig_it_be/src/call-analysis/call-analysis.entity.ts` | Crea |
| `imprendig_it_be/src/call-analysis/call-analysis.service.ts` | Crea |
| `imprendig_it_be/src/call-analysis/call-analysis.controller.ts` | Crea |
| `imprendig_it_be/src/call-analysis/call-analysis.module.ts` | Crea |
| `imprendig_it_be/src/app.module.ts` | Aggiunge CallAnalysisModule |
| `imprendig_it_fe/src/app/call-analysis/call-analysis-api.service.ts` | Crea |
| `imprendig_it_fe/src/app/features/calls/calls.component.ts` | Aggiunge recorder + analysis panel nel drawer |

---

## Limiti e note

- **Durata massima registrazione**: ~15 minuti inline (WebM/Opus ≈ 200KB/min → 3MB). Per chiamate più lunghe, usare Gemini File API (upgrade facile: `fileManager.uploadFile()`).
- **Browser compatibility**: Chrome e Edge usano `audio/webm;codecs=opus` (supportato da Gemini). Safari usa `audio/mp4` — entrambi supportati.
- **Permesso microfono**: gestito nativamente dal browser con `getUserMedia`.
- **Costo**: Gemini 1.5 Flash per audio è gratuito nel free tier per volumi bassi. Per volumi alti, ~$0.002/min.

---

## Verifica end-to-end

1. BE: `npm run build` senza errori
2. SQL: creare tabella `call_analyses` su Supabase
3. BE: `POST /call-analysis/123` con file audio.webm → riceve `{ transcript, analysis }` 
4. FE: aprire drawer di una chiamata "fatta" → vedere sezione "Analisi AI"
5. Cliccare "Registra", parlare per 10-15 secondi, cliccare "Stop"
6. Attendere ~5-10s → appare il pannello con summary, score, strengths, next steps
7. Riaprire lo stesso drawer → l'analisi precedente viene ricaricata da DB
