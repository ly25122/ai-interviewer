'use client';

import { useMemo, useState } from 'react';
import { CoverageRing, StackedMeter } from '@/app/components/ProgressViz';
import { doneCount, formatArchiveTime, modeLabel, outcomeLabel } from '@/lib/history';
import type { ReviewArchive, ReviewPointSnapshot } from '@/lib/types';
import { SOURCE_META } from './shared';
import { TurnReplay } from './TurnReplay';

export function ReviewStats({ archive }: { archive: ReviewArchive }) {
  const total = Math.max(1, archive.verified + archive.shaky + archive.uncovered);
  return (
    <div className="space-y-3">
      <div className="surface rounded-lg p-4">
        <CoverageRing
          value={archive.verified}
          max={total}
          label="已验证"
          caption={`经不起追问 ${archive.shaky} · 尚未覆盖 ${archive.uncovered}`}
          tone={archive.verified > 0 && archive.shaky === 0 ? 'ok' : 'accent'}
        />
        <div className="mt-4">
          <StackedMeter
            label="准备度"
            segments={[
              { value: archive.verified, tone: 'ok', title: '已验证' },
              { value: archive.shaky, tone: 'warn', title: '需加强' },
              { value: archive.uncovered, tone: 'muted', title: '尚未覆盖' },
            ]}
            hint="不看平均分，只看哪几个点还没站住。"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Bucket label="已验证" value={archive.verified} tone="ok" />
        <Bucket label="需加强" value={archive.shaky} tone="warn" />
        <Bucket label="未覆盖" value={archive.uncovered} />
      </div>
    </div>
  );
}

export function NextThreeCard({
  archive,
  live = false,
}: {
  archive: ReviewArchive;
  live?: boolean;
}) {
  return (
    <div className="surface rounded-lg p-4">
      <p className="text-sm font-medium">
        {live ? '今天不用继续刷题。只补这 3 个：' : '当时该补的 3 个'}
      </p>
      {archive.nextThree.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">这场没有必须补的缺口。</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {archive.nextThree.map((a, i) => (
            <li key={a.topicId}>
              <p className="text-sm font-medium">
                {i + 1}. {a.title}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{a.reason}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function PointReplayList({ archive }: { archive: ReviewArchive }) {
  const defaultOpen = useMemo(() => {
    const shaky = archive.points.find((p) => p.outcome === 'collapsed');
    return (shaky ?? archive.points.find((p) => p.outcome !== 'not_probed') ?? archive.points[0])
      ?.id;
  }, [archive]);
  const [openId, setOpenId] = useState(defaultOpen);

  return (
    <div className="surface rounded-lg p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">本场追问回放</p>
        <p className="text-xs text-[var(--muted)]">
          {doneCount(archive)} / {archive.points.length} 题 · 均分 {archive.avgScore}
        </p>
      </div>
      <ul className="mt-3 divide-y divide-[var(--line)]">
        {archive.points.map((p) => (
          <PointRow
            key={p.id}
            point={p}
            open={openId === p.id}
            onToggle={() => setOpenId(openId === p.id ? '' : p.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function PointRow({
  point,
  open,
  onToggle,
}: {
  point: ReviewPointSnapshot;
  open: boolean;
  onToggle: () => void;
}) {
  const meta = SOURCE_META[point.source];
  const skipped = point.outcome === 'not_probed';
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 text-left">
        <span
          className={`mt-0.5 w-16 shrink-0 text-[11px] ${
            point.outcome === 'verified'
              ? 'text-[var(--ok)]'
              : point.outcome === 'collapsed'
                ? 'text-[var(--warn)]'
                : 'text-[var(--muted)]'
          }`}
        >
          {skipped ? '未开始' : `${point.score} 分`}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-sm font-medium">{point.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${meta.tone}`}>
              {meta.label}
            </span>
            <span className="text-[11px] text-[var(--muted)]">{outcomeLabel(point.outcome)}</span>
          </span>
        </span>
        <span className="text-[11px] text-[var(--muted)]">{open ? '收起' : '展开'}</span>
      </button>
      {open && (
        <div className="mt-3 pl-[4.75rem]">
          <p className="mb-2 text-[11px] leading-relaxed text-[var(--muted)]">{meta.hint}</p>
          <TurnReplay turns={point.turns} collapsedAtTurn={point.collapsedAtTurn} />
        </div>
      )}
    </li>
  );
}

export function ReviewHeadline({
  archive,
  live = false,
}: {
  archive: ReviewArchive;
  live?: boolean;
}) {
  const done = doneCount(archive);
  const incomplete = done < archive.points.length;
  return (
    <div>
      <p className="text-xs tracking-[0.16em] text-[var(--accent)]">
        {live ? '本场复盘' : formatArchiveTime(archive.at)}
        {' · '}
        {modeLabel(archive.mode)}
      </p>
      <h1 className="font-brand mt-1 text-2xl leading-tight">
        {archive.company} · {archive.role}
      </h1>
      <p className="mt-1 text-xs text-[var(--muted)]">
        {incomplete
          ? `问完 ${done} / ${archive.points.length} 题。已验证 ${archive.verified} 个。`
          : `高频考点对照：已验证 ${archive.verified} 个。`}
      </p>
    </div>
  );
}

function Bucket({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'ok' | 'warn';
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        tone === 'warn'
          ? 'border-[rgba(161,98,7,0.3)] bg-[rgba(161,98,7,0.08)]'
          : tone === 'ok'
            ? 'border-[rgba(31,107,74,0.25)] bg-[rgba(31,107,74,0.08)]'
            : 'surface'
      }`}
    >
      <p className="text-[11px] text-[var(--muted)]">{label}</p>
      <p
        className={`font-brand mt-1 text-2xl tabular-nums ${
          tone === 'warn' ? 'text-[var(--warn)]' : tone === 'ok' ? 'text-[var(--ok)]' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}
