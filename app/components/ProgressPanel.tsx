'use client';

import { CoverageRing, Meter, WeekBars } from '@/app/components/ProgressViz';
import { scoreLabel, summarize } from '@/lib/progress';
import type { PracticeRecord } from '@/lib/types';

export function ProgressPanel({
  records,
  compact = false,
}: {
  records: PracticeRecord[];
  compact?: boolean;
}) {
  const s = summarize(records);
  const todayTone =
    s.today.count === 0 ? 'accent' : s.today.avgScore >= 80 ? 'ok' : s.today.avgScore >= 50 ? 'warn' : 'accent';
  const grade = scoreLabel(s.today.avgScore);

  return (
    <div className="surface space-y-5 rounded-lg p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-[var(--accent)]">可量化的进步</p>
          <h2 className="mt-1 text-sm font-medium">今天复习了多少，答得怎样</h2>
        </div>
        <p className="text-xs text-[var(--muted)]">
          {s.streak > 0 ? `已连续练习 ${s.streak} 天` : '今天开练，格子就会亮'}
          {s.totalCount > 0 ? ` · 累计 ${s.totalCount} 题` : ''}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <CoverageRing
          value={s.today.count}
          max={Math.max(6, s.today.count)}
          label="今日题数"
          caption={
            s.today.count === 0
              ? '还没开始。每答完一个追问点，这里就会 +1。'
              : `今天练了 ${s.today.count} 题，平均 ${s.today.avgScore} 分（${grade.text}）。`
          }
          tone={todayTone}
        />
        <div className="min-w-[200px] flex-1 space-y-3">
          <Meter
            label="今日平均分"
            value={s.today.avgScore}
            max={100}
            hint={
              s.delta === null
                ? '分数来自「有没有说出新事实、有没有撑住追问」，不是主观印象分。'
                : s.delta > 0
                  ? `比昨天高 ${s.delta} 分`
                  : s.delta < 0
                    ? `比昨天低 ${Math.abs(s.delta)} 分，看崩在哪一轮补回去`
                    : '和昨天持平'
            }
            tone={todayTone}
          />
          <div className="flex gap-4 text-xs text-[var(--muted)]">
            <span>撑住 {s.today.verified}</span>
            <span>需补 {s.today.collapsed}</span>
          </div>
        </div>
      </div>

      {!compact && <WeekBars days={s.week} />}
    </div>
  );
}
