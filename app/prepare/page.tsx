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
} from '@/lib/storage';
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

const STATUS_META: Record<TopicStatus, { label: string; cell: string; legend: string }> = {
  verified: { label: '实测确认', cell: 'bg-emerald-500', legend: 'bg-emerald-500' },
  claimed: { label: '自评会，未验证', cell: 'bg-emerald-200', legend: 'bg-emerald-200' },
  shaky: { label: '不稳', cell: 'bg-amber-400', legend: 'bg-amber-400' },
  gap: { label: '不会', cell: 'bg-rose-400', legend: 'bg-rose-400' },
  unrated: { label: '未评估', cell: 'bg-slate-200', legend: 'bg-slate-200' },
};

const RATING_OPTIONS: Array<{ value: SelfRating; label: string; tone: string }> = [
  { value: 'confident', label: '会', tone: 'hover:border-emerald-400 hover:bg-emerald-50' },
  { value: 'unsure', label: '模糊', tone: 'hover:border-amber-400 hover:bg-amber-50' },
  { value: 'unknown', label: '不会', tone: 'hover:border-rose-400 hover:bg-rose-50' },
];

export default function PreparePage() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  /** null 表示跟随数据自动推导，用户手动切换后才固定 */
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
    <main className="mx-auto w-full max-w-5xl px-5 py-8">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <Link href="/" className="text-2xl font-semibold tracking-tight">
            底气
          </Link>
          <p className="text-sm text-slate-500">让你知道自己准备到哪了</p>
        </div>
        <nav className="flex gap-1 text-xs">
          {(['input', 'rating', 'map'] as Step[]).map((s, i) => (
            <button
              key={s}
              type="button"
              disabled={s !== 'input' && !state.syllabus}
              onClick={() => setStep(s)}
              className={`rounded-full px-3 py-1 transition disabled:cursor-not-allowed disabled:text-slate-300 ${
                step === s ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              {i + 1}. {{ input: '建考纲', rating: '自评', map: '准备度' }[s]}
            </button>
          ))}
        </nav>
      </header>

      {step === 'input' && (
        <InputStep
          onDone={(syllabus) => {
            setLocalState(() => ({ syllabus, ratings: {}, probes: {} }));
            setStep('rating');
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
    </main>
  );
}

function InputStep({ onDone }: { onDone: (syllabus: Syllabus) => void }) {
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
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold">第一步：把面经变成考纲</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
          粘贴几篇同一岗位的面经。系统会先判断每篇能不能信，再把题目按考点归并，
          按可信度加权排序——一篇高可信真面经的分量，高于五篇广告帖。
        </p>
        <button
          type="button"
          onClick={() => setPosts(SAMPLES.map((s) => `${s.title}\n\n${s.content}`))}
          className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 transition hover:border-slate-400"
        >
          用三篇示例快速体验
        </button>
      </div>

      {posts.map((post, i) => (
        <div key={i} className="relative">
          <textarea
            value={post}
            onChange={(e) =>
              setPosts((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))
            }
            placeholder={`第 ${i + 1} 篇面经正文`}
            className="h-36 w-full resize-none rounded-xl border border-slate-300 bg-white p-3 text-sm leading-relaxed outline-none focus:border-slate-500"
          />
          {posts.length > 1 && (
            <button
              type="button"
              onClick={() => setPosts((prev) => prev.filter((_, j) => j !== i))}
              className="absolute right-3 top-3 text-xs text-slate-400 hover:text-slate-700"
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
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          再加一篇
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={loading || filled === 0}
          className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? `正在分析 ${filled} 篇，约 1 分钟` : `用这 ${filled} 篇生成考纲`}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
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
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold">
          第二步：三分钟过一遍，这个岗位共 {syllabus.topics.length} 个考点
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
          基于 {syllabus.postCount} 篇面经聚合而来。不用写字，只需要判断会、模糊、还是不会。
          考点范围是有限的，这件事本身就能让人踏实一些。
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-slate-900 transition-all"
            style={{ width: `${(rated / Math.max(syllabus.topics.length, 1)) * 100}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          已评 {rated} / {syllabus.topics.length}
        </p>
      </div>

      <ul className="space-y-2">
        {syllabus.topics.map((topic) => (
          <li
            key={topic.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{topic.title}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {topic.category} · 在 {new Set(topic.sources.map((s) => s.postId)).size} 篇面经中出现
              </p>
            </div>
            <div className="flex gap-1.5">
              {RATING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onRate(topic.id, opt.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                    ratings[topic.id] === opt.value
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : `border-slate-300 bg-white text-slate-600 ${opt.tone}`
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
        className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        看我的准备度
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

  /** 只验证「自评说会」的考点。说不会的没什么可验证的，说模糊的用户自己已经知道了 */
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
    <div className="space-y-5">
      {map.gapCount > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
          <p className="text-lg font-semibold leading-relaxed text-amber-900">
            你以为自己会的 {selfConfident} 个考点里，有 {map.gapCount} 个经不起追问。
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-amber-800">
            这不是坏消息。真正让人焦虑的从来不是知道自己不会，
            而是隐隐怀疑「我以为我会的东西可能其实不会」。现在它变成了一份具体的清单。
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="考点总数" value={map.total} hint={`来自 ${syllabus.postCount} 篇面经`} />
        <Stat label="已覆盖" value={map.covered} hint="自评会或实测确认" />
        <Stat
          label="自评与实测的落差"
          value={map.gapCount}
          hint={map.gapCount > 0 ? '你以为会、但答不出新东西' : '尚未做追问验证'}
          emphasize={map.gapCount > 0}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold">
            {syllabus.company} · {syllabus.role} 准备度地图
          </h2>
          <div className="flex flex-wrap gap-2.5">
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <span key={key} className="flex items-center gap-1 text-[11px] text-slate-500">
                <span className={`h-2.5 w-2.5 rounded-sm ${meta.legend}`} />
                {meta.label}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {byCategory.map(([category, cells]) => (
            <div key={category} className="flex flex-wrap items-center gap-2">
              <span className="w-20 shrink-0 text-xs text-slate-500">{category}</span>
              <div className="flex flex-wrap gap-1.5">
                {cells.map((cell) => (
                  <span
                    key={cell.topicId}
                    title={`${cell.title} · ${STATUS_META[cell.status].label}`}
                    className={`h-7 w-7 rounded-md ${STATUS_META[cell.status].cell}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {claimed.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold">验证一下你说会的考点</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            自评会不等于真的会。每个考点最多追问三轮，只看你能不能持续给出新的具体事实，
            不评价你答得好不好。
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
            <ul className="mt-3 space-y-1.5">
              {claimed.map((topic) => (
                <li
                  key={topic.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{topic.title}</span>
                  <button
                    type="button"
                    onClick={() => setProbingTopic(topic)}
                    className="shrink-0 rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 transition hover:border-slate-500"
                  >
                    验证
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {map.nextThree.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold">接下来只做这三件事</h2>
          <p className="mt-1 text-xs text-slate-400">
            按考点权重乘以你的缺口排序。不给完整清单，长清单只会加重压力。
          </p>
          <ol className="mt-3 space-y-2">
            {map.nextThree.map((action, i) => (
              <li key={action.topicId} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">{action.title}</p>
                  <p className="text-xs text-slate-500">{action.reason}</p>
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
    <div className="mt-3 rounded-lg border border-slate-300 bg-slate-50 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium">{topic.title}</p>
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 text-xs text-slate-400 hover:text-slate-700"
        >
          退出
        </button>
      </div>

      {turns.map((turn, i) => (
        <div key={i} className="mt-3 space-y-1 border-l-2 border-slate-200 pl-3">
          <p className="text-xs text-slate-500">面试官：{turn.question}</p>
          <p className="text-xs text-slate-700">你：{turn.answer}</p>
          <p className="text-[11px] text-emerald-600">{turn.judgement}</p>
        </div>
      ))}

      {!question && !loading && (
        <button
          type="button"
          onClick={start}
          className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          开始追问
        </button>
      )}

      {question && (
        <div className="mt-3 space-y-2">
          <p className="text-sm">
            <span className="text-slate-400">第 {turns.length + 1} 轮 · 面试官：</span>
            {question}
          </p>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="说说看。想不起来就直说，这里不会有人评价你"
            className="h-24 w-full resize-none rounded-lg border border-slate-300 bg-white p-2.5 text-sm outline-none focus:border-slate-500"
          />
          <button
            type="button"
            onClick={submit}
            disabled={loading || !answer.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
          >
            {loading ? '判定中' : '提交'}
          </button>
        </div>
      )}

      {loading && !question && <p className="mt-3 text-xs text-slate-400">正在准备问题</p>}

      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
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
      className={`rounded-xl border p-4 ${
        emphasize ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
      }`}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}
