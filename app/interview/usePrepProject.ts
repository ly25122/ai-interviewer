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
import type {
  IntelligenceItem,
  InterviewPlan,
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
    setPhase('setup');
  }

  function goPhase(next: PrepPhase) {
    setError('');
    setLive(false);
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
    if (intel.length === 0) {
      setError('先加入至少一条情报');
      return false;
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

  async function startTraining(mode: TrainingMode) {
    if (demo && plan) {
      const next =
        mode === 'intel'
          ? { ...demoPlan, points: demoPlan.points.filter((p) => p.source === 'intel_hit') }
          : demoPlan;
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
