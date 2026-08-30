import { buildPrepReadiness } from './engine/readiness';
import { scoreSession } from './progress';
import type {
  InterviewPlan,
  NextAction,
  ReadinessMap,
  ResumeInterviewSession,
  ReviewArchive,
  ReviewPointSnapshot,
  Syllabus,
  TrainingMode,
} from './types';

const KEY = 'ai-interviewer.reviews.v1';
const MAX = 40;
const ANSWER_MAX = 4000;

const EMPTY: ReviewArchive[] = [];

let cache: ReviewArchive[] | null = null;
const listeners = new Set<() => void>();

function clip(text: string, max = ANSWER_MAX): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export function modeLabel(mode: TrainingMode): string {
  return mode === 'intel' ? '情报针对训练' : '完整模拟';
}

export function outcomeLabel(outcome: ReviewPointSnapshot['outcome']): string {
  if (outcome === 'verified') return '经得起追问';
  if (outcome === 'collapsed') return '经不起追问';
  return '未开始';
}

/** 今天 17:19 / 昨天 20:08 / 8月28日 20:08 */
export function formatArchiveTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000);
  if (diff === 0) return `今天 ${hm}`;
  if (diff === 1) return `昨天 ${hm}`;
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function archiveFingerprint(input: {
  company: string;
  role: string;
  mode: TrainingMode;
  points: ReviewPointSnapshot[];
}): string {
  const body = input.points
    .map((p) => `${p.id}:${p.outcome}:${p.turns.length}:${p.score}`)
    .join('|');
  return `${input.company}·${input.role}·${input.mode}·${body}`;
}

export function buildReviewArchive(input: {
  company: string;
  role: string;
  mode: TrainingMode;
  plan: InterviewPlan;
  sessions: Record<string, ResumeInterviewSession>;
  syllabus?: Syllabus;
  readiness?: ReadinessMap;
  at?: string;
  id?: string;
}): ReviewArchive | null {
  const points: ReviewPointSnapshot[] = input.plan.points.map((p) => {
    const session = input.sessions[p.id];
    return {
      id: p.id,
      title: p.title,
      source: p.source,
      outcome: session?.outcome ?? 'not_probed',
      collapsedAtTurn: session?.collapsedAtTurn ?? null,
      score: session ? scoreSession(session) : 0,
      turns: (session?.turns ?? []).map((t) => ({
        ...t,
        question: clip(t.question, 1200),
        answer: clip(t.answer),
        judgement: clip(t.judgement, 800),
      })),
    };
  });
  const done = points.filter((p) => p.outcome !== 'not_probed');
  if (done.length === 0) return null;

  const readiness =
    input.readiness ?? buildPrepReadiness(input.syllabus, input.plan, input.sessions);
  const verified = readiness.cells.filter((c) => c.status === 'verified').length;
  const shaky = readiness.cells.filter((c) => c.status === 'shaky').length;
  const uncovered = readiness.cells.filter(
    (c) => c.status === 'unrated' || c.status === 'gap',
  ).length;
  const avgScore = Math.round(done.reduce((s, p) => s + p.score, 0) / done.length);
  const nextThree: NextAction[] = readiness.nextThree.map((a) => ({
    topicId: a.topicId,
    title: a.title,
    reason: a.reason,
  }));
  const fingerprint = archiveFingerprint({
    company: input.company,
    role: input.role,
    mode: input.mode,
    points,
  });

  return {
    id: input.id ?? `rev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    fingerprint,
    at: input.at ?? new Date().toISOString(),
    company: input.company,
    role: input.role,
    mode: input.mode,
    planAt: input.plan.generatedAt,
    verified,
    shaky,
    uncovered,
    avgScore,
    nextThree,
    points,
  };
}

function isArchive(x: unknown): x is ReviewArchive {
  if (!x || typeof x !== 'object') return false;
  const a = x as ReviewArchive;
  return (
    typeof a.id === 'string' &&
    typeof a.at === 'string' &&
    typeof a.company === 'string' &&
    Array.isArray(a.points)
  );
}

function load(): ReviewArchive[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isArchive);
  } catch {
    return [];
  }
}

function save(list: ReviewArchive[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // 配额满时不影响当前会话
  }
}

function emit(): void {
  listeners.forEach((fn) => fn());
}

export function subscribeHistory(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getHistorySnapshot(): ReviewArchive[] {
  if (cache === null) cache = load();
  return cache;
}

export function getHistoryServerSnapshot(): ReviewArchive[] {
  return EMPTY;
}

function isSameRound(prev: ReviewArchive, next: ReviewArchive): boolean {
  return (
    Boolean(prev.planAt) &&
    prev.planAt === next.planAt &&
    prev.company === next.company &&
    prev.role === next.role &&
    prev.mode === next.mode
  );
}

/** 同一场反复进出复盘页不重复写入；同一场继续练完则覆盖；换了一轮训练则新增一条 */
export function saveReviewArchive(archive: ReviewArchive): ReviewArchive {
  const current = getHistorySnapshot();
  if (current[0]?.fingerprint === archive.fingerprint) return current[0];
  let incoming = archive;
  let rest = current;
  if (current[0] && isSameRound(current[0], archive)) {
    incoming = { ...archive, id: current[0].id };
    rest = current.slice(1);
  }
  const next = [incoming, ...rest.filter((x) => x.fingerprint !== incoming.fingerprint)].slice(
    0,
    MAX,
  );
  cache = next;
  save(next);
  emit();
  return incoming;
}

export function deleteReviewArchive(id: string): void {
  const next = getHistorySnapshot().filter((x) => x.id !== id);
  cache = next;
  save(next);
  emit();
}

export function doneCount(archive: ReviewArchive): number {
  return archive.points.filter((p) => p.outcome !== 'not_probed').length;
}
