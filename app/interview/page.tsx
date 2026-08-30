'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { demoReference } from '@/lib/interview-demo';
import type { PrepPhase } from '@/lib/types';
import { JourneyBar } from '@/app/components/ProgressViz';
import { IntelligenceHub } from './components/IntelligenceHub';
import { LivePhase } from './components/LiveInterview';
import { PracticeLauncher } from './components/PracticeLauncher';
import { ProfilePanel } from './components/ProfilePanel';
import { ReviewPanel } from './components/ReviewPanel';
import { SetupPanel } from './components/SetupPanel';
import { usePrepProject } from './usePrepProject';

const JOURNEY = [
  { id: 'setup', label: '这场面试' },
  { id: 'intel', label: '面试情报' },
  { id: 'profile', label: '考情画像' },
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
  const prep = usePrepProject(search.get('demo') === '1');

  return (
    <main className="min-h-dvh bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[var(--paper-lift)]/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-5 py-2.5">
          <Link href="/" className="shrink-0 font-brand text-lg tracking-tight">
            情报驱动 面试备战
          </Link>
          <div className="min-w-0 flex-1">
            <JourneyBar
              steps={JOURNEY}
              current={prep.journeyCurrent}
              compact
              onSelect={(id) => prep.navTo(id as PrepPhase)}
              isAvailable={(id) => prep.canEnter(id as PrepPhase)}
            />
          </div>
          <p className="hidden shrink-0 text-[11px] text-[var(--muted)] sm:block">
            {prep.company && prep.role ? `${prep.company} · ${prep.role}` : '先锁定这场面试'}
          </p>
          <Link
            href="/history"
            className="shrink-0 text-[11px] text-[var(--muted)] hover:text-[var(--ink)]"
          >
            往期复盘
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-5 py-5">
        {prep.demo && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--accent)]/40 bg-[rgba(31,122,102,0.07)] px-4 py-2.5">
            <p className="text-sm text-[var(--ink)]">
              <span className="font-medium">演示模式</span>
              <span className="text-[var(--muted)]">
                {' '}
                · 字节电商交易组。可从情报点到画像、训练和复盘。
              </span>
            </p>
            <button
              type="button"
              onClick={prep.resetAll}
              className="btn-ghost rounded-md px-3 py-1.5 text-xs"
            >
              退出演示，用我自己的材料 →
            </button>
          </div>
        )}

        {prep.phase === 'setup' && (
          <SetupPanel
            company={prep.company}
            role={prep.role}
            resume={prep.resume}
            jd={prep.jd}
            parsing={prep.parsing}
            error={prep.error}
            demo={prep.demo}
            onCompany={prep.setCompany}
            onRole={prep.setRole}
            onResume={prep.setResume}
            onJd={prep.setJd}
            onImport={prep.importFile}
            onDemo={prep.loadDemo}
            onSample={prep.loadSample}
            onNext={() => prep.goPhase('intel')}
          />
        )}

        {prep.phase === 'intel' && (
          <IntelligenceHub
            company={prep.company}
            role={prep.role}
            jd={prep.jd}
            items={prep.intel}
            summarizing={prep.summarizing}
            error={prep.error}
            onChange={prep.setIntel}
            onBack={() => prep.goPhase('setup')}
            onNext={prep.goProfile}
          />
        )}

        {prep.phase === 'profile' && (
          <ProfilePanel
            company={prep.company}
            role={prep.role}
            resume={prep.resume}
            jd={prep.jd}
            intel={prep.intel}
            syllabus={prep.syllabus}
            demo={prep.demo}
            error={prep.error}
            onBack={() => prep.goPhase('intel')}
            onNext={() => prep.goPhase('practice')}
          />
        )}

        {prep.phase === 'practice' && !prep.live && (
          <PracticeLauncher
            company={prep.company}
            role={prep.role}
            intelCount={prep.intel.length}
            syllabus={prep.syllabus}
            loading={prep.loading}
            error={prep.error}
            prefs={prep.practicePrefs}
            onStart={prep.startTraining}
            onBack={() => prep.goPhase('profile')}
          />
        )}

        {prep.phase === 'practice' && prep.live && prep.plan && prep.activePoint && (
          <LivePhase
            plan={prep.plan}
            point={prep.activePoint}
            index={prep.activeIndex}
            resume={prep.resume}
            jd={prep.jd}
            intel={prep.intel}
            sessions={prep.sessions}
            presetRefs={prep.demo ? demoReference : undefined}
            durationMin={prep.practicePrefs.durationMin}
            startedAt={prep.trainingStartedAt}
            onSelect={prep.setActiveIndex}
            onFinishPoint={prep.finishPoint}
            onDone={() => prep.goPhase('review')}
          />
        )}

        {prep.phase === 'review' && (
          <ReviewPanel
            company={prep.company}
            role={prep.role}
            mode={prep.trainingMode}
            readiness={prep.readiness}
            plan={prep.plan}
            sessions={prep.sessions}
            records={prep.progressRecords}
            resume={prep.resume}
            jd={prep.jd}
            intel={prep.intel}
            demo={prep.demo}
            onApplyResume={prep.setResume}
            onViewResume={() => prep.goPhase('setup')}
            onRestart={prep.resetAll}
            onContinue={prep.continueTraining}
            onTrainAgain={() => prep.goPhase('practice')}
          />
        )}
      </div>
    </main>
  );
}
