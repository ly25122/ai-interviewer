'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { WeekBars } from '@/app/components/ProgressViz';
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

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-3 lg:sticky lg:top-4">
        {archive ? (
          <ReviewHeadline archive={archive} live />
        ) : (
          <div>
            <h1 className="font-brand text-2xl leading-tight">
              {company} · {role}
            </h1>
            <p className="mt-1 text-xs text-[var(--muted)]">还没有可回看的追问。</p>
          </div>
        )}

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
          <button type="button" onClick={onRestart} className="btn-ghost rounded-md px-4 py-2 text-xs">
            换一个目标岗位
          </button>
        </div>

        {demo ? (
          <p className="text-[11px] leading-relaxed text-[var(--muted)]">
            演示模式不写入本机历史。用自己的材料练完一场，往期复盘才会留下问答原文。
          </p>
        ) : archive ? (
          <p className="text-[11px] leading-relaxed text-[var(--muted)]">
            这场复盘已收入本机，不上传服务器。
            <Link href="/history" className="ml-1 text-[var(--accent)] hover:underline">
              查看往期 →
            </Link>
          </p>
        ) : null}
      </aside>

      <section className="space-y-4">
        {archive && (
          <>
            <NextThreeCard archive={archive} live />
            <PointReplayList key={archive.fingerprint} archive={archive} />
          </>
        )}

        <div className="surface rounded-lg p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium">近 7 天</p>
            <p className="text-xs text-[var(--muted)]">
              {progressSummary.streak > 0
                ? `已连续练习 ${progressSummary.streak} 天`
                : '练过的日子会亮起来'}
            </p>
          </div>
          <div className="mt-3">
            <WeekBars days={progressSummary.week} />
          </div>
        </div>

        <ResumeCoach
          resume={resume}
          jd={jd}
          intel={intel}
          demo={demo}
          debrief={debrief}
          onApply={onApplyResume}
        />
      </section>
    </div>
  );
}
