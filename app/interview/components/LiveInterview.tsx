'use client';

import { useState } from 'react';
import { CoverageRing, Meter } from '@/app/components/ProgressViz';
import { scoreLabel, scoreSession } from '@/lib/progress';
import type {
  AttackPoint,
  InterviewPlan,
  IntelligenceItem,
  ProbeTurn,
  ReferenceAnswer as ReferenceAnswerData,
  ResumeInterviewSession,
} from '@/lib/types';
import { ResumeSheet, SOURCE_META } from './shared';

function ReferenceAnswerBlock({
  point,
  resume,
  jd,
  intel,
  question,
  turns,
  preset,
}: {
  point: AttackPoint;
  resume: string;
  jd: string;
  intel: IntelligenceItem[];
  question?: string;
  turns?: Array<{ question: string; answer: string }>;
  preset?: ReferenceAnswerData;
}) {
  const topicKey = `${point.id}::${question ?? ''}::${preset?.sample ?? ''}`;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReferenceAnswerData | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');

  if (loadedKey !== topicKey && (data || open || error)) {
    setLoadedKey(topicKey);
    setData(null);
    setOpen(false);
    setError('');
    setLoading(false);
  }

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (preset) {
      setData(preset);
      setLoadedKey(topicKey);
      return;
    }
    if (data && loadedKey === topicKey) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/interview/reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume, jd, intelligence: intel, point, question, turns }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? '生成失败');
      setData(json.reference as ReferenceAnswerData);
      setLoadedKey(topicKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成参考答案失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2f6df0] transition hover:underline"
      >
        <span className="text-sm leading-none">{open ? '▾' : '▸'}</span>
        想不起来？看参考答案
      </button>

      {open && (
        <div className="mt-2 rounded-md border border-[#2f6df0]/25 bg-[rgba(37,99,235,0.05)] p-3.5">
          {loading && <p className="text-xs text-[var(--muted)]">正在整理面试官想听到的要点…</p>}
          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
          {data && (
            <div className="space-y-3">
              {data.points.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[#2f6df0]">采分点</p>
                  <ul className="mt-1.5 space-y-1">
                    {data.points.map((p, i) => (
                      <li key={i} className="flex gap-2 text-xs leading-relaxed text-[var(--ink)]">
                        <span className="text-[#2f6df0]">{i + 1}.</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.sample && (
                <div>
                  <p className="text-xs font-medium text-[#2f6df0]">范例表述</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink)]">{data.sample}</p>
                </div>
              )}
              {data.pitfalls && data.pitfalls.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[var(--warn)]">容易答歪</p>
                  <ul className="mt-1.5 space-y-1">
                    {data.pitfalls.map((p, i) => (
                      <li key={i} className="flex gap-2 text-xs leading-relaxed text-[var(--muted)]">
                        <span className="text-[var(--warn)]">·</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="border-t border-dashed border-[#2f6df0]/20 pt-2 text-[11px] text-[var(--muted)]">
                参考结构用，别照背——面试要用你自己的项目和数字把它填实，才经得起继续追问。
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function LivePhase({
  plan,
  point,
  index,
  resume,
  jd,
  intel,
  sessions,
  presetRefs,
  onSelect,
  onFinishPoint,
  onDone,
}: {
  plan: InterviewPlan;
  point: AttackPoint;
  index: number;
  resume: string;
  jd: string;
  intel: IntelligenceItem[];
  sessions: Record<string, ResumeInterviewSession>;
  presetRefs?: Record<string, ReferenceAnswerData>;
  onSelect: (i: number) => void;
  onFinishPoint: (session: ResumeInterviewSession) => void;
  onDone: () => void;
}) {
  const allDone = plan.points.every((p) => sessions[p.id]);
  const done = Object.keys(sessions).length;
  const verified = Object.values(sessions).filter((s) => s.outcome === 'verified').length;
  const left = plan.points.length - done;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-3 lg:sticky lg:top-4">
        <div className="surface rounded-lg p-4">
          <p className="text-xs tracking-[0.16em] text-[var(--muted)]">训练进度</p>
          <div className="mt-3">
            <CoverageRing
              value={done}
              max={plan.points.length}
              label="已走完"
              caption={
                left > 0
                  ? `还剩 ${left} 个追问点。`
                  : '全部追问点都问过了。'
              }
              tone={done === plan.points.length ? 'ok' : 'accent'}
            />
          </div>
          <div className="mt-4">
            <Meter
              label={`当前第 ${index + 1} 题 · 共 ${plan.points.length} 题`}
              value={done}
              max={plan.points.length}
              hint={
                verified > 0
                  ? `其中 ${verified} 个经得起追问`
                  : '每答完一题，这根条就会往前走一截。'
              }
            />
          </div>
        </div>

        <div className="surface rounded-lg p-3">
          <p className="px-1 text-xs tracking-[0.16em] text-[var(--muted)]">追问点</p>
          <div className="mt-2 space-y-1.5">
            {plan.points.map((p, i) => {
              const doneSession = sessions[p.id];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelect(i)}
                  className={`block w-full rounded-md border px-3 py-2 text-left text-xs transition ${
                    i === index
                      ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]'
                      : 'border-[var(--line)] bg-white text-[var(--ink)] hover:border-black/25'
                  }`}
                >
                  <span className="line-clamp-2">{p.title}</span>
                  {doneSession && (
                    <span
                      className={`mt-1 block ${
                        i === index
                          ? 'text-white/70'
                          : doneSession.outcome === 'verified'
                            ? 'text-[var(--ok)]'
                            : 'text-[var(--warn)]'
                      }`}
                    >
                      {doneSession.outcome === 'verified' ? '经得起追问' : '经不起追问'}
                      {' · '}
                      {scoreSession(doneSession)} 分
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {allDone && (
            <button
              type="button"
              onClick={onDone}
              className="btn-primary mt-3 w-full rounded-md px-3 py-2 text-xs"
            >
              查看总结
            </button>
          )}
        </div>

        <ResumeSheet resume={resume} jd={jd} />
      </aside>

      <section>
        {sessions[point.id] ? (
          <div className="surface rounded-lg p-5">
            <p className="text-xs tracking-[0.16em] text-[var(--accent)]">已完成</p>
            <h2 className="font-brand mt-2 text-2xl">{point.title}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              结果：
              {sessions[point.id].outcome === 'verified' ? '经得起追问' : '经不起追问'}
              {' · '}
              {scoreSession(sessions[point.id])} 分
              （{scoreLabel(scoreSession(sessions[point.id])).text}）
            </p>
            <div className="mt-4 space-y-3">
              {sessions[point.id].turns.map((t, i) => (
                <div key={i} className="border-l-2 border-[var(--line)] pl-3">
                  <p className="text-xs text-[var(--muted)]">面试官：{t.question}</p>
                  <p className="mt-1 text-xs">你：{t.answer}</p>
                </div>
              ))}
            </div>
            <ReferenceAnswerBlock
              key={point.id}
              point={point}
              resume={resume}
              jd={jd}
              intel={intel}
              question={sessions[point.id].turns.at(-1)?.question}
              turns={sessions[point.id].turns.map((t) => ({
                question: t.question,
                answer: t.answer,
              }))}
              preset={presetRefs?.[point.id]}
            />
          </div>
        ) : (
          <PointProbe
            key={point.id}
            point={point}
            index={index}
            resume={resume}
            jd={jd}
            intel={intel}
            onFinish={onFinishPoint}
          />
        )}
      </section>
    </div>
  );
}

function PointProbe({
  point,
  index,
  resume,
  jd,
  intel,
  onFinish,
}: {
  point: AttackPoint;
  index: number;
  resume: string;
  jd: string;
  intel: IntelligenceItem[];
  onFinish: (session: ResumeInterviewSession) => void;
}) {
  const [turns, setTurns] = useState<ProbeTurn[]>([]);
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function callStep(history: Array<{ question: string; answer: string }>) {
    const res = await fetch('/api/interview/step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume, jd, point, turns: history, intelligence: intel }),
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
      const data = await callStep([]);
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
      const data = await callStep(history);
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
          pointId: point.id,
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
    <div className="rounded-lg border border-[var(--accent)]/30 bg-[rgba(31,122,102,0.05)] p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs tracking-[0.16em] text-[var(--accent)]">
          第 {index + 1} 题 · AI 面试官
        </span>
        <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${SOURCE_META[point.source].tone}`}>
          {SOURCE_META[point.source].label}
        </span>
      </div>
      <h2 className="font-brand mt-2 text-2xl">{point.title}</h2>
      <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{point.reason}</p>
      <div className="mt-4">
        <Meter
          label="本题追问轮次"
          value={turns.length}
          max={2}
          hint={
            turns.length === 0
              ? '最多两轮。撑住就过，说不出新事实就停。'
              : `已完成 ${turns.length} 轮，还剩 ${Math.max(0, 2 - turns.length)} 轮。`
          }
        />
      </div>

      {turns.map((turn, i) => (
        <div key={i} className="mt-4 space-y-1 border-l-2 border-[var(--accent)]/35 pl-3">
          <p className="text-xs text-[var(--muted)]">面试官：{turn.question}</p>
          <p className="text-xs">你：{turn.answer}</p>
          <p className="text-[11px] text-[var(--ok)]">{turn.judgement}</p>
        </div>
      ))}

      {!question && !loading && (
        <button
          type="button"
          onClick={start}
          className="btn-primary mt-5 rounded-md px-4 py-2 text-sm font-medium"
        >
          开始这一题
        </button>
      )}

      {question && (
        <div className="mt-5 space-y-2">
          <p className="text-sm leading-relaxed">
            <span className="text-[var(--muted)]">第 {turns.length + 1} 轮 · 面试官：</span>
            {question}
          </p>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="用你自己做过的事实回答。想不起来就直说。"
            className="field h-28 w-full resize-none rounded-md p-3 text-sm"
          />
          <button
            type="button"
            onClick={submit}
            disabled={loading || !answer.trim()}
            className="btn-primary rounded-md px-4 py-2 text-sm font-medium"
          >
            {loading ? '判定中' : '提交'}
          </button>
          <ReferenceAnswerBlock
            key={`${point.id}-${question}`}
            point={point}
            resume={resume}
            jd={jd}
            intel={intel}
            question={question}
            turns={turns.map((t) => ({ question: t.question, answer: t.answer }))}
          />
        </div>
      )}

      {loading && !question && <p className="mt-4 text-xs text-[var(--muted)]">正在出题…</p>}
      {error && <p className="mt-3 text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}
