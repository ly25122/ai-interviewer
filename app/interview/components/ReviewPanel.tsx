'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { WeekTrend } from '@/app/components/ProgressViz';
import {
  doneCount,
  formatArchiveTime,
  getHistoryServerSnapshot,
  getHistorySnapshot,
  modeLabel,
  subscribeHistory,
} from '@/lib/history';
import { buildReviewArchive } from '@/lib/history';
import { summarize } from '@/lib/progress';
import type {
  IntelligenceItem,
  InterviewPlan,
  PracticeRecord,
  ReadinessMap,
  ResumeInterviewSession,
  ReviewArchive,
  TrainingMode,
} from '@/lib/types';
import {
  NextThreeCard,
  PointReplayList,
  ReviewHeadline,
  ReviewStats,
} from './ReviewArchiveView';
import { ResumeCoach } from './ResumeCoach';

type ReviewTab = 'session' | 'history' | 'resume';

function readHash(): { tab: ReviewTab; archiveId: string | null } {
  if (typeof window === 'undefined') return { tab: 'session', archiveId: null };
  const raw = decodeURIComponent(window.location.hash.replace(/^#\/?/, ''));
  if (raw === 'resume') return { tab: 'resume', archiveId: null };
  if (raw === 'history') return { tab: 'history', archiveId: null };
  if (raw.startsWith('history/')) {
    const id = raw.slice('history/'.length);
    return { tab: 'history', archiveId: id || null };
  }
  return { tab: 'session', archiveId: null };
}

function hashFor(tab: ReviewTab, archiveId: string | null) {
  if (tab === 'history' && archiveId) return `#history/${encodeURIComponent(archiveId)}`;
  if (tab === 'history') return '#history';
  if (tab === 'resume') return '#resume';
  return '#session';
}

function encourage(input: {
  verified: number;
  shaky: number;
  streak: number;
}): { title: string; body: string; icon: 'streak' | 'hold' | 'gap' | 'start' } {
  if (input.streak > 1 && input.verified >= input.shaky) {
    return {
      icon: 'streak',
      title: `连续 ${input.streak} 天都在上场`,
      body: '站住的这几个点已经是你的底气。不是运气，是你真的讲清楚了。剩下的专攻就够，下一场会更稳。',
    };
  }
  if (input.shaky > input.verified) {
    return {
      icon: 'gap',
      title: '被追回来，说明你已经碰到真题了',
      body: '这不可惜。盲区摊开了，就有下一刀往哪砍。带着这几个点再练一轮，会明显比今天从容。',
    };
  }
  if (input.verified > 0) {
    return {
      icon: 'hold',
      title: `这 ${input.verified} 个点，你撑住了`,
      body: '面试官往下追，你还能往下讲。把回放里没接上的那一层补实，下一场会更像你自己的东西。',
    };
  }
  return {
    icon: 'start',
    title: '你已经走完一场完整训练',
    body: '先把回放看完。具体说到哪一层、卡在哪一句，比再找一套题更有用。你不是从零开始，是已经有了下一刀的位置。',
  };
}

function sessionComment(input: { verified: number; shaky: number; uncovered: number; avgScore: number }): {
  comment: string;
  rating: string;
} {
  if (input.avgScore >= 80) {
    return {
      rating: '这轮站得住',
      comment: `均分 ${input.avgScore}。主线能讲清，剩下 ${input.shaky + input.uncovered} 个点下次盯着练就行。`,
    };
  }
  if (input.avgScore >= 50) {
    return {
      rating: '一半撑住了',
      comment: `站住 ${input.verified} 个，被追回来 ${input.shaky} 个。回放里看是哪一层没接上。`,
    };
  }
  return {
    rating: '这轮偏虚',
    comment: `均分 ${input.avgScore}。先别加新题，把回放里崩掉的那几问补具体。`,
  };
}

function EncourageIcon({ kind }: { kind: 'streak' | 'hold' | 'gap' | 'start' }) {
  const common = 'h-10 w-10 shrink-0 text-[var(--accent)]';
  if (kind === 'streak') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
        <path
          d="M12 3c2 3.2 1.2 5.4 0 7 2.4-.4 4.8.4 6.2 2.6 1.6 2.6.8 6.2-2.2 7.8-3 1.6-6.8.6-8.4-2.2C5.8 15.4 6 12.2 8.2 10c-2 3 0 5.4 1.6 6.2C8 13.6 9.4 8.8 12 3Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (kind === 'hold') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 12.2 10.6 15 16 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'gap') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
        <path
          d="M4 16.5 10 8l3.2 4.2L17 7.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M15 7.5h4v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className={common} aria-hidden>
      <path
        d="M9 18h6M10 21h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M8.2 14.5c-1.8-1.4-2.7-3.4-2.2-5.4C6.6 6.6 9 4.8 12 4.8s5.4 1.8 6 4.3c.5 2-.4 4-2.2 5.4-.6.5-1 1.2-1.1 2H9.3c-.1-.8-.5-1.5-1.1-2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ReviewPanel({
  company,
  role,
  mode,
  readiness,
  plan,
  sessions,
  records,
  resume,
  jd,
  intel,
  demo,
  onApplyResume,
  onViewResume,
  onRestart,
  onContinue,
  onTrainAgain,
}: {
  company: string;
  role: string;
  mode: TrainingMode;
  readiness: ReadinessMap;
  plan: InterviewPlan | null;
  sessions: Record<string, ResumeInterviewSession>;
  records: PracticeRecord[];
  resume: string;
  jd: string;
  intel: IntelligenceItem[];
  demo: boolean;
  onApplyResume: (next: string) => void;
  onViewResume: () => void;
  onRestart: () => void;
  onContinue: () => void;
  onTrainAgain: () => void;
}) {
  const initial = readHash();
  const [tab, setTab] = useState<ReviewTab>(initial.tab);
  const [archiveId, setArchiveId] = useState<string | null>(initial.archiveId);
  const archives = useSyncExternalStore(
    subscribeHistory,
    getHistorySnapshot,
    getHistoryServerSnapshot,
  );
  const archive = useMemo(
    () =>
      plan
        ? buildReviewArchive({
            company,
            role,
            mode,
            plan,
            sessions,
            readiness,
            id: 'live',
            at: plan.generatedAt,
          })
        : null,
    [company, role, mode, plan, sessions, readiness],
  );
  const selectedPast = archiveId ? (archives.find((a) => a.id === archiveId) ?? null) : null;
  const incomplete = plan ? plan.points.some((p) => !sessions[p.id]) : false;
  const progressSummary = summarize(records);
  const debrief = (plan?.points ?? [])
    .map((p) => {
      const s = sessions[p.id];
      if (!s) return `· ${p.title}：未开始`;
      return `· ${p.title}：${s.outcome === 'verified' ? '经得起追问' : `第 ${s.collapsedAtTurn} 轮经不起追问`}`;
    })
    .join('\n');
  const words = encourage({
    verified: archive?.verified ?? 0,
    shaky: archive?.shaky ?? 0,
    streak: progressSummary.streak,
  });
  const evals = archive
    ? sessionComment({
        verified: archive.verified,
        shaky: archive.shaky,
        uncovered: archive.uncovered,
        avgScore: archive.avgScore,
      })
    : null;

  function go(nextTab: ReviewTab, nextArchiveId: string | null = null, replace = false) {
    const hash = hashFor(nextTab, nextArchiveId);
    if (typeof window !== 'undefined') {
      const url = `${window.location.pathname}${window.location.search}${hash}`;
      if (replace) window.history.replaceState({ reviewNav: true }, '', url);
      else if (window.location.hash !== hash) window.history.pushState({ reviewNav: true }, '', url);
    }
    setTab(nextTab);
    setArchiveId(nextArchiveId);
  }

  function goBack() {
    if (tab === 'history' && archiveId) {
      go('history', null, true);
      return;
    }
    go('session', null, true);
  }

  useEffect(() => {
    const sync = () => {
      const next = readHash();
      setTab(next.tab);
      setArchiveId(next.archiveId);
    };
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);

  const tabs: Array<{ id: ReviewTab; label: string }> = [
    { id: 'session', label: '本场复盘' },
    { id: 'history', label: '历史面试' },
    { id: 'resume', label: '简历诊断' },
  ];

  const backLabel =
    tab === 'history' && archiveId ? '返回历史面试' : tab !== 'session' ? '返回本场复盘' : null;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-3 lg:sticky lg:top-4">
        {backLabel && (
          <button
            type="button"
            onClick={goBack}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-[var(--muted)] hover:bg-black/5 hover:text-[var(--ink)]"
          >
            <span aria-hidden>←</span>
            {backLabel}
          </button>
        )}
        <nav className="surface rounded-lg p-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => go(t.id, null)}
              className={`block w-full rounded-md px-3 py-2 text-left text-sm ${
                tab === t.id
                  ? 'bg-[var(--ink)] text-[var(--paper)]'
                  : 'text-[var(--muted)] hover:bg-black/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === 'history' ? (
          <div className="space-y-2">
            {archives.length === 0 ? (
              <p className="text-xs leading-relaxed text-[var(--muted)]">
                {demo
                  ? '演示不写入历史。用自己的材料练完一场才会留下。'
                  : '还没有往期记录。'}
              </p>
            ) : (
              archives.slice(0, 8).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => go('history', a.id)}
                  className={`block w-full rounded-lg border px-3 py-2 text-left hover:border-black/25 ${
                    archiveId === a.id
                      ? 'border-[var(--ink)] bg-white'
                      : 'border-[var(--line)]'
                  }`}
                >
                  <p className="text-[11px] text-[var(--muted)]">{formatArchiveTime(a.at)}</p>
                  <p className="mt-0.5 truncate text-xs font-medium">
                    {a.company} · {a.role}
                  </p>
                </button>
              ))
            )}
          </div>
        ) : tab === 'session' ? (
          <>
            {archive && <ReviewHeadline archive={archive} live />}
            {archive && <ReviewStats archive={archive} />}
            <div className="flex flex-wrap gap-2">
              {incomplete && (
                <button
                  type="button"
                  onClick={onContinue}
                  className="btn-primary rounded-md px-4 py-2 text-xs"
                >
                  继续未完成的题
                </button>
              )}
              <button
                type="button"
                onClick={onTrainAgain}
                className="btn-primary rounded-md px-4 py-2 text-xs"
              >
                再练一轮
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="btn-ghost rounded-md px-4 py-2 text-xs"
              >
                换一个目标岗位
              </button>
            </div>
          </>
        ) : null}
      </aside>

      <section className="space-y-4">
        {tab === 'session' && (
          <>
            <div className="surface rounded-lg p-5">
              <div className="flex items-start gap-4 rounded-lg border border-[var(--accent)]/30 bg-[rgba(31,122,102,0.08)] px-4 py-5">
                <EncourageIcon kind={words.icon} />
                <div className="min-w-0">
                  <p className="font-brand text-2xl leading-snug">{words.title}</p>
                  <p className="mt-2 text-lg leading-relaxed">{words.body}</p>
                </div>
              </div>
              <div className="mt-5">
                <WeekTrend days={progressSummary.week} />
              </div>
            </div>
            {evals && archive && (
              <div className="surface rounded-lg p-4">
                <p className="text-[11px] text-[var(--muted)]">本场评价</p>
                <p className="mt-1 font-brand text-xl">{evals.rating}</p>
                <p className="mt-2 text-sm leading-relaxed">{evals.comment}</p>
                <p className="mt-3 text-[11px] text-[var(--muted)]">本场评语</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                  {archive.verified} 个站住，{archive.shaky} 个被追回来
                  {archive.uncovered > 0 ? `，${archive.uncovered} 个还没问到` : ''}
                  。均分 {archive.avgScore}。
                </p>
              </div>
            )}
            {archive && (
              <>
                <NextThreeCard archive={archive} live />
                <PointReplayList key={archive.fingerprint} archive={archive} />
              </>
            )}
          </>
        )}

        {tab === 'history' && !selectedPast && (
          <div className="surface rounded-lg p-5 text-sm leading-relaxed text-[var(--muted)]">
            {archives.length === 0
              ? '还没有往期面试。用自己的材料练完一场，会留在这台设备上。'
              : '左边点一场，在这一页回看完整问答。点返回可回到本场复盘，不会离开备战。'}
          </div>
        )}

        {tab === 'history' && selectedPast && (
          <PastArchiveDetail archive={selectedPast} onBack={goBack} />
        )}

        {tab === 'resume' && (
          <ResumeCoach
            resume={resume}
            jd={jd}
            intel={intel}
            demo={demo}
            debrief={debrief}
            onApply={onApplyResume}
            onViewResume={onViewResume}
            onBackToSession={() => go('session', null, true)}
          />
        )}
      </section>
    </div>
  );
}

function PastArchiveDetail({
  archive,
  onBack,
}: {
  archive: ReviewArchive;
  onBack: () => void;
}) {
  const done = doneCount(archive);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--muted)]">
          {modeLabel(archive.mode)} · {done}/{archive.points.length} 题 · 均分 {archive.avgScore}
        </p>
        <button type="button" onClick={onBack} className="btn-ghost rounded-md px-3 py-1.5 text-xs">
          ← 返回历史面试
        </button>
      </div>
      <ReviewHeadline archive={archive} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ReviewStats archive={archive} />
        <NextThreeCard archive={archive} />
      </div>
      <PointReplayList key={archive.id} archive={archive} />
    </div>
  );
}
