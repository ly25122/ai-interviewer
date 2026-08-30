'use client';

import type { IntelligenceItem, IntelSource, Syllabus } from '@/lib/types';
import { ErrorNote, INTEL_SOURCE_META, PhaseNav } from './shared';

const COLORS = ['#1f7a66', '#2f6df0', '#a16207', '#9f2d3a', '#145a4b', '#5c6b64'];

type Slice = { label: string; value: number; color: string };

function polar(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function pieSlice(cx: number, cy: number, r: number, a0: number, a1: number) {
  const start = polar(cx, cy, r, a0);
  const end = polar(cx, cy, r, a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y} Z`;
}

function BarChart({ items }: { items: Slice[] }) {
  const max = Math.max(1, ...items.map((s) => s.value));
  return (
    <ul className="space-y-2">
      {items.map((s) => (
        <li key={s.label}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-xs">{s.label}</span>
            <span className="shrink-0 text-[10px] text-[var(--muted)]">{s.value.toFixed(1)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/8">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(8, (s.value / max) * 100)}%`, background: s.color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function RoseChart({ slices }: { slices: Slice[] }) {
  const cx = 92;
  const cy = 92;
  const max = Math.max(1, ...slices.map((s) => s.value));
  const n = Math.max(1, slices.length);
  return (
    <svg viewBox="0 0 184 184" className="mx-auto h-44 w-44" aria-hidden>
      <circle cx={cx} cy={cy} r={82} fill="none" stroke="rgba(15,23,20,0.08)" />
      {slices.map((s, i) => {
        const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
        const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
        const r = 22 + (s.value / max) * 58;
        return <path key={s.label} d={pieSlice(cx, cy, r, a0, a1)} fill={s.color} opacity="0.88" />;
      })}
      <circle cx={cx} cy={cy} r={16} fill="var(--paper-lift)" />
    </svg>
  );
}

function PieChart({ slices }: { slices: Slice[] }) {
  const cx = 72;
  const cy = 72;
  const r = 62;
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const arcs = slices.reduce<Array<{ s: Slice; a0: number; a1: number }>>((list, s) => {
    const a0 = list.length ? list[list.length - 1].a1 : -Math.PI / 2;
    const a1 = a0 + (s.value / total) * Math.PI * 2;
    list.push({ s, a0, a1 });
    return list;
  }, []);
  return (
    <svg viewBox="0 0 144 144" className="mx-auto h-36 w-44" aria-hidden>
      {arcs.map(({ s, a0, a1 }) => (
        <path key={s.label} d={pieSlice(cx, cy, r, a0, a1)} fill={s.color} />
      ))}
      <circle cx={cx} cy={cy} r={28} fill="var(--paper-lift)" />
    </svg>
  );
}

function Legend({ slices }: { slices: Slice[] }) {
  return (
    <ul className="space-y-1">
      {slices.map((s) => (
        <li key={s.label} className="flex items-center gap-2 text-[11px]">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
          <span className="min-w-0 truncate">{s.label}</span>
          <span className="ml-auto text-[var(--muted)]">{s.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function ProfilePanel({
  company,
  role,
  intel,
  syllabus,
  error,
  onBack,
  onNext,
}: {
  company: string;
  role: string;
  intel: IntelligenceItem[];
  syllabus?: Syllabus;
  error: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const topics = (syllabus?.topics ?? [])
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 8)
    .map((t, i) => ({
      label: t.title,
      value: t.weight,
      color: COLORS[i % COLORS.length],
    }));

  const catMap = new Map<string, number>();
  for (const t of syllabus?.topics ?? []) {
    catMap.set(t.category, (catMap.get(t.category) ?? 0) + t.weight);
  }
  const categories: Slice[] = [...catMap.entries()].map(([label, value], i) => ({
    label,
    value: Math.round(value * 10) / 10,
    color: COLORS[i % COLORS.length],
  }));

  const srcMap = new Map<IntelSource, number>();
  for (const it of intel) {
    srcMap.set(it.source, (srcMap.get(it.source) ?? 0) + 1);
  }
  const sources: Slice[] = [...srcMap.entries()].map(([k, value], i) => ({
    label: INTEL_SOURCE_META[k].label,
    value,
    color: COLORS[i % COLORS.length],
  }));

  const questions = (syllabus?.topics ?? []).flatMap((t) => t.variants).slice(0, 8);
  const siteMap = new Map<string, number>();
  for (const it of intel) {
    const site = it.platform || (it.source === 'paste' ? '手动整理' : it.source === 'file' ? '文件' : '未标注站点');
    siteMap.set(site, (siteMap.get(site) ?? 0) + 1);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-brand text-2xl leading-tight">岗位情报画像</h1>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {company} · {role}
          {syllabus ? ` · 由 ${syllabus.postCount} 条情报聚合` : ''}
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="surface rounded-lg p-3 sm:p-4 lg:col-span-2">
          <p className="text-[11px] tracking-[0.14em] text-[var(--muted)]">高频考点</p>
          {topics.length > 0 ? (
            <div className="mt-3">
              <BarChart items={topics} />
            </div>
          ) : (
            <p className="mt-6 text-xs text-[var(--muted)]">还没有可聚合的考点。</p>
          )}
        </div>

        <div className="surface rounded-lg p-3 sm:p-4">
          <p className="text-[11px] tracking-[0.14em] text-[var(--muted)]">考点方向</p>
          {categories.length > 0 ? (
            <>
              <RoseChart slices={categories} />
              <Legend slices={categories} />
            </>
          ) : (
            <p className="mt-6 text-xs text-[var(--muted)]">聚合后会按方向展开。</p>
          )}
        </div>

        <div className="surface rounded-lg p-3 sm:p-4">
          <p className="text-[11px] tracking-[0.14em] text-[var(--muted)]">情报来源</p>
          {sources.length > 0 ? (
            <div className="mt-2 flex items-center gap-3">
              <PieChart slices={sources} />
              <Legend slices={sources} />
            </div>
          ) : (
            <p className="mt-6 text-xs text-[var(--muted)]">还没有来源。</p>
          )}
        </div>

        <div className="surface rounded-lg p-3 sm:p-4 lg:col-span-2">
          <p className="text-[11px] tracking-[0.14em] text-[var(--muted)]">近期真实问题</p>
          {questions.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {questions.map((q) => (
                <li key={q} className="text-xs leading-relaxed text-[var(--ink)]">
                  · {q}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-xs text-[var(--muted)]">聚合后面经里的原题会出现在这里。</p>
          )}
          {siteMap.size > 0 && (
            <p className="mt-3 text-[10px] text-[var(--muted)]">
              站点：
              {[...siteMap.entries()].map(([k, n]) => `${k} ${n}`).join(' · ')}
            </p>
          )}
        </div>
      </div>

      <ErrorNote error={error} />

      <PhaseNav
        nextLabel="开始针对性训练 →"
        onNext={onNext}
        backLabel="返回面试情报"
        onBack={onBack}
      />
    </div>
  );
}
