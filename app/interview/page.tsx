'use client';

import { Suspense, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import sample from '@/lib/interview-sample.json';
import {
  demoCompany,
  demoIntel,
  demoJd,
  demoPlan,
  demoProgress,
  demoReference,
  demoResume,
  demoRole,
  demoSessions,
  demoSyllabus,
} from '@/lib/interview-demo';
import { JourneyBar } from '@/app/components/ProgressViz';
import {
  addPracticeRecord,
  getProgressServerSnapshot,
  getProgressSnapshot,
  subscribeProgress,
  toRecord,
} from '@/lib/progress';
import { buildPrepReadiness } from '@/lib/engine/readiness';
import type {
  IntelligenceItem,
  InterviewPlan,
  PrepPhase,
  ResumeInterviewSession,
  Syllabus,
  TrainingMode,
} from '@/lib/types';
import { IntelligenceHub } from './components/IntelligenceHub';
import { LivePhase } from './components/LiveInterview';
import { PracticeLauncher } from './components/PracticeLauncher';
import { ReviewPanel } from './components/ReviewPanel';
import { SetupPanel } from './components/SetupPanel';
import { parseUpload } from './components/shared';

const JOURNEY = [
  { id: 'setup', label: '目标岗位' },
  { id: 'intel', label: '面试情报' },
  { id: 'practice', label: '针对训练' },
  { id: 'review', label: '复盘' },
];

export default function InterviewPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-dvh bg-[var(--paper)] text-[var(--ink)]">
          <p className="p-8 text-sm text-[var(--muted)]">载入备战页…</p>
        </main>
      }
    >
      <InterviewApp />
    </Suspense>
  );
}

