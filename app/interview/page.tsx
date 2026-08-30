'use client';

import { useMemo, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import sample from '@/lib/interview-sample.json';
import { CoverageRing, JourneyBar, Meter, StackedMeter } from '@/app/components/ProgressViz';
import type {
  AttackPoint,
  AttackSource,
  InterviewPlan,
  ProbeTurn,
  ResumeInterviewSession,
} from '@/lib/types';

type Phase = 'input' | 'plan' | 'live' | 'done';

const JOURNEY = [
  { id: 'input', label: '上传材料' },
  { id: 'plan', label: '攻击计划' },
  { id: 'live', label: '深挖追问' },
  { id: 'done', label: '复盘' },
];

const SOURCE_META: Record<AttackSource, { label: string; tone: string }> = {
  resume_match: {
    label: 'JD × 简历重合',
    tone: 'bg-[rgba(31,107,74,0.12)] text-[var(--ok)]',
  },
  resume_risk: {
    label: '简历风险点',
    tone: 'bg-[rgba(161,98,7,0.12)] text-[var(--warn)]',
  },
  jd_gap: {
    label: 'JD 有要求 · 简历弱',
    tone: 'bg-[rgba(159,45,58,0.1)] text-[var(--danger)]',
  },
};

async function parseUpload(file: File): Promise<string> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch('/api/interview/parse', { method: 'POST', body });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? '解析失败');
  if (typeof data.text !== 'string' || !data.text.trim()) {
    throw new Error('解析结果为空');
  }
  return data.text as string;
}

export default function InterviewPage() {
  const [resume, setResume] = useState('');
  const [jd, setJd] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [plan, setPlan] = useState<InterviewPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState<'resume' | 'jd' | null>(null);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [sessions, setSessions] = useState<Record<string, ResumeInterviewSession>>({});

  const activePoint = plan?.points[activeIndex] ?? null;

  const summary = useMemo(() => {
    const list = Object.values(sessions);
    return {
      verified: list.filter((s) => s.outcome === 'verified').length,
      collapsed: list.filter((s) => s.outcome === 'collapsed').length,
      done: list.length,
      total: plan?.points.length ?? 0,
    };
  }, [sessions, plan]);

  async function onFile(which: 'resume' | 'jd', e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(which);
    setError('');
    try {
      const text = await parseUpload(file);
      if (which === 'resume') setResume(text);
      else setJd(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取文件失败');
    } finally {
      setParsing(null);
      e.target.value = '';
    }
  }

  async function buildPlan() {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/interview/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume, jd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? '生成失败');
      setPlan(data.plan as InterviewPlan);
      setSessions({});
      setActiveIndex(0);
      setPhase('plan');
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setLoading(false);
    }
  }

  function finishPoint(session: ResumeInterviewSession) {
    const nextSessions = { ...sessions, [session.pointId]: session };
    setSessions(nextSessions);
    if (!plan) return;
    const nextIdx = plan.points.findIndex(
      (p, i) => i > activeIndex && !nextSessions[p.id],
    );
    if (nextIdx === -1) {
      const anyLeft = plan.points.findIndex((p) => !nextSessions[p.id]);
      if (anyLeft === -1) setPhase('done');
      else setActiveIndex(anyLeft);
    } else {
      setActiveIndex(nextIdx);
    }
  }

  return (
    <main className="min-h-dvh bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[var(--paper-lift)]/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4">
          <Link href="/" className="font-brand text-xl tracking-tight">
            AI面试官
          </Link>
          <nav className="flex items-center gap-4 text-sm text-[var(--muted)]">
            <span className="text-[var(--ink)]">简历面试</span>
            <Link href="/prepare" className="transition hover:text-[var(--ink)]">
              面经准备
            </Link>
            <Link href="/analyze" className="transition hover:text-[var(--ink)]">
              面经甄别
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-5 py-8">
        <div className="surface mb-8 rounded-lg px-4 py-4 sm:px-6">
          <JourneyBar steps={JOURNEY} current={phase} />
        </div>

        {phase === 'input' && (
          <InputPhase
            resume={resume}
            jd={jd}
            loading={loading}
            parsing={parsing}
            error={error}
            onResume={setResume}
            onJd={setJd}
            onFile={onFile}
            onSample={() => {
              setResume(sample.resume);
              setJd(sample.jd);
              setError('');
            }}
            onSubmit={buildPlan}
          />
        )}

        {phase === 'plan' && plan && (
          <PlanPhase
            plan={plan}
            onBack={() => setPhase('input')}
            onStart={() => setPhase('live')}
          />
        )}

        {phase === 'live' && plan && activePoint && (
          <LivePhase
            plan={plan}
            point={activePoint}
            index={activeIndex}
            resume={resume}
            jd={jd}
            sessions={sessions}
            onSelect={setActiveIndex}
            onFinishPoint={finishPoint}
            onDone={() => setPhase('done')}
          />
        )}

        {phase === 'done' && plan && (
          <DonePhase
            plan={plan}
            sessions={sessions}
            summary={summary}
            onRestart={() => {
              setPhase('input');
              setPlan(null);
              setSessions({});
            }}
            onContinue={() => {
              const left = plan.points.findIndex((p) => !sessions[p.id]);
              if (left >= 0) {
                setActiveIndex(left);
                setPhase('live');
              }
            }}
          />
        )}
      </div>
    </main>
  );
}

