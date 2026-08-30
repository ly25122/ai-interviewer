'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { SAMPLES } from '@/lib/samples';
import { buildReadinessMap } from '@/lib/engine/readiness';
import {
  getServerSnapshot,
  getSnapshot,
  setLocalState,
  subscribe,
  type LocalState,
} from '@/lib/storage';
import demoState from '@/lib/demo-state.json';
import type {
  AnalyzeInput,
  ProbeSession,
  ProbeTurn,
  SelfRating,
  Syllabus,
  SyllabusTopic,
  TopicStatus,
} from '@/lib/types';

type Step = 'input' | 'rating' | 'map';

const DEMO_STATE = demoState as unknown as LocalState;

const STATUS_META: Record<TopicStatus, { label: string; cell: string; legend: string }> = {
  verified: { label: '实测确认', cell: 'bg-[var(--ok)] text-white', legend: 'bg-[var(--ok)]' },
  claimed: {
    label: '自评会，未验证',
    cell: 'bg-[rgba(31,107,74,0.14)] text-[var(--ok)]',
    legend: 'bg-[rgba(31,107,74,0.35)]',
  },
  shaky: {
    label: '不稳',
    cell: 'bg-[rgba(161,98,7,0.18)] text-[var(--warn)]',
    legend: 'bg-[var(--warn)]',
  },
  gap: { label: '不会', cell: 'bg-[var(--danger)] text-white', legend: 'bg-[var(--danger)]' },
  unrated: {
    label: '未评估',
    cell: 'bg-black/5 text-[var(--muted)]',
    legend: 'bg-black/20',
  },
};

const RATING_OPTIONS: Array<{ value: SelfRating; label: string; active: string }> = [
  { value: 'confident', label: '会', active: 'border-[var(--ok)] bg-[var(--ok)] text-white' },
  { value: 'unsure', label: '模糊', active: 'border-[var(--warn)] bg-[var(--warn)] text-white' },
  { value: 'unknown', label: '不会', active: 'border-[var(--danger)] bg-[var(--danger)] text-white' },
];

const STEP_LABEL: Record<Step, string> = {
  input: '建考纲',
  rating: '自评',
  map: '追问验证',
};