function InterviewApp() {
  const search = useSearchParams();
  const startDemo = search.get('demo') === '1';
  const [company, setCompany] = useState(startDemo ? demoCompany : '');
  const [role, setRole] = useState(startDemo ? demoRole : '');
  const [resume, setResume] = useState(startDemo ? demoResume : '');
  const [jd, setJd] = useState(startDemo ? demoJd : '');
  const [phase, setPhase] = useState<PrepPhase>(startDemo ? 'intel' : 'setup');
  const [live, setLive] = useState(false);
  const [plan, setPlan] = useState<InterviewPlan | null>(startDemo ? demoPlan : null);
  const [syllabus, setSyllabus] = useState<Syllabus | undefined>(startDemo ? demoSyllabus : undefined);
  const [loading, setLoading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [parsing, setParsing] = useState<'resume' | 'jd' | null>(null);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [sessions, setSessions] = useState<Record<string, ResumeInterviewSession>>(
    startDemo ? demoSessions : {},
  );
  const [intel, setIntel] = useState<IntelligenceItem[]>(startDemo ? demoIntel : []);
  const [demo, setDemo] = useState(startDemo);
  const savedProgress = useSyncExternalStore(
    subscribeProgress,
    getProgressSnapshot,
    getProgressServerSnapshot,
  );
  const progressRecords = demo ? demoProgress : savedProgress;

  function loadDemo() {
    setCompany(demoCompany);
    setRole(demoRole);
    setResume(demoResume);
    setJd(demoJd);
    setIntel(demoIntel);
    setSyllabus(demoSyllabus);
    setPlan(demoPlan);
    setSessions(demoSessions);
    setActiveIndex(0);
    setError('');
    setDemo(true);
    setLive(false);
    setPhase('intel');
  }

  function resetAll() {
    setCompany('');
    setRole('');
    setResume('');
    setJd('');
    setIntel([]);
    setSyllabus(undefined);
    setPlan(null);
    setSessions({});
    setActiveIndex(0);
    setError('');
    setDemo(false);
    setLive(false);
    setPhase('setup');
  }

  const activePoint = plan?.points[activeIndex] ?? null;
  const readiness = useMemo(
    () => buildPrepReadiness(syllabus, plan, sessions),
    [syllabus, plan, sessions],
  );

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

  async function summarizeIntel() {
    if (demo) {
      setSyllabus(demoSyllabus);
      setError('');
      return;
    }
    if (intel.length === 0) {
      setError('先加入至少一条情报');
      return;
    }
    setSummarizing(true);
    setError('');
    try {
      const res = await fetch('/api/syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company,
          role,
          posts: intel.slice(0, 8).map((it) => ({ content: it.content, title: it.label })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? '聚合失败');
      setSyllabus(data.syllabus as Syllabus);
    } catch (e) {
      setError(e instanceof Error ? e.message : '聚合失败');
    } finally {
      setSummarizing(false);
    }
  }

  async function startTraining(mode: TrainingMode) {
    if (demo && plan) {
      const next =
        mode === 'intel' ? { ...demoPlan, points: demoPlan.points.filter((p) => p.source === 'intel_hit') } : demoPlan;
      setPlan(next);
      setSessions(demoSessions);
      setActiveIndex(0);
      setLive(true);
      setPhase('practice');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/interview/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume, jd, intelligence: intel, trainingMode: mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? '生成失败');
      setPlan(data.plan as InterviewPlan);
      setSessions({});
      setActiveIndex(0);
      setDemo(false);
      setLive(true);
      setPhase('practice');
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setLoading(false);
    }
  }

  function finishPoint(session: ResumeInterviewSession) {
    const nextSessions = { ...sessions, [session.pointId]: session };
    setSessions(nextSessions);
    if (!demo) {
      const title = plan?.points.find((p) => p.id === session.pointId)?.title ?? session.pointId;
      addPracticeRecord(toRecord(title, session));
    }
    if (!plan) return;
    const nextIdx = plan.points.findIndex((p, i) => i > activeIndex && !nextSessions[p.id]);
    if (nextIdx === -1) {
      const anyLeft = plan.points.findIndex((p) => !nextSessions[p.id]);
      if (anyLeft === -1) {
        setLive(false);
        setPhase('review');
      } else setActiveIndex(anyLeft);
    } else {
      setActiveIndex(nextIdx);
    }
  }

  const journeyCurrent = live ? 'practice' : phase;

  return (
    <main className="min-h-dvh bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[var(--paper-lift)]/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4">
          <Link href="/" className="font-brand text-xl tracking-tight">
            情报驱动 · 备战
          </Link>
          <p className="text-sm text-[var(--muted)]">
            {company && role ? `${company} · ${role}` : '先锁定目标岗位'}
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-5 py-8">
        <div className="surface mb-6 rounded-lg px-4 py-4 sm:px-6">
          <JourneyBar steps={JOURNEY} current={journeyCurrent} />
        </div>

        {demo && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--accent)]/40 bg-[rgba(159,45,58,0.06)] px-4 py-3">
            <p className="text-sm text-[var(--ink)]">
              <span className="font-medium">演示模式</span>
              <span className="text-[var(--muted)]">
                {' '}
                · 字节电商交易组。情报已聚合成考点，训练结果可直接看复盘。
              </span>
            </p>
            <button type="button" onClick={resetAll} className="btn-ghost rounded-md px-3 py-1.5 text-xs">
              退出演示，用我自己的材料 →
            </button>
          </div>
        )}

        {phase === 'setup' && (
          <SetupPanel
            company={company}
            role={role}
            resume={resume}
            jd={jd}
            parsing={parsing}
            error={error}
            demo={demo}
            onCompany={setCompany}
            onRole={setRole}
            onResume={setResume}
            onJd={setJd}
            onImport={importFile}
            onDemo={loadDemo}
            onSample={() => {
              setCompany(demoCompany);
              setRole(demoRole);
              setResume(sample.resume);
              setJd(sample.jd);
              setIntel(demoIntel);
              setError('');
            }}
            onNext={() => {
              setError('');
              setPhase('intel');
            }}
          />
        )}

        {phase === 'intel' && (
          <IntelligenceHub
            company={company}
            role={role}
            jd={jd}
            items={intel}
            syllabus={syllabus}
            summarizing={summarizing}
            error={error}
            onChange={setIntel}
            onSummarize={summarizeIntel}
            onBack={() => setPhase('setup')}
            onNext={() => {
              setError('');
              setLive(false);
              setPhase('practice');
            }}
          />
        )}

        {phase === 'practice' && !live && (
          <PracticeLauncher
            company={company}
            role={role}
            intelCount={intel.length}
            syllabus={syllabus}
            loading={loading}
            error={error}
            onStart={startTraining}
            onBack={() => setPhase('intel')}
          />
        )}

        {phase === 'practice' && live && plan && activePoint && (
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
            onDone={() => {
              setLive(false);
              setPhase('review');
            }}
          />
        )}

        {phase === 'review' && (
          <ReviewPanel
            company={company}
            role={role}
            readiness={readiness}
            plan={plan}
            sessions={sessions}
            records={progressRecords}
            resume={resume}
            jd={jd}
            intel={intel}
            demo={demo}
            onApplyResume={setResume}
            onRestart={resetAll}
            onContinue={() => {
              if (!plan) return;
              const left = plan.points.findIndex((p) => !sessions[p.id]);
              if (left >= 0) {
                setActiveIndex(left);
                setLive(true);
                setPhase('practice');
              }
            }}
            onTrainAgain={() => {
              setLive(false);
              setPhase('practice');
            }}
          />
        )}
      </div>
    </main>
  );
}
