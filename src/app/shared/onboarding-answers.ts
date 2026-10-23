import type { BookingQuestion } from '../booking/booking-api.service';

// Le risposte del modulo di prenotazione arrivano nelle note del lead come
// righe "Domanda: risposta" (portale e Wix). Qui le ritrasformiamo in campi.

export interface ParsedAnswer {
  label: string;
  value: string;
  question: BookingQuestion | null;
}

export interface ParsedOnboarding {
  answers: ParsedAnswer[];
  meetUrl: string | null;
  info: string[];
}

const MEET = /^Link Google Meet:\s*(\S+)/i;
const INFO = /^(Prenotata dal portale|Call annullata)/i;

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findQuestion(label: string, questions: BookingQuestion[]): BookingQuestion | null {
  const n = norm(label);
  return (
    questions.find(q =>
      [q.label, q.shortLabel, ...(q.aliases ?? [])].some(l => l && norm(l) === n),
    ) ?? null
  );
}

export function parseOnboarding(notes: string | null | undefined, questions: BookingQuestion[] = []): ParsedOnboarding {
  const result: ParsedOnboarding = { answers: [], meetUrl: null, info: [] };
  for (const raw of (notes ?? '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const meet = MEET.exec(line);
    if (meet) {
      result.meetUrl = meet[1];
      continue;
    }
    if (INFO.test(line)) {
      result.info.push(line);
      continue;
    }
    const sep = line.indexOf(': ');
    const last = result.answers.at(-1);
    if (sep <= 0) {
      // risposta su più righe (testo lungo)
      if (last) last.value += `\n${line}`;
      else result.answers.push({ label: 'Note', value: line, question: null });
      continue;
    }
    const label = line.slice(0, sep).trim();
    const value = line.slice(sep + 2).trim();
    result.answers.push({ label, value, question: findQuestion(label, questions) });
  }
  return result;
}
