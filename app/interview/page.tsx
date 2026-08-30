'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import sample from '@/lib/interview-sample.json';
import {
  demoResume,
  demoJd,
  demoIntel,
  demoPlan,
  demoSessions,
  demoReference,
  demoEdits,
} from '@/lib/interview-demo';
import { CoverageRing, JourneyBar, Meter, StackedMeter } from '@/app/components/ProgressViz';
import type {
  AttackPoint,
  AttackSource,
  InterviewPlan,
  IntelligenceItem,
  IntelSource,
  IntelTrust,
  ProbeTurn,
  ReferenceAnswer as ReferenceAnswerData,
  ResumeEdit,
  ResumeInterviewSession,
  Verdict,
} from '@/lib/types';

type Phase = 'input' | 'plan' | 'live' | 'done';

const JOURNEY = [
  { id: 'input', label: '改简历' },
  { id: 'plan', label: '面试提纲' },
  { id: 'live', label: '模拟面试' },
  { id: 'done', label: '复盘' },
];

const SOURCE_META: Record<AttackSource, { label: string; tone: string }> = {
  intel_hit: {
    label: '情报命中 · 该组考过',
    tone: 'bg-[rgba(37,99,235,0.12)] text-[#2f6df0]',
  },
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
  const [intel, setIntel] = useState<IntelligenceItem[]>([]);
  const [demo, setDemo] = useState(false);

  function loadDemo() {
    setResume(demoResume);
    setJd(demoJd);
    setIntel(demoIntel);
    setPlan(demoPlan);
    setSessions(demoSessions);
    setActiveIndex(0);
    setError('');
    setDemo(true);
    setPhase('input');
  }

  function resetAll() {
    setResume('');
    setJd('');
    setIntel([]);
    setPlan(null);
    setSessions({});
    setActiveIndex(0);
    setError('');
    setDemo(false);
    setPhase('input');
  }

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

  async function importFile(which: 'resume' | 'jd', file: File) {
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
        body: JSON.stringify({ resume, jd, intelligence: intel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? '生成失败');
      setPlan(data.plan as InterviewPlan);
      setSessions({});
      setActiveIndex(0);
      setDemo(false);
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
          <p className="text-sm text-[var(--muted)]">改简历 · 模拟面试</p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-5 py-8">
        <div className="surface mb-8 rounded-lg px-4 py-4 sm:px-6">
          <JourneyBar steps={JOURNEY} current={phase} />
        </div>

        {demo && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--accent)]/40 bg-[rgba(159,45,58,0.06)] px-4 py-3">
            <p className="text-sm text-[var(--ink)]">
              <span className="font-medium">演示模式</span>
              <span className="text-[var(--muted)]">
                {' '}· 已填入一份电商后端实习简历（秒杀 / 分库分表 / 限流）。先看简历，再开面。
              </span>
            </p>
            <button
              type="button"
              onClick={resetAll}
              className="btn-ghost rounded-md px-3 py-1.5 text-xs"
            >
              退出演示，用我自己的材料 →
            </button>
          </div>
        )}

        {phase === 'input' && (
          <InputPhase
            resume={resume}
            jd={jd}
            intel={intel}
            loading={loading}
            parsing={parsing}
            error={error}
            onResume={setResume}
            onJd={setJd}
            onImport={importFile}
            onIntelChange={setIntel}
            onSample={() => {
              setResume(sample.resume);
              setJd(sample.jd);
              setIntel(demoIntel);
              setError('');
            }}
            onDemo={loadDemo}
            onSubmit={() => {
              if (demo && plan) {
                setPhase('plan');
                return;
              }
              buildPlan();
            }}
            demo={demo}
          />
        )}

        {phase === 'plan' && plan && (
          <PlanPhase
            plan={plan}
            resume={resume}
            jd={jd}
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
            intel={intel}
            sessions={sessions}
            presetRefs={demo ? demoReference : undefined}
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
            resume={resume}
            jd={jd}
            intel={intel}
            demo={demo}
            onApplyResume={setResume}
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
  intel,
  loading,
  parsing,
  error,
  onResume,
  onJd,
  onImport,
  onIntelChange,
  onSample,
  onDemo,
  onSubmit,
  demo,
}: {
  resume: string;
  jd: string;
  intel: IntelligenceItem[];
  loading: boolean;
  parsing: 'resume' | 'jd' | null;
  error: string;
  onResume: (v: string) => void;
  onJd: (v: string) => void;
  onImport: (which: 'resume' | 'jd', file: File) => void;
  onIntelChange: (items: IntelligenceItem[]) => void;
  onSample: () => void;
  onDemo: () => void;
  onSubmit: () => void;
  demo: boolean;
}) {
  const resumeReady = resume.trim().length >= 80;
  const jdReady = jd.trim().length >= 40;
  const canStart = resumeReady && jdReady && !loading && !parsing;

  return (
    <div className="space-y-8">
      <div className="max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-[var(--accent)]">改简历 · 再开面</p>
        <h1 className="font-brand mt-2 text-3xl leading-tight sm:text-4xl">
          先把简历改到能讲清
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
          {demo
            ? '演示已放入一份真实风格的后端实习简历（某 211、电商中台秒杀项目）和对应的字节交易组 JD。你可以先读、先改，再按这份简历开面。'
            : '放进简历和目标岗位 JD。可以先对照着改一版，再开始模拟面试。面经（师兄经验、牛客帖、微信整理）放在下面当辅助，用来校准这组会怎么考。'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onDemo}
            className="btn-primary rounded-md px-4 py-2 text-sm font-medium"
          >
            不想填？先看一遍完整演示 →
          </button>
          <button
            type="button"
            onClick={onSample}
            className="btn-ghost rounded-md px-3 py-2 text-sm"
          >
            填入示例简历和 JD
          </button>
        </div>
      </div>

      <MaterialCard
        key={`resume-${demo ? 'demo' : 'own'}-${resume.trim() ? '1' : '0'}`}
        step="你的简历"
        label="随时改、随时开面"
        value={resume}
        ready={resumeReady}
        minLen={80}
        parsing={parsing === 'resume'}
        onChange={onResume}
        onImport={(file) => onImport('resume', file)}
        pastePlaceholder="粘贴或上传简历。改完的版本会直接用于模拟面试。"
        readyHint="可以开始对照岗位改，或直接开面"
        waitHint="再补一点项目或实习细节"
        defaultMode="paste"
        tall
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <MaterialCard
          key={`jd-${demo ? 'demo' : 'own'}-${jd.trim() ? '1' : '0'}`}
          step="目标岗位"
          label="岗位 JD"
          value={jd}
          ready={jdReady}
          minLen={40}
          parsing={parsing === 'jd'}
          onChange={onJd}
          onImport={(file) => onImport('jd', file)}
          pastePlaceholder="粘贴岗位 JD：职责、任职要求、技术栈"
          readyHint="岗位要求已能对照"
          waitHint="把职位要求也贴进来"
          defaultMode="paste"
        />
        <IntelPanel items={intel} onChange={onIntelChange} />
      </div>

      {resumeReady && jdReady && (
        <ResumeCoach
          resume={resume}
          jd={jd}
          intel={intel}
          demo={demo}
          onApply={onResume}
        />
      )}

      <div className="surface rounded-lg p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">可以开始了吗</h2>
          <span className="text-xs text-[var(--muted)]">
            {[resumeReady, jdReady].filter(Boolean).length}/2
          </span>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          <ReadyRow ok={resumeReady} label="简历" count={resume.trim().length} />
          <ReadyRow ok={jdReady} label="岗位 JD" count={jd.trim().length} />
          <ReadyRow
            ok={intel.length > 0}
            label={`面经辅助（可选，已加 ${intel.length} 条）`}
            count={intel.reduce((n, it) => n + it.content.trim().length, 0)}
            optional
          />
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-4">
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canStart}
            className="btn-primary rounded-md px-5 py-2.5 text-sm font-medium"
          >
            {loading ? '正在按这份简历出题…' : '开始模拟面试 →'}
          </button>
          <span className="text-xs text-[var(--muted)]">
            {canStart
              ? '按当前这份简历开面。面经只用来辅助出题。'
              : '简历和 JD 都放进来之后才能开面'}
          </span>
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-[rgba(159,45,58,0.25)] bg-[rgba(159,45,58,0.08)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  );
}

