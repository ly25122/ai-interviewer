'use client';

import { useState } from 'react';
import type { PracticeDifficulty, PracticePrefs, Syllabus, TrainingMode } from '@/lib/types';
import { ErrorNote } from './shared';

const DURATIONS = [15, 25, 40];
const COUNTS = [4, 6, 8];
const DIFFS: Array<{ id: PracticeDifficulty; label: string; hint: string }> = [
  { id: 'easy', label: '舒适', hint: '先问做过的部分' },
  { id: 'medium', label: '常规', hint: '机制问清再追一层' },
  { id: 'hard', label: '加压', hint: '多追失败路径和口径' },
];

export function PracticeLauncher({
  company,
  role,
  intelCount,
  syllabus,
  loading,
  error,
  prefs,
  onStart,
  onBack,
}: {
  company: string;
  role: string;
  intelCount: number;
  syllabus?: Syllabus;
  loading: boolean;
  error: string;
  prefs: PracticePrefs;
  onStart: (mode: TrainingMode, prefs: PracticePrefs) => void;
  onBack: () => void;
}) {
  const [durationMin, setDurationMin] = useState(prefs.durationMin);
  const [questionCount, setQuestionCount] = useState(prefs.questionCount);
  const [difficulty, setDifficulty] = useState<PracticeDifficulty>(prefs.difficulty);
  const next: PracticePrefs = { durationMin, questionCount, difficulty };
  const topics = syllabus?.topics.length ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-brand text-2xl leading-tight">
          {company} · {role}
        </h1>
        <p className="mt-1 text-xs text-[var(--muted)]">
          先定时长、题量和难度，再选练法。提纲按你的简历、选拔要求和情报出。
        </p>
      </div>

      <div className="surface grid gap-4 rounded-lg p-4 sm:grid-cols-3">
        <fieldset>
          <legend className="text-[11px] text-[var(--muted)]">时长</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DURATIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDurationMin(n)}
                className={`rounded-md px-2.5 py-1 text-xs ${
                  durationMin === n
                    ? 'bg-[var(--ink)] text-[var(--paper)]'
                    : 'border border-[var(--line)] text-[var(--muted)]'
                }`}
              >
                {n} 分钟
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-[11px] text-[var(--muted)]">题目数量</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setQuestionCount(n)}
                className={`rounded-md px-2.5 py-1 text-xs ${
                  questionCount === n
                    ? 'bg-[var(--ink)] text-[var(--paper)]'
                    : 'border border-[var(--line)] text-[var(--muted)]'
                }`}
              >
                {n} 题
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-[11px] text-[var(--muted)]">难度</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DIFFS.map((d) => (
              <button
                key={d.id}
                type="button"
                title={d.hint}
                onClick={() => setDifficulty(d.id)}
                className={`rounded-md px-2.5 py-1 text-xs ${
                  difficulty === d.id
                    ? 'bg-[var(--ink)] text-[var(--paper)]'
                    : 'border border-[var(--line)] text-[var(--muted)]'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => onStart('full', next)}
          className="surface rounded-lg p-5 text-left transition hover:border-[var(--accent)]"
        >
          <p className="text-xs text-[var(--accent)]">完整模拟</p>
          <p className="mt-2 font-brand text-2xl">按真实面试走一遍</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            {durationMin} 分钟 · {questionCount} 题 · {DIFFS.find((d) => d.id === difficulty)?.label}
            。题目覆盖面经考点、经历已覆盖、经历待核实与要求未覆盖。
          </p>
        </button>
        <button
          type="button"
          disabled={loading || intelCount === 0}
          onClick={() => onStart('intel', next)}
          className="surface rounded-lg p-5 text-left transition hover:border-[var(--accent)]"
        >
          <p className="text-xs text-[var(--accent)]">情报针对训练</p>
          <p className="mt-2 font-brand text-2xl">只练这场爱考的</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            {topics > 0
              ? `围绕已聚合的 ${topics} 个高频考点，出 ${questionCount} 题。`
              : intelCount > 0
                ? `已有 ${intelCount} 条情报，优先问里面反复出现的点。`
                : '需要先收集情报。'}
          </p>
        </button>
      </div>

      {loading && <p className="text-sm text-[var(--muted)]">正在按这份材料出题…</p>}
      <ErrorNote error={error} />

      <button type="button" onClick={onBack} className="btn-ghost rounded-md px-4 py-2.5 text-sm">
        返回考情画像
      </button>
    </div>
  );
}
