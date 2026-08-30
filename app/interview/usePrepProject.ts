'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import sample from '@/lib/interview-sample.json';
import {
  demoCompany,
  demoIntel,
  demoJd,
  demoPlan,
  demoProgress,
  demoResume,
  demoRole,
  demoSessions,
  demoSyllabus,
} from '@/lib/interview-demo';
import {
  addPracticeRecord,
  getProgressServerSnapshot,
  getProgressSnapshot,
  subscribeProgress,
  toRecord,
} from '@/lib/progress';
import { buildPrepReadiness } from '@/lib/engine/readiness';
import { buildReviewArchive, saveReviewArchive } from '@/lib/history';
import { checkIntelJobFit } from '@/lib/engine/intelFit';
import type {
  IntelligenceItem,
  InterviewPlan,
  PracticePrefs,
  PrepPhase,
  ResumeInterviewSession,
  Syllabus,
  TrainingMode,
} from '@/lib/types';
import { JD_MIN_CHARS, RESUME_MIN_CHARS, parseUpload } from './components/shared';

/**
 * 备战项目的全部状态与流转。页面组件只负责排版，不再管状态细节。
 * 阶段流转：setup → intel → profile → practice(live) → review
 */
export function usePrepProject(startDemo: boolean) {
  const [company, setCompany] = useState(startDemo ? demoCompany : '');
  const [role, setRole] = useState(startDemo ? demoRole : '');
  const [resume, setResume] = useState(startDemo ? demoResume : '');
  const [jd, setJd] = useState(startDemo ? demoJd : '');
  const [phase, setPhase] = useState<PrepPhase>(startDemo ? 'intel' : 'setup');
  const [live, setLive] = useState(false);
  const [plan, setPlan] = useState<InterviewPlan | null>(startDemo ? demoPlan : null);
  const [syllabus, setSyllabus] = useState<Syllabus | undefined>(
    startDemo ? demoSyllabus : undefined,
  );
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
  const [trainingMode, setTrainingMode] = useState<TrainingMode>('full');
  const [practicePrefs, setPracticePrefs] = useState<PracticePrefs>({
    durationMin: 25,
    questionCount: 6,
    difficulty: 'medium',
  });
  const [trainingStartedAt, setTrainingStartedAt] = useState<number | null>(null);
  const savedProgress = useSyncExternalStore(
    subscribeProgress,
    getProgressSnapshot,
    getProgressServerSnapshot,
  );
  const progressRecords = demo ? demoProgress : savedProgress;

  const activePoint = plan?.points[activeIndex] ?? null;
  const readiness = useMemo(
    () => buildPrepReadiness(syllabus, plan, sessions),
    [syllabus, plan, sessions],
  );
  const journeyCurrent = live ? 'practice' : phase;

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
    setTrainingMode('full');
    setPhase('intel');
  }

  function loadSample() {
    setCompany(demoCompany);
    setRole(demoRole);
    setResume(sample.resume);
    setJd(sample.jd);
    setIntel(demoIntel);
    setError('');
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
    setTrainingMode('full');
    setTrainingStartedAt(null);
    setPhase('setup');
  }

  function persistArchive(used: Record<string, ResumeInterviewSession> = sessions) {
    if (demo || !plan) return;
    const archive = buildReviewArchive({
      company,
      role,
      mode: trainingMode,
      plan,
      sessions: used,
      syllabus,
    });
    if (archive) saveReviewArchive(archive);
  }

  function goPhase(next: PrepPhase) {
    setError('');
    setLive(false);
    if (next === 'review') persistArchive();
    setPhase(next);
  }

  /** 各阶段的进入门槛，顶部导航据此决定哪些步骤可点击 */
  function canEnter(target: PrepPhase): boolean {
    switch (target) {
      case 'setup':
        return true;
      case 'intel':
        return (
          company.trim().length >= 2 &&
          role.trim().length >= 2 &&
          resume.trim().length >= RESUME_MIN_CHARS &&
          jd.trim().length >= JD_MIN_CHARS
        );
      case 'profile':
        return Boolean(syllabus);
      case 'practice':
        return Boolean(syllabus || plan);
      case 'review':
        return Object.keys(sessions).length > 0 || progressRecords.length > 0;
    }
  }

  function navTo(target: PrepPhase) {
    if (target === journeyCurrent || !canEnter(target)) return;
    goPhase(target);
  }

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

  async function summarizeIntel(): Promise<boolean> {
    if (demo) {
      setSyllabus(demoSyllabus);
      setError('');
      return true;
    }
    const fit = checkIntelJobFit({ items: intel, company, role, jd });
    if (!fit.ok) {
      setError(fit.reason);
      return false;
    }
    setSummarizing(true);
    setError('');
    try {
      const newest = [...intel].sort((a, b) => {
        const da = Date.parse(a.publishedAt ?? '') || 0;
        const db = Date.parse(b.publishedAt ?? '') || 0;
        return db - da;
      });
      const res = await fetch('/api/syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company,
          role,
          posts: newest.slice(0, 8).map((it) => ({ content: it.content, title: it.label })),
          jd,
          resume,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? '聚合失败');
      setSyllabus(data.syllabus as Syllabus);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : '聚合失败');
      return false;
    } finally {
      setSummarizing(false);
    }
  }

  async function goProfile() {
    const ok = await summarizeIntel();
    if (ok) goPhase('profile');
  }

  async function startTraining(mode: TrainingMode, prefs: PracticePrefs = practicePrefs) {
    setTrainingMode(mode);
    setPracticePrefs(prefs);
    if (demo && plan) {
      const pool =
        mode === 'intel'
          ? demoPlan.points.filter((p) => p.source === 'intel_hit')
          : demoPlan.points;
      const next = { ...demoPlan, points: pool.slice(0, prefs.questionCount) };
      const nextIds = new Set(next.points.map((p) => p.id));
      const nextSessions = Object.fromEntries(
        Object.entries(demoSessions).filter(([id]) => nextIds.has(id)),
      );
      setPlan(next);
      setSessions(nextSessions);
      setActiveIndex(0);
      setLive(true);
      setPhase('practice');
      setTrainingStartedAt(Date.now());
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/interview/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume,
          jd,
          intelligence: intel,
          trainingMode: mode,
          questionCount: prefs.questionCount,
          difficulty: prefs.difficulty,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? '生成失败');
      setPlan(data.plan as InterviewPlan);
      setSessions({});
      setActiveIndex(0);
      setDemo(false);
      setLive(true);
      setPhase('practice');
      setTrainingStartedAt(Date.now());
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
        persistArchive(nextSessions);
        setLive(false);
        setPhase('review');
      } else setActiveIndex(anyLeft);
    } else {
      setActiveIndex(nextIdx);
    }
  }

  function continueTraining() {
    if (!plan) return;
    const left = plan.points.findIndex((p) => !sessions[p.id]);
    if (left >= 0) {
      setActiveIndex(left);
      setLive(true);
      setPhase('practice');
    }
  }

  return {
    company,
    role,
    resume,
    jd,
    phase,
    live,
    plan,
    syllabus,
    loading,
    summarizing,
    parsing,
    error,
    activeIndex,
    sessions,
    intel,
    demo,
    trainingMode,
    practicePrefs,
    trainingStartedAt,
    progressRecords,
    activePoint,
    readiness,
    journeyCurrent,
    setCompany,
    setRole,
    setResume,
    setJd,
    setIntel,
    setActiveIndex,
    loadDemo,
    loadSample,
    resetAll,
    goPhase,
    canEnter,
    navTo,
    importFile,
    goProfile,
    startTraining,
    finishPoint,
    continueTraining,
  };
}
