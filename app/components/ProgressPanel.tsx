'use client';

import { CoverageRing, WeekBars } from '@/app/components/ProgressViz';
import { summarize } from '@/lib/progress';
import type { PracticeRecord } from '@/lib/types';

export function ProgressPanel({
  records,
  compact = false,
}: {
  records: PracticeRecord[];
  compact?: boolean;
}) {
  const s = summarize(records);
  const verified = records.filter((r) => r.outcome === 'verified').length;
  const collapsed = records.filter((r) => r.outcome === 'collapsed').length;
  const weekCount = s.week.reduce((n, d) => n + d.count, 0);

  return (
    <div className="surface space-y-5 rounded-lg p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-[var(--accent)]">本周训练</p>
          <h2 className="mt-1 text-sm font-medium">练了多少个点，站住了几个</h2>
        </div>
        <p className="text-xs text-[var(--muted)]">
          {s.streak > 0 ? `已连续练习 ${s.streak} 天` : '今天开练，格子就会亮'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <CoverageRing
          value={verified}
          max={Math.max(6, records.length)}
          label="已验证"
          caption={
            records.length === 0
              ? '还没开始。每撑住一个追问点，这里就会 +1。'
              : `本周训练 ${weekCount} 个考点`
          }
          tone={verified > 0 ? 'ok' : 'accent'}
        />
        <div className="min-w-[200px] flex-1 space-y-2 text-sm">
          <p>
            ✓ 已验证 <span className="tabular-nums text-[var(--ok)]">{verified}</span>
          </p>
          <p>
            △ 需加强 <span className="tabular-nums text-[var(--warn)]">{collapsed}</span>
          </p>
          <p className="text-xs text-[var(--muted)]">
            平均分 {s.today.avgScore || '—'} / 100，只作参考，不是主指标。
          </p>
        </div>
      </div>

      {!compact && <WeekBars days={s.week} />}
    </div>
  );
}