function InputPhase({
  resume,
  jd,
  loading,
  parsing,
  error,
  onResume,
  onJd,
  onFile,
  onSample,
  onSubmit,
}: {
  resume: string;
  jd: string;
  loading: boolean;
  parsing: 'resume' | 'jd' | null;
  error: string;
  onResume: (v: string) => void;
  onJd: (v: string) => void;
  onFile: (which: 'resume' | 'jd', e: ChangeEvent<HTMLInputElement>) => void;
  onSample: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-8">
      <div className="max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-[var(--accent)]">RESUME × JD</p>
        <h1 className="font-brand mt-2 text-3xl leading-tight sm:text-4xl">
          上传简历和岗位 JD
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
          支持 PDF、Word（.docx）、TXT、MD，上传后自动抽出正文。也可直接粘贴。
          AI 面试官会对照两者找出重合点、泡沫点和缺口点，再一路往下追。
        </p>
        <button
          type="button"
          onClick={onSample}
          className="btn-ghost mt-4 rounded-md px-3 py-1.5 text-xs"
        >
          填入示例简历与 JD
        </button>
      </div>

      <div className="surface grid gap-5 rounded-lg p-4 sm:grid-cols-2">
        <Meter
          label="简历完整度"
          value={Math.min(resume.trim().length, 80)}
          max={80}
          hint={resume.trim().length >= 80 ? '够用了，可以出题' : '再补一点项目或实习细节'}
          tone={resume.trim().length >= 80 ? 'ok' : 'accent'}
        />
        <Meter
          label="JD 完整度"
          value={Math.min(jd.trim().length, 40)}
          max={40}
          hint={jd.trim().length >= 40 ? '岗位要求已经能对照' : '把职位要求也贴进来'}
          tone={jd.trim().length >= 40 ? 'ok' : 'accent'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TextBlock
          label="你的简历"
          value={resume}
          parsing={parsing === 'resume'}
          onChange={onResume}
          onFile={(e) => onFile('resume', e)}
          placeholder="粘贴简历，或上传 PDF / DOCX / TXT"
        />
        <TextBlock
          label="目标岗位 JD"
          value={jd}
          parsing={parsing === 'jd'}
          onChange={onJd}
          onFile={(e) => onFile('jd', e)}
          placeholder="粘贴岗位 JD，或上传 PDF / DOCX / TXT"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={
            loading ||
            !!parsing ||
            resume.trim().length < 80 ||
            jd.trim().length < 40
          }
          className="btn-primary rounded-md px-5 py-2.5 text-sm font-medium"
        >
          {loading ? '正在对照简历与 JD 出题…' : '生成面试攻击计划'}
        </button>
        <span className="text-xs text-[var(--muted)]">
          简历 {resume.length} 字 · JD {jd.length} 字
        </span>
      </div>

      {error && (
        <p className="rounded-md border border-[rgba(159,45,58,0.25)] bg-[rgba(159,45,58,0.08)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  );
}

function TextBlock({
  label,
  value,
  parsing,
  onChange,
  onFile,
  placeholder,
}: {
  label: string;
  value: string;
  parsing: boolean;
  onChange: (v: string) => void;
  onFile: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">{label}</h2>
        <label
          className={`cursor-pointer text-xs ${
            parsing ? 'text-[var(--muted)]' : 'text-[var(--accent)] hover:underline'
          }`}
        >
          {parsing ? '正在解析…' : '上传 PDF / Word'}
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md,.markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="hidden"
            disabled={parsing}
            onChange={onFile}
          />
        </label>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="field h-72 w-full resize-none rounded-lg p-3.5 text-sm leading-relaxed"
      />
    </div>
  );
}

function PlanPhase({
  plan,
  onBack,
  onStart,
}: {
  plan: InterviewPlan;
  onBack: () => void;
  onStart: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-[var(--accent)]">ATTACK PLAN</p>
        <h1 className="font-brand mt-2 text-3xl leading-tight">
          {plan.companyGuess ? `${plan.companyGuess} · ` : ''}
          {plan.roleGuess}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{plan.opening}</p>
      </div>

      <div className="surface rounded-lg p-4">
        <Meter
          label="今天要深挖的攻击点"
          value={0}
          max={plan.points.length}
          hint={`一共 ${plan.points.length} 个点，范围是有限的。问完就停，不会无限加压。`}
        />
      </div>

      <ol className="space-y-3">
        {plan.points.map((point, i) => (
          <li key={point.id} className="surface rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-brand text-lg text-[var(--muted)]">{i + 1}</span>
              <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${SOURCE_META[point.source].tone}`}>
                {SOURCE_META[point.source].label}
              </span>
              <h3 className="text-sm font-semibold">{point.title}</h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{point.reason}</p>
            {(point.resumeQuote || point.jdRequirement) && (
              <div className="mt-3 space-y-1.5 border-l-2 border-[var(--accent)]/35 pl-3">
                {point.resumeQuote && (
                  <p className="text-xs leading-relaxed text-[var(--ink)]">
                    <span className="text-[var(--muted)]">简历：</span>
                    {point.resumeQuote}
                  </p>
                )}
                {point.jdRequirement && (
                  <p className="text-xs leading-relaxed text-[var(--ink)]">
                    <span className="text-[var(--muted)]">JD：</span>
                    {point.jdRequirement}
                  </p>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onStart} className="btn-primary rounded-md px-5 py-2.5 text-sm font-medium">
          开始面试
        </button>
        <button type="button" onClick={onBack} className="btn-ghost rounded-md px-4 py-2.5 text-sm">
          返回修改
        </button>
      </div>
    </div>
  );
}

function LivePhase({
  plan,
  point,
  index,
  resume,
  jd,
  sessions,
  onSelect,
  onFinishPoint,
  onDone,
}: {
  plan: InterviewPlan;
  point: AttackPoint;
  index: number;
  resume: string;
  jd: string;
  sessions: Record<string, ResumeInterviewSession>;
  onSelect: (i: number) => void;
  onFinishPoint: (session: ResumeInterviewSession) => void;
  onDone: () => void;
}) {
  const allDone = plan.points.every((p) => sessions[p.id]);
  const done = Object.keys(sessions).length;
  const verified = Object.values(sessions).filter((s) => s.outcome === 'verified').length;
  const left = plan.points.length - done;

  return (
    <div className="space-y-6">
      <div className="surface flex flex-wrap items-center justify-between gap-5 rounded-lg p-4">
        <CoverageRing
          value={done}
          max={plan.points.length}
          label="已走完"
          caption={
            left > 0
              ? `还剩 ${left} 个攻击点。范围有限，走完就是今天的全部。`
              : '全部攻击点都问过了。'
          }
          tone={done === plan.points.length ? 'ok' : 'accent'}
        />
        <div className="min-w-[200px] flex-1">
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

    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-2">
        <p className="text-xs tracking-[0.16em] text-[var(--muted)]">攻击点</p>
        {plan.points.map((p, i) => {
          const done = sessions[p.id];
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
              {done && (
                <span
                  className={`mt-1 block ${
                    i === index ? 'text-white/70' : done.outcome === 'verified' ? 'text-[var(--ok)]' : 'text-[var(--warn)]'
                  }`}
                >
                  {done.outcome === 'verified' ? '经得起追问' : '经不起追问'}
                </span>
              )}
            </button>
          );
        })}
        {allDone && (
          <button
            type="button"
            onClick={onDone}
            className="btn-primary mt-3 w-full rounded-md px-3 py-2 text-xs"
          >
            查看总结
          </button>
        )}
      </aside>

      <section>
        {sessions[point.id] ? (
          <div className="surface rounded-lg p-5">
            <p className="text-xs tracking-[0.16em] text-[var(--accent)]">已完成</p>
            <h2 className="font-brand mt-2 text-2xl">{point.title}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              结果：
              {sessions[point.id].outcome === 'verified' ? '经得起追问' : '经不起追问'}
            </p>
            <div className="mt-4 space-y-3">
              {sessions[point.id].turns.map((t, i) => (
                <div key={i} className="border-l-2 border-[var(--line)] pl-3">
                  <p className="text-xs text-[var(--muted)]">面试官：{t.question}</p>
                  <p className="mt-1 text-xs">你：{t.answer}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <PointProbe
            key={point.id}
            point={point}
            index={index}
            resume={resume}
            jd={jd}
            onFinish={onFinishPoint}
          />
        )}
      </section>
    </div>
    </div>
  );
}

function PointProbe({
  point,
  index,
  resume,
  jd,
  onFinish,
}: {
  point: AttackPoint;
  index: number;
  resume: string;
  jd: string;
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
      body: JSON.stringify({ resume, jd, point, turns: history }),
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
        </div>
      )}

      {loading && !question && <p className="mt-4 text-xs text-[var(--muted)]">正在出题…</p>}
      {error && <p className="mt-3 text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}

function DonePhase({
  plan,
  sessions,
  summary,
  onRestart,
  onContinue,
}: {
  plan: InterviewPlan;
  sessions: Record<string, ResumeInterviewSession>;
  summary: { verified: number; collapsed: number; done: number; total: number };
  onRestart: () => void;
  onContinue: () => void;
}) {
  const incomplete = summary.done < summary.total;

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-[var(--accent)]">DEBRIEF</p>
        <h1 className="font-brand mt-2 text-3xl leading-tight">面试复盘</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          {summary.collapsed > 0
            ? `你在 ${summary.done} 个攻击点里，有 ${summary.collapsed} 个经不起继续追问。这不是打击，是清单。`
            : summary.verified > 0
              ? `已验证的 ${summary.verified} 个点都撑住了追问。继续保持用事实说话。`
              : '还没有完成任何攻击点。'}
        </p>
      </div>

      <div className="surface flex flex-wrap items-center gap-6 rounded-lg p-5">
        <CoverageRing
          value={summary.done}
          max={summary.total}
          label="走完"
          caption="不确定变成了具体数字：问了多少、撑住多少、崩在哪一轮。"
          tone={summary.done === summary.total && summary.total > 0 ? 'ok' : 'accent'}
        />
        <div className="min-w-[220px] flex-1">
          <StackedMeter
            label="结果构成"
            segments={[
              { value: summary.verified, tone: 'ok', title: '经得起' },
              { value: summary.collapsed, tone: 'warn', title: '经不起' },
              { value: Math.max(0, summary.total - summary.done), tone: 'muted', title: '未问' },
            ]}
            hint="绿色不是分数，是「说出了新的具体事实」。"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="已完成" value={`${summary.done}/${summary.total}`} />
        <Stat label="经得起追问" value={String(summary.verified)} ok />
        <Stat label="经不起追问" value={String(summary.collapsed)} warn={summary.collapsed > 0} />
      </div>

      <ul className="space-y-2">
        {plan.points.map((p) => {
          const s = sessions[p.id];
          return (
            <li key={p.id} className="surface flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3">
              <div>
                <p className="text-sm font-medium">{p.title}</p>
                <p className="text-xs text-[var(--muted)]">{SOURCE_META[p.source].label}</p>
              </div>
              <span
                className={`text-xs ${
                  !s
                    ? 'text-[var(--muted)]'
                    : s.outcome === 'verified'
                      ? 'text-[var(--ok)]'
                      : 'text-[var(--warn)]'
                }`}
              >
                {!s ? '未开始' : s.outcome === 'verified' ? '经得起追问' : `第 ${s.collapsedAtTurn} 轮崩掉`}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-3">
        {incomplete && (
          <button type="button" onClick={onContinue} className="btn-primary rounded-md px-5 py-2.5 text-sm">
            继续未完成的题
          </button>
        )}
        <button type="button" onClick={onRestart} className="btn-ghost rounded-md px-4 py-2.5 text-sm">
          换一份简历 / JD
        </button>
        <Link href="/prepare" className="btn-ghost rounded-md px-4 py-2.5 text-sm">
          去用面经建考纲
        </Link>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  ok,
  warn,
}: {
  label: string;
  value: string;
  ok?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-5 ${
        warn
          ? 'border-[rgba(161,98,7,0.3)] bg-[rgba(161,98,7,0.08)]'
          : ok
            ? 'border-[rgba(31,107,74,0.25)] bg-[rgba(31,107,74,0.08)]'
            : 'surface'
      }`}
    >
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p
        className={`font-brand mt-1.5 text-3xl tabular-nums ${
          warn ? 'text-[var(--warn)]' : ok ? 'text-[var(--ok)]' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}