function ReadyRow({
  ok,
  label,
  count,
  optional = false,
}: {
  ok: boolean;
  label: string;
  count: number;
  optional?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
            ok
              ? 'bg-[var(--accent)] text-[var(--paper)]'
              : optional
                ? 'border border-dashed border-[var(--line)] text-[var(--muted)]'
                : 'border border-[var(--line)] text-[var(--muted)]'
          }`}
        >
          {ok ? '✓' : optional ? '+' : ''}
        </span>
        <span className={ok ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}>{label}</span>
      </span>
      <span className="text-xs text-[var(--muted)]">{count} 字</span>
    </li>
  );
}

const ACCEPT =
  '.pdf,.docx,.txt,.md,.markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

function MaterialCard({
  step,
  label,
  value,
  ready,
  minLen,
  parsing,
  onChange,
  onImport,
  pastePlaceholder,
  readyHint,
  waitHint,
  defaultMode = 'upload',
  tall = false,
}: {
  step: string;
  label: string;
  value: string;
  ready: boolean;
  minLen: number;
  parsing: boolean;
  onChange: (v: string) => void;
  onImport: (file: File) => void;
  pastePlaceholder: string;
  readyHint: string;
  waitHint: string;
  defaultMode?: 'upload' | 'paste';
  tall?: boolean;
}) {
  const [mode, setMode] = useState<'upload' | 'paste'>(defaultMode);
  const [dragOver, setDragOver] = useState(false);
  const box = tall ? 'h-80' : 'h-64';

  return (
    <div className="surface flex flex-col rounded-lg p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] tracking-[0.18em] text-[var(--muted)]">{step}</p>
          <h2 className="text-sm font-medium">{label}</h2>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] ${
            ready
              ? 'bg-[rgba(43,122,74,0.12)] text-[var(--ok,#2b7a4a)]'
              : 'border border-[var(--line)] text-[var(--muted)]'
          }`}
        >
          {ready ? '已就绪' : '待补充'}
        </span>
      </div>

      <div className="mt-3 inline-flex self-start rounded-md border border-[var(--line)] p-0.5 text-xs">
        {(['upload', 'paste'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded px-3 py-1 transition ${
              mode === m
                ? 'bg-[var(--accent)] text-[var(--paper)]'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {m === 'upload' ? '上传文件' : '粘贴文本'}
          </button>
        ))}
      </div>

      <div className="mt-3 flex-1">
        {mode === 'upload' ? (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) onImport(file);
            }}
            className={`flex ${box} cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition ${
              dragOver
                ? 'border-[var(--accent)] bg-[rgba(159,45,58,0.05)]'
                : 'border-[var(--line)] hover:border-[var(--accent)]'
            }`}
          >
            <input
              type="file"
              accept={ACCEPT}
              className="hidden"
              disabled={parsing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImport(file);
                e.target.value = '';
              }}
            />
            {parsing ? (
              <span className="text-sm text-[var(--muted)]">正在解析文件…</span>
            ) : value.trim() ? (
              <>
                <span className="text-sm text-[var(--ink)]">已导入 {value.trim().length} 字</span>
                <span className="mt-1 text-xs text-[var(--muted)]">
                  点击重新上传，或切到「粘贴文本」查看/编辑
                </span>
              </>
            ) : (
              <>
                <span className="text-sm text-[var(--ink)]">拖拽文件到这里，或点击选择</span>
                <span className="mt-1 text-xs text-[var(--muted)]">
                  PDF · Word · TXT · Markdown
                </span>
              </>
            )}
          </label>
        ) : (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={pastePlaceholder}
            className={`field ${box} w-full resize-none rounded-lg p-3.5 text-sm leading-relaxed`}
          />
        )}
      </div>

      <p className="mt-3 text-xs text-[var(--muted)]">
        {ready
          ? readyHint
          : `${waitHint}（还差约 ${Math.max(minLen - value.trim().length, 0)} 字）`}
      </p>
    </div>
  );
}

