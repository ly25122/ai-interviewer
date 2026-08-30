'use client';

import type { Syllabus, TrainingMode } from '@/lib/types';

export function PracticeLauncher({
  company,
  role,
  intelCount,
  syllabus,
  loading,
  error,
  onStart,
  onBack,
}: {
  company: string;
  role: string;
  intelCount: number;
  syllabus?: Syllabus;
  loading: boolean;
  error: string;
  onStart: (mode: TrainingMode) => void;
  onBack: () => void;
}) {
  const topics = syllabus?.topics.length ?? 0;
  return (
    <div className="space-y-8">
      <div className="max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-[var(--accent)]">③ 针对训练</p>
        <h1 className="font-brand mt-2 text-3xl leading-tight sm:text-4xl">
          {company} · {role}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          面试提纲在后台生成，不单独占一步。选一种练法，系统会按简历 × JD × 情报出题。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => onStart('full')}
          className="surface rounded-lg p-5 text-left transition hover:border-[var(--accent)]"
        >
          <p className="text-xs tracking-[0.16em] text-[var(--accent)]">完整模拟</p>
          <p className="mt-2 font-brand text-2xl">按真实面试走一遍</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            情报命中、简历风险、JD 缺口都会问。适合开面之前过一遍。
          </p>
        </button>
        <button
          type="button"
          disabled={loading || intelCount === 0}
          onClick={() => onStart('intel')}
          className="surface rounded-lg p-5 text-left transition hover:border-[var(--accent)]"
        >
          <p className="text-xs tracking-[0.16em] text-[var(--accent)]">情报针对训练</p>
          <p className="mt-2 font-brand text-2xl">只练这个组爱考的</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            {topics > 0
              ? `围绕已聚合的 ${topics} 个高频考点追问。`
              : intelCount > 0
                ? `已有 ${intelCount} 条情报，会优先问里面反复出现的点。`
                : '需要先收集情报。'}
          </p>
        </button>
      </div>

      {loading && <p className="text-sm text-[var(--muted)]">正在按这份材料出题…</p>}
      {error && (
        <p className="rounded-md border border-[rgba(159,45,58,0.25)] bg-[rgba(159,45,58,0.08)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      <button type="button" onClick={onBack} className="btn-ghost rounded-md px-4 py-2.5 text-sm">
        返回情报
      </button>
    </div>
  );
}