export default function PreparePage() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [pinnedStep, setPinnedStep] = useState<Step | null>(null);

  const step: Step =
    pinnedStep ??
    (!state.syllabus ? 'input' : Object.keys(state.ratings).length > 0 ? 'map' : 'rating');

  const map = useMemo(
    () => (state.syllabus ? buildReadinessMap(state.syllabus, state.ratings, state.probes) : null),
    [state],
  );

  const setStep = setPinnedStep;

  return (
    <main className="min-h-dvh bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[var(--paper-lift)]/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-baseline gap-3">
            <Link href="/" className="font-brand text-xl tracking-tight">
              AI面试官
            </Link>
            <p className="hidden text-sm text-[var(--muted)] sm:block">用真实面经练到会</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/interview"
              className="text-xs text-[var(--muted)] transition hover:text-[var(--ink)]"
            >
              简历面试
            </Link>
            <nav className="flex gap-1 text-xs">
              {(['input', 'rating', 'map'] as Step[]).map((s, i) => (
                <button
                  key={s}
                  type="button"
                  disabled={s !== 'input' && !state.syllabus}
                  onClick={() => setStep(s)}
                  className={`rounded-md px-3 py-1.5 transition disabled:cursor-not-allowed disabled:opacity-30 ${
                    step === s
                      ? 'bg-[var(--ink)] text-[var(--paper)]'
                      : 'text-[var(--muted)] hover:bg-black/5 hover:text-[var(--ink)]'
                  }`}
                >
                  {i + 1}. {STEP_LABEL[s]}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-5 py-8">
        {step === 'input' && (
          <InputStep
            onDone={(syllabus) => {
              setLocalState(() => ({ syllabus, ratings: {}, probes: {} }));
              setStep('rating');
            }}
            onLoadDemo={() => {
              setLocalState(() => DEMO_STATE);
              setStep('map');
            }}
          />
        )}

        {step === 'rating' && state.syllabus && (
          <RatingStep
            syllabus={state.syllabus}
            ratings={state.ratings}
            onRate={(topicId, rating) =>
              setLocalState((prev) => ({
                ...prev,
                ratings: { ...prev.ratings, [topicId]: rating },
              }))
            }
            onDone={() => setStep('map')}
          />
        )}

        {step === 'map' && map && state.syllabus && (
          <MapStep
            syllabus={state.syllabus}
            map={map}
            onProbeFinish={(session) =>
              setLocalState((prev) => ({
                ...prev,
                probes: { ...prev.probes, [session.topicId]: session },
              }))
            }
          />
        )}
      </div>
    </main>
  );
}

function InputStep({
  onDone,
  onLoadDemo,
}: {
  onDone: (syllabus: Syllabus) => void;
  onLoadDemo: () => void;
}) {
  const [posts, setPosts] = useState<string[]>(['', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const filled = posts.filter((p) => p.trim()).length;

  async function submit() {
    if (filled === 0 || loading) return;
    setLoading(true);
    setError('');
    try {
      const payload: AnalyzeInput[] = posts
        .filter((p) => p.trim())
        .map((content) => ({ content: content.trim() }));

      const res = await fetch('/api/syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? '聚合失败');
      onDone(data.syllabus as Syllabus);
    } catch (e) {
      setError(e instanceof Error ? e.message : '聚合失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-[var(--accent)]">STEP 01</p>
        <h1 className="font-brand mt-2 text-3xl leading-tight sm:text-4xl">先把面经变成考纲</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
          粘贴同一岗位的几篇面经。AI 面试官会先甄别可信度，再按考点归并——一篇高可信真面经的分量，高于五篇广告帖。
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPosts(SAMPLES.map((s) => `${s.title}\n\n${s.content}`))}
            className="btn-ghost rounded-md px-3 py-1.5 text-xs"
          >
            用三篇示例快速体验
          </button>
          <button
            type="button"
            onClick={onLoadDemo}
            className="btn-ghost rounded-md px-3 py-1.5 text-xs text-[var(--muted)]"
          >
            直接查看一份已完成的地图
          </button>
        </div>
      </div>

      {posts.map((post, i) => (
        <div key={i} className="relative">
          <textarea
            value={post}
            onChange={(e) =>
              setPosts((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))
            }
            placeholder={`第 ${i + 1} 篇面经正文`}
            className="field h-36 w-full resize-none rounded-lg p-3.5 text-sm leading-relaxed"
          />
          {posts.length > 1 && (
            <button
              type="button"
              onClick={() => setPosts((prev) => prev.filter((_, j) => j !== i))}
              className="absolute right-3 top-3 text-xs text-[var(--muted)] hover:text-[var(--ink)]"
            >
              移除
            </button>
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setPosts((prev) => [...prev, ''])}
          disabled={posts.length >= 8}
          className="btn-ghost rounded-md px-3 py-2 text-sm disabled:opacity-30"
        >
          再加一篇
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={loading || filled === 0}
          className="btn-primary rounded-md px-5 py-2 text-sm font-medium"
        >
          {loading ? `正在分析 ${filled} 篇，约 1 分钟` : `用这 ${filled} 篇生成考纲`}
        </button>
      </div>

      {error && (
        <p className="rounded-md border border-[rgba(159,45,58,0.25)] bg-[rgba(159,45,58,0.08)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  );
}

function RatingStep({
  syllabus,
  ratings,
  onRate,
  onDone,
}: {
  syllabus: Syllabus;
  ratings: Record<string, SelfRating>;
  onRate: (topicId: string, rating: SelfRating) => void;
  onDone: () => void;
}) {
  const rated = syllabus.topics.filter((t) => ratings[t.id]).length;

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-[var(--accent)]">STEP 02</p>
        <h1 className="font-brand mt-2 text-3xl leading-tight sm:text-4xl">
          这个岗位共 {syllabus.topics.length} 个考点
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          基于 {syllabus.postCount} 篇面经。不用写字，只标会、模糊、不会。范围有限，这件事本身就能让人踏实一些。
        </p>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-black/5">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all"
            style={{ width: `${(rated / Math.max(syllabus.topics.length, 1)) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          已评 {rated} / {syllabus.topics.length}
        </p>
      </div>

      <ul className="space-y-2">
        {syllabus.topics.map((topic) => (
          <li
            key={topic.id}
            className="surface flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{topic.title}</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {topic.category} · 在 {new Set(topic.sources.map((s) => s.postId)).size} 篇面经中出现
              </p>
            </div>
            <div className="flex gap-1.5">
              {RATING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onRate(topic.id, opt.value)}
                  className={`rounded-md border px-3 py-1.5 text-xs transition ${
                    ratings[topic.id] === opt.value
                      ? opt.active
                      : 'border-[var(--line)] bg-white text-[var(--muted)] hover:border-black/25'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onDone}
        disabled={rated === 0}
        className="btn-primary rounded-md px-5 py-2 text-sm font-medium"
      >
        进入追问验证
      </button>
    </div>
  );
}

function MapStep({
  syllabus,
  map,
  onProbeFinish,
}: {
  syllabus: Syllabus;
  map: ReturnType<typeof buildReadinessMap>;
  onProbeFinish: (session: ProbeSession) => void;
}) {
  const [probingTopic, setProbingTopic] = useState<SyllabusTopic | null>(null);

  const claimed = syllabus.topics.filter(
    (t) => map.cells.find((c) => c.topicId === t.id)?.status === 'claimed',
  );

  const byCategory = useMemo(() => {
    const groups = new Map<string, typeof map.cells>();
    for (const cell of map.cells) {
      const list = groups.get(cell.category) ?? [];
      list.push(cell);
      groups.set(cell.category, list);
    }
    return [...groups.entries()];
  }, [map]);

  const selfConfident = map.cells.filter((c) => c.selfRating === 'confident').length;

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-[var(--accent)]">STEP 03</p>
        <h1 className="font-brand mt-2 text-3xl leading-tight sm:text-4xl">准备度与追问</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          自评会不等于真的会。AI 面试官最多追问两轮，只看你能不能持续给出新的具体事实。
        </p>
      </div>

      {map.gapCount > 0 && (
        <div className="rounded-lg border border-[rgba(161,98,7,0.3)] bg-[rgba(161,98,7,0.08)] p-5">
          <p className="font-brand text-xl leading-relaxed text-[var(--warn)]">
            你以为自己会的 {selfConfident} 个考点里，有 {map.gapCount} 个经不起追问。
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--warn)]/90">
            这不是坏消息。真正让人焦虑的从来不是知道自己不会，
            而是隐隐怀疑「我以为我会的东西可能其实不会」。现在它变成了一份具体清单。
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="考点总数" value={map.total} hint={`来自 ${syllabus.postCount} 篇面经`} />
        <Stat label="已覆盖" value={map.covered} hint="自评会或实测确认" />
        <Stat
          label="自评与实测落差"
          value={map.gapCount}
          hint={map.gapCount > 0 ? '你以为会、但答不出新东西' : '尚未做追问验证'}
          emphasize={map.gapCount > 0}
        />
      </div>

      <div className="surface rounded-lg p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-brand text-lg">
            {syllabus.company} · {syllabus.role} 准备度地图
          </h2>
          <div className="flex flex-wrap gap-2.5">
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <span key={key} className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                <span className={`h-2.5 w-2.5 rounded-sm ${meta.legend}`} />
                {meta.label}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-2.5">
          {byCategory.map(([category, cells]) => (
            <div key={category} className="flex gap-3">
              <span className="w-16 shrink-0 pt-2 text-right text-xs text-[var(--muted)]">
                {category}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {cells.map((cell) => (
                  <span
                    key={cell.topicId}
                    title={`${cell.title} · ${STATUS_META[cell.status].label}`}
                    className={`flex h-9 max-w-[170px] items-center rounded-md px-2.5 text-[11px] font-medium ${STATUS_META[cell.status].cell}`}
                  >
                    <span className="truncate">{cell.title}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {claimed.length > 0 && (
        <div className="surface rounded-lg p-5">
          <h2 className="font-brand text-lg">让 AI 面试官追问你说会的考点</h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
            每个考点最多两轮。不评价答得好不好，只看有没有新增可验证事实。
          </p>
          {probingTopic ? (
            <ProbeDialog
              topic={probingTopic}
              onCancel={() => setProbingTopic(null)}
              onFinish={(session) => {
                onProbeFinish(session);
                setProbingTopic(null);
              }}
            />
          ) : (
            <ul className="mt-4 space-y-1.5">
              {claimed.map((topic) => (
                <li
                  key={topic.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-[var(--line)] bg-white px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{topic.title}</span>
                  <button
                    type="button"
                    onClick={() => setProbingTopic(topic)}
                    className="btn-primary shrink-0 rounded-md px-3 py-1 text-xs"
                  >
                    开始追问
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {map.nextThree.length > 0 && (
        <div className="surface rounded-lg p-5">
          <h2 className="font-brand text-lg">接下来只做这三件事</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            按考点权重 × 缺口排序。不给长清单，长清单只会加重压力。
          </p>
          <ol className="mt-4 space-y-3">
            {map.nextThree.map((action, i) => (
              <li key={action.topicId} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--ink)] text-xs text-[var(--paper)]">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">{action.title}</p>
                  <p className="text-xs text-[var(--muted)]">{action.reason}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function ProbeDialog({
  topic,
  onCancel,
  onFinish,
}: {
  topic: SyllabusTopic;
  onCancel: () => void;
  onFinish: (session: ProbeSession) => void;
}) {
  const [turns, setTurns] = useState<ProbeTurn[]>([]);
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function callProbe(history: Array<{ question: string; answer: string }>) {
    const res = await fetch('/api/probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicTitle: topic.title,
        variants: topic.variants,
        turns: history,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? '追问失败');
    return data as {
      judgement: { hasNewFact: boolean; reason: string } | null;
      outcome: 'continue' | 'verified' | 'collapsed';
      nextQuestion?: string;
    };
  }

  async function start() {
    setLoading(true);
    setError('');
    try {
      const data = await callProbe([]);
      setQuestion(data.nextQuestion ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '追问失败');
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!question || !answer.trim() || loading) return;
    setLoading(true);
    setError('');

    const history = [
      ...turns.map((t) => ({ question: t.question, answer: t.answer })),
      { question, answer: answer.trim() },
    ];

    try {
      const data = await callProbe(history);
      const judged: ProbeTurn = {
        question,
        answer: answer.trim(),
        hasNewFact: data.judgement?.hasNewFact ?? false,
        judgement: data.judgement?.reason ?? '',
      };
      const nextTurns = [...turns, judged];

      if (data.outcome === 'continue' && data.nextQuestion) {
        setTurns(nextTurns);
        setQuestion(data.nextQuestion);
        setAnswer('');
      } else {
        onFinish({
          topicId: topic.id,
          turns: nextTurns,
          outcome: data.outcome === 'verified' ? 'verified' : 'collapsed',
          collapsedAtTurn: data.outcome === 'collapsed' ? nextTurns.length : null,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '追问失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-[var(--accent)]/30 bg-[rgba(31,122,102,0.05)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.16em] text-[var(--accent)]">AI 面试官</p>
          <p className="mt-1 text-sm font-medium">{topic.title}</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 text-xs text-[var(--muted)] hover:text-[var(--ink)]"
        >
          退出
        </button>
      </div>

      {turns.map((turn, i) => (
        <div key={i} className="mt-3 space-y-1 border-l-2 border-[var(--accent)]/35 pl-3">
          <p className="text-xs text-[var(--muted)]">面试官：{turn.question}</p>
          <p className="text-xs text-[var(--ink)]">你：{turn.answer}</p>
          <p className="text-[11px] text-[var(--ok)]">{turn.judgement}</p>
        </div>
      ))}

      {!question && !loading && (
        <button
          type="button"
          onClick={start}
          className="btn-primary mt-4 rounded-md px-4 py-2 text-sm font-medium"
        >
          开始追问
        </button>
      )}

      {question && (
        <div className="mt-4 space-y-2">
          <p className="text-sm leading-relaxed">
            <span className="text-[var(--muted)]">第 {turns.length + 1} 轮 · 面试官：</span>
            {question}
          </p>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="说说看。想不起来就直说，这里不会有人评价你"
            className="field h-24 w-full resize-none rounded-md p-2.5 text-sm"
          />
          <button
            type="button"
            onClick={submit}
            disabled={loading || !answer.trim()}
            className="btn-primary rounded-md px-4 py-2 text-sm font-medium"
          >
            {loading ? '判定中' : '提交'}
          </button>
        </div>
      )}

      {loading && !question && <p className="mt-3 text-xs text-[var(--muted)]">正在准备问题</p>}
      {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  emphasize,
}: {
  label: string;
  value: number;
  hint: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-5 ${
        emphasize
          ? 'border-[rgba(161,98,7,0.3)] bg-[rgba(161,98,7,0.08)]'
          : 'surface'
      }`}
    >
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p
        className={`font-brand mt-1.5 text-4xl tabular-nums ${
          emphasize ? 'text-[var(--warn)]' : ''
        }`}
      >
        {value}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">{hint}</p>
    </div>
  );
}
