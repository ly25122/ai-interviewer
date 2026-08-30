import type { PracticeRecord, ProbeOutcome, ProbeTurn } from './types';

const KEY = 'ai-interviewer.progress.v1';

/**
 * 分数来自可核验的行为，不来自模型主观评价：
 * 每一轮说出新事实 +35，撑住全部追问再 +30。
 */
export function scoreSession(input: {
  outcome: ProbeOutcome;
  turns: Array<Pick<ProbeTurn, 'hasNewFact'>>;
}): number {
  const facts = input.turns.filter((t) => t.hasNewFact).length;
  if (input.outcome === 'verified') {
    return Math.min(100, 70 + facts * 15);
  }
  if (input.outcome === 'not_probed') return 0;
  return Math.min(70, 15 + facts * 20);
}

export function scoreLabel(score: number): { text: string; tone: 'ok' | 'warn' | 'muted' } {
  if (score >= 80) return { text: '经得起', tone: 'ok' };
  if (score >= 50) return { text: '半撑住', tone: 'warn' };
  return { text: '需补练', tone: 'muted' };
}

export function dayKey(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const local = new Date(d.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function todayKey(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export interface DayBucket {
  date: string;
  count: number;
  avgScore: number;
  verified: number;
  collapsed: number;
}

export interface ProgressSummary {
  today: DayBucket;
  yesterday: DayBucket | null;
  week: DayBucket[];
  streak: number;
  totalCount: number;
  delta: number | null;
}

export function summarize(records: PracticeRecord[], now = new Date()): ProgressSummary {
  const today = todayKey(now);
  const buckets = new Map<string, PracticeRecord[]>();
  for (const r of records) {
    const k = dayKey(r.at, now);
    const list = buckets.get(k) ?? [];
    list.push(r);
    buckets.set(k, list);
  }

  function bucket(date: string): DayBucket {
    const list = buckets.get(date) ?? [];
    const count = list.length;
    const avgScore =
      count === 0 ? 0 : Math.round(list.reduce((s, x) => s + x.score, 0) / count);
    return {
      date,
      count,
      avgScore,
      verified: list.filter((x) => x.outcome === 'verified').length,
      collapsed: list.filter((x) => x.outcome === 'collapsed').length,
    };
  }

  const week: DayBucket[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    week.push(bucket(todayKey(d)));
  }

  const todayBucket = bucket(today);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const yesterday = bucket(todayKey(y));

  let streak = 0;
  for (let i = 0; ; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const k = todayKey(d);
    if ((buckets.get(k) ?? []).length === 0) {
      if (i === 0) continue;
      break;
    }
    streak += 1;
    if (i > 30) break;
  }

  const delta =
    yesterday.count > 0 && todayBucket.count > 0
      ? todayBucket.avgScore - yesterday.avgScore
      : null;

  return {
    today: todayBucket,
    yesterday: yesterday.count > 0 ? yesterday : null,
    week,
    streak,
    totalCount: records.length,
    delta,
  };
}

export function toRecord(
  pointTitle: string,
  session: {
    pointId: string;
    outcome: ProbeOutcome;
    collapsedAtTurn: number | null;
    turns: ProbeTurn[];
  },
  at = new Date().toISOString(),
): PracticeRecord {
  return {
    id: `${session.pointId}-${at}`,
    at,
    pointTitle,
    outcome: session.outcome,
    collapsedAtTurn: session.collapsedAtTurn,
    factTurns: session.turns.filter((t) => t.hasNewFact).length,
    totalTurns: session.turns.length,
    score: scoreSession(session),
  };
}

let cache: PracticeRecord[] | null = null;
const listeners = new Set<() => void>();

function load(): PracticeRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PracticeRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(records: PracticeRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(records.slice(-400)));
  } catch {
    // 配额满时不影响当前会话
  }
}

export function subscribeProgress(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getProgressSnapshot(): PracticeRecord[] {
  if (cache === null) cache = load();
  return cache;
}

export function getProgressServerSnapshot(): PracticeRecord[] {
  return EMPTY_PROGRESS;
}

export const EMPTY_PROGRESS: PracticeRecord[] = [];

export function addPracticeRecord(record: PracticeRecord): void {
  const next = [...getProgressSnapshot(), record];
  cache = next;
  save(next);
  listeners.forEach((fn) => fn());
}