const INTEL_SOURCE_META: Record<IntelSource, { label: string; tone: string }> = {
  paste: { label: '整理/粘贴', tone: 'bg-[rgba(37,99,235,0.1)] text-[#2f6df0]' },
  file: { label: '文件', tone: 'bg-[rgba(31,107,74,0.12)] text-[var(--ok)]' },
  url: { label: '链接', tone: 'bg-[rgba(161,98,7,0.12)] text-[var(--warn)]' },
  web: { label: '自动检索', tone: 'bg-[rgba(120,120,120,0.14)] text-[var(--muted)]' },
};

const TRUST_OPTIONS: { value: IntelTrust; label: string }[] = [
  { value: 'high', label: '一手可信（师兄/内部）' },
  { value: 'medium', label: '公开面经' },
  { value: 'low', label: '存疑/可能含广告' },
];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function IntelPanel({
  items,
  onChange,
}: {
  items: IntelligenceItem[];
  onChange: (items: IntelligenceItem[]) => void;
}) {
  const [mode, setMode] = useState<'paste' | 'url' | 'file'>('paste');
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');
  const [trust, setTrust] = useState<IntelTrust>('high');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [screens, setScreens] = useState<Record<string, { verdict: Verdict; headline: string }>>(
    {},
  );
  const [screeningId, setScreeningId] = useState<string | null>(null);

  function add(item: IntelligenceItem) {
    onChange([...items, item]);
  }
  function remove(id: string) {
    onChange(items.filter((it) => it.id !== id));
  }
  function updateTrust(id: string, t: IntelTrust) {
    onChange(items.map((it) => (it.id === id ? { ...it, trust: t } : it)));
  }

  function addPaste() {
    if (text.trim().length < 10) {
      setNote('内容太短，至少写一句有用的情报');
      return;
    }
    add({
      id: uid(),
      source: 'paste',
      label: label.trim() || '手动整理',
      content: text.trim(),
      trust,
    });
    setLabel('');
    setText('');
    setNote('');
  }

  async function addFile(file: File) {
    setBusy(true);
    setNote('');
    try {
      const content = await parseUpload(file);
      add({
        id: uid(),
        source: 'file',
        label: label.trim() || file.name,
        content,
        trust,
      });
      setLabel('');
    } catch (e) {
      setNote(e instanceof Error ? e.message : '文件解析失败');
    } finally {
      setBusy(false);
    }
  }

  async function screenItem(item: IntelligenceItem) {
    setScreeningId(item.id);
    setNote('');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: item.content, title: item.label }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? '甄别失败');
      const verdict = data.analysis?.verdict as Verdict;
      const headline = data.analysis?.headline as string;
      setScreens((prev) => ({ ...prev, [item.id]: { verdict, headline } }));
      const nextTrust: IntelTrust =
        verdict === 'promotional' ? 'low' : verdict === 'trustworthy' ? 'high' : 'medium';
      onChange(items.map((it) => (it.id === item.id ? { ...it, trust: nextTrust } : it)));
    } catch (e) {
      setNote(e instanceof Error ? e.message : '甄别失败');
    } finally {
      setScreeningId(null);
    }
  }

  async function addUrl() {
    if (!url.trim()) return;
    setBusy(true);
    setNote('正在抓取正文…');
    try {
      const res = await fetch('/api/interview/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? '抓取失败');
      add({
        id: uid(),
        source: 'url',
        label: label.trim() || data.title || url.trim(),
        url: data.url,
        content: data.text,
        trust: trust === 'high' ? 'medium' : trust,
      });
      setUrl('');
      setLabel('');
      setNote(data.truncated ? '已抓取（内容较长，已截断）' : '已抓取正文');
    } catch (e) {
      setNote(e instanceof Error ? e.message : '抓取失败，可手动复制正文用「整理/粘贴」加入');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surface rounded-lg p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">
            面经辅助
            <span className="ml-2 text-xs font-normal text-[var(--muted)]">
              可选 · 已加 {items.length} 条
            </span>
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
            模拟面试时用来校准「这个组会怎么考」。不是独立功能，不加也能开面。
          </p>
        </div>
      </div>

      <div className="mt-3 inline-flex flex-wrap gap-0.5 rounded-md border border-[var(--line)] p-0.5 text-xs">
        {([
          ['paste', '整理/粘贴'],
          ['url', '链接抓取'],
          ['file', '上传文件'],
        ] as const).map(([m, t]) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setNote('');
            }}
            className={`rounded px-3 py-1 transition ${
              mode === m
                ? 'bg-[var(--accent)] text-[var(--paper)]'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="来源备注，如「师兄去年面这个组」"
          className="field rounded-md px-3 py-2 text-sm"
        />
        <select
          value={trust}
          onChange={(e) => setTrust(e.target.value as IntelTrust)}
          className="field rounded-md px-3 py-2 text-sm"
        >
          {TRUST_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              可信度：{o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2">
        {mode === 'paste' && (
          <div className="space-y-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="粘贴/整理情报正文：这个组考过什么、面试官风格、几轮、重点方向…"
              className="field h-32 w-full resize-none rounded-md p-3 text-sm leading-relaxed"
            />
            <button
              type="button"
              onClick={addPaste}
              className="btn-primary rounded-md px-4 py-2 text-sm"
            >
              加入这条情报
            </button>
          </div>
        )}
        {mode === 'url' && (
          <div className="flex flex-wrap gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https:// 牛客/博客/GitHub 面经/招聘页链接"
              className="field min-w-[240px] flex-1 rounded-md px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addUrl}
              disabled={busy || !url.trim()}
              className="btn-primary rounded-md px-4 py-2 text-sm"
            >
              {busy ? '抓取中…' : '抓取正文'}
            </button>
          </div>
        )}
        {mode === 'file' && (
          <label
            className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--line)] p-4 text-center transition hover:border-[var(--accent)]"
          >
            <input
              type="file"
              accept={ACCEPT}
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) addFile(file);
                e.target.value = '';
              }}
            />
            <span className="text-sm text-[var(--ink)]">
              {busy ? '解析中…' : '上传面经文件（PDF / 截图导出 / MD / TXT）'}
            </span>
            <span className="mt-1 text-xs text-[var(--muted)]">点击选择，解析后加入辅助材料</span>
          </label>
        )}
      </div>

      {note && <p className="mt-2 text-xs text-[var(--muted)]">{note}</p>}

      <p className="mt-3 border-t border-dashed border-[var(--line)] pt-3 text-xs text-[var(--muted)]">
        公开帖可以点「甄别」：广告贴里的题未必假，看起来真诚的也未必真。甄别结果会自动调可信度。
      </p>

      {items.length > 0 && (
        <ul className="mt-4 space-y-2">
          {items.map((it) => {
            const meta = INTEL_SOURCE_META[it.source];
            const screen = screens[it.id];
            return (
              <li key={it.id} className="rounded-md border border-[var(--line)] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${meta.tone}`}>
                    {meta.label}
                  </span>
                  <span className="text-sm font-medium">{it.label}</span>
                  <span className="text-xs text-[var(--muted)]">{it.content.length} 字</span>
                  <select
                    value={it.trust}
                    onChange={(e) => updateTrust(it.id, e.target.value as IntelTrust)}
                    className="ml-auto rounded border border-[var(--line)] bg-transparent px-1.5 py-0.5 text-[11px] text-[var(--muted)]"
                  >
                    {TRUST_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => screenItem(it)}
                    disabled={screeningId === it.id}
                    className="text-xs text-[#2f6df0] hover:underline disabled:opacity-50"
                  >
                    {screeningId === it.id ? '甄别中…' : '甄别'}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(it.id)}
                    className="text-xs text-[var(--danger)] hover:underline"
                  >
                    删除
                  </button>
                </div>
                {screen && (
                  <p className="mt-1.5 text-xs text-[var(--muted)]">
                    {screen.verdict === 'promotional'
                      ? '疑似引流'
                      : screen.verdict === 'trustworthy'
                        ? '较可信'
                        : '存疑'}
                    {' · '}
                    {screen.headline}
                  </p>
                )}
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">
                  {it.content}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

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
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReferenceAnswerData | null>(null);
  const [error, setError] = useState('');

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (data || loading) return;
    if (preset) {
      setData(preset);
      return;
    }
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

const EDIT_KIND: Record<ResumeEdit['kind'], { label: string; tone: string }> = {
  strengthen: { label: '写实一点', tone: 'bg-[rgba(31,107,74,0.12)] text-[var(--ok)]' },
  soften: { label: '收一收', tone: 'bg-[rgba(161,98,7,0.12)] text-[var(--warn)]' },
  add: { label: '补一条', tone: 'bg-[rgba(37,99,235,0.12)] text-[#2f6df0]' },
  cut: { label: '建议删', tone: 'bg-[rgba(159,45,58,0.1)] text-[var(--danger)]' },
};

function applyEdit(resume: string, edit: ResumeEdit): string {
  if (edit.kind === 'cut' && edit.target && resume.includes(edit.target)) {
    return resume.replace(edit.target, '').replace(/\n{3,}/g, '\n\n').trim();
  }
  if (edit.target && resume.includes(edit.target)) {
    return resume.replace(edit.target, edit.suggestion);
  }
  if (edit.kind === 'add' || !edit.target) {
    return `${resume.trim()}\n\n${edit.suggestion}`;
  }
  return `${resume.trim()}\n\n${edit.suggestion}`;
}

function ResumeCoach({
  resume,
  jd,
  intel,
  demo,
  debrief,
  onApply,
}: {
  resume: string;
  jd: string;
  intel: IntelligenceItem[];
  demo: boolean;
  debrief?: string;
  onApply: (next: string) => void;
}) {
  const [edits, setEdits] = useState<ResumeEdit[] | null>(demo ? demoEdits : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState<Record<string, boolean>>({});

  async function load() {
    if (demo) {
      setEdits(demoEdits);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/interview/revise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume, jd, intelligence: intel, debrief }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? '生成失败');
      setEdits(data.edits as ResumeEdit[]);
      setApplied({});
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成修改建议失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="surface rounded-lg p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">对照岗位改简历</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            把虚的收一收、缺口补上、自己讲不清的别写。改完的文本会直接用于模拟面试。
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="btn-ghost rounded-md px-3 py-1.5 text-xs"
        >
          {loading ? '正在对照…' : edits ? '重新生成建议' : '生成修改建议'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}
      {edits && (
        <ul className="mt-4 space-y-3">
          {edits.map((edit) => {
            const meta = EDIT_KIND[edit.kind];
            return (
              <li key={edit.id} className="rounded-md border border-[var(--line)] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${meta.tone}`}>
                    {meta.label}
                  </span>
                  <span className="text-xs text-[var(--muted)]">{edit.reason}</span>
                </div>
                {edit.target && (
                  <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
                    <span className="text-[var(--muted)]">原文：</span>
                    {edit.target}
                  </p>
                )}
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink)]">
                  <span className="text-[var(--muted)]">建议：</span>
                  {edit.suggestion}
                </p>
                <button
                  type="button"
                  disabled={applied[edit.id]}
                  onClick={() => {
                    onApply(applyEdit(resume, edit));
                    setApplied((p) => ({ ...p, [edit.id]: true }));
                  }}
                  className="mt-2 text-xs text-[#2f6df0] hover:underline disabled:text-[var(--muted)]"
                >
                  {applied[edit.id] ? '已应用到简历' : edit.kind === 'cut' ? '从简历删掉' : '应用到简历'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ResumeSheet({
  resume,
  jd,
  defaultOpen = false,
}: {
  resume: string;
  jd?: string;
  defaultOpen?: boolean;
}) {
  const [openResume, setOpenResume] = useState(defaultOpen);
  const [openJd, setOpenJd] = useState(defaultOpen);
  if (!resume.trim() && !jd?.trim()) return null;

  return (
    <div className="surface space-y-4 rounded-lg p-4">
      <p className="text-sm font-medium">这份材料</p>
      {resume.trim() && (
        <div>
          <button
            type="button"
            onClick={() => setOpenResume((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="text-xs font-medium">简历</span>
            <span className="text-xs text-[var(--muted)]">
              {openResume ? '收起' : `展开 · ${resume.trim().length} 字`}
            </span>
          </button>
          {openResume && (
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-[var(--line)] bg-[var(--paper)] p-3 text-xs leading-relaxed text-[var(--ink)]">
              {resume}
            </pre>
          )}
        </div>
      )}
      {jd?.trim() && (
        <div>
          <button
            type="button"
            onClick={() => setOpenJd((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="text-xs font-medium">岗位 JD</span>
            <span className="text-xs text-[var(--muted)]">
              {openJd ? '收起' : `展开 · ${jd.trim().length} 字`}
            </span>
          </button>
          {openJd && (
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-[var(--line)] bg-[var(--paper)] p-3 text-xs leading-relaxed text-[var(--ink)]">
              {jd}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function PlanPhase({
  plan,
  resume,
  jd,
  onBack,
  onStart,
}: {
  plan: InterviewPlan;
  resume: string;
  jd: string;
  onBack: () => void;
  onStart: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-[var(--accent)]">OUTLINE</p>
        <h1 className="font-brand mt-2 text-3xl leading-tight">
          {plan.companyGuess ? `${plan.companyGuess} · ` : ''}
          {plan.roleGuess}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{plan.opening}</p>
      </div>

      <ResumeSheet resume={resume} jd={jd} defaultOpen />

      <div className="surface rounded-lg p-4">
        <Meter
          label="今天要深挖的追问点"
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
            {(point.resumeQuote || point.jdRequirement || point.intelQuote) && (
              <div className="mt-3 space-y-1.5 border-l-2 border-[var(--accent)]/35 pl-3">
                {point.intelQuote && (
                  <p className="text-xs leading-relaxed text-[var(--ink)]">
                    <span className="text-[#2f6df0]">情报：</span>
                    {point.intelQuote}
                  </p>
                )}
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
          返回改简历
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
    <div className="space-y-6">
      <div className="surface flex flex-wrap items-center justify-between gap-5 rounded-lg p-4">
        <CoverageRing
          value={done}
          max={plan.points.length}
          label="已走完"
          caption={
            left > 0
              ? `还剩 ${left} 个追问点。范围有限，走完就是今天的全部。`
              : '全部追问点都问过了。'
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

      <ResumeSheet resume={resume} jd={jd} />

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-2">
        <p className="text-xs tracking-[0.16em] text-[var(--muted)]">追问点</p>
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
            <ReferenceAnswerBlock
              point={point}
              resume={resume}
              jd={jd}
              intel={intel}
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

function DonePhase({
  plan,
  sessions,
  summary,
  resume,
  jd,
  intel,
  demo,
  onApplyResume,
  onRestart,
  onContinue,
}: {
  plan: InterviewPlan;
  sessions: Record<string, ResumeInterviewSession>;
  summary: { verified: number; collapsed: number; done: number; total: number };
  resume: string;
  jd: string;
  intel: IntelligenceItem[];
  demo: boolean;
  onApplyResume: (next: string) => void;
  onRestart: () => void;
  onContinue: () => void;
}) {
  const incomplete = summary.done < summary.total;
  const debrief = plan.points
    .map((p) => {
      const s = sessions[p.id];
      if (!s) return `· ${p.title}：未开始`;
      return `· ${p.title}：${s.outcome === 'verified' ? '经得起追问' : `第 ${s.collapsedAtTurn} 轮经不起追问`}`;
    })
    .join('\n');

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-[var(--accent)]">DEBRIEF</p>
        <h1 className="font-brand mt-2 text-3xl leading-tight">面试复盘</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          {summary.collapsed > 0
            ? `你在 ${summary.done} 个追问点里，有 ${summary.collapsed} 个经不起继续追问。把这些改回简历，比再刷十篇面经有用。`
            : summary.verified > 0
              ? `已验证的 ${summary.verified} 个点都撑住了追问。继续保持用事实说话。`
              : '还没有完成任何追问点。'}
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

      <ResumeSheet resume={resume} jd={jd} />

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
          回简历继续改
        </button>
      </div>

      <ResumeCoach
        resume={resume}
        jd={jd}
        intel={intel}
        demo={demo}
        debrief={debrief}
        onApply={onApplyResume}
      />
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
