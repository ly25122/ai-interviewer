'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { WeekTrend } from '@/app/components/ProgressViz';
import {
  formatArchiveTime,
  getHistoryServerSnapshot,
  getHistorySnapshot,
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

function encourage(input: {
  verified: number;
  shaky: number;
  streak: number;
}): string {
  if (input.streak > 1 && input.verified >= input.shaky) {
    return `连续 ${input.streak} 天都有练。这几个点站住了，下次专攻剩下的就行。`;
  }
  if (input.shaky > input.verified) {
    return '这轮被追回来几次不可惜，至少知道该补哪，比盲刷一套题强。';
  }
  if (input.verified > 0) {
    return '这几个点撑住了。把漏洞补上，下一场会稳一点。';
  }
  return '先把这场回放看完。具体说到哪一层，比再找题更有用。';
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
  onRestart: () => void;
  onContinue: () => void;
  onTrainAgain: () => void;
}) {
  const [tab, setTab] = useState<ReviewTab>('session');
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

  const tabs: Array<{ id: ReviewTab; label: string }> = [
    { id: 'session', label: '本场复盘' },
    { id: 'history', label: '历史面试' },
    { id: 'resume', label: '简历诊断' },
  ];

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-3 lg:sticky lg:top-4">
        <nav className="surface rounded-lg p-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
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
              archives.slice(0, 6).map((a) => (
                <Link
                  key={a.id}
                  href={`/history?id=${encodeURIComponent(a.id)}`}
                  className="block rounded-lg border border-[var(--line)] px-3 py-2 hover:border-black/25"
                >
                  <p className="text-[11px] text-[var(--muted)]">{formatArchiveTime(a.at)}</p>
                  <p className="mt-0.5 truncate text-xs font-medium">
                    {a.company} · {a.role}
                  </p>
                </Link>
              ))
            )}
            <Link href="/history" className="block text-xs text-[var(--accent)] hover:underline">
              全部往期 →
            </Link>
          </div>
        ) : (
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
        )}
      </aside>

      <section className="space-y-4">
        {tab === 'session' && (
          <>
            <div className="surface rounded-lg p-4">
              <WeekTrend days={progressSummary.week} />
              <p className="mt-3 text-sm leading-relaxed">{words}</p>
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

        {tab === 'history' && (
          <div className="surface rounded-lg p-5 text-sm leading-relaxed text-[var(--muted)]">
            左边点一场，会跳到往期复盘页看完整问答。记录只留在这台设备上。
          </div>
        )}

        {tab === 'resume' && (
          <ResumeCoach
            resume={resume}
            jd={jd}
            intel={intel}
            demo={demo}
            debrief={debrief}
            onApply={onApplyResume}
          />
        )}
      </section>
    </div>
  );
}
