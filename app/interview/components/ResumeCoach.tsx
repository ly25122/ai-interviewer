'use client';

import { useEffect, useState } from 'react';
import { demoEdits } from '@/lib/interview-demo';
import type { IntelligenceItem, ResumeEdit } from '@/lib/types';

const EDIT_KIND: Record<ResumeEdit['kind'], { label: string; tone: string }> = {
  strengthen: { label: '写实一点', tone: 'bg-[rgba(31,107,74,0.12)] text-[var(--ok)]' },
  soften: { label: '收一收', tone: 'bg-[rgba(161,98,7,0.12)] text-[var(--warn)]' },
  add: { label: '补一条', tone: 'bg-[rgba(37,99,235,0.12)] text-[#2f6df0]' },
  cut: { label: '建议删', tone: 'bg-[rgba(159,45,58,0.1)] text-[var(--danger)]' },
};

function applyEdit(resume: string, edit: ResumeEdit): string {
  if (edit.kind === 'cut' && edit.target && resume.includes(edit.target)) {
    return resume.replace(edit.target, '').replace(/\n{3,}/g, '\n\n').trim();
  }
  if (edit.target && resume.includes(edit.target)) {
    return resume.replace(edit.target, edit.suggestion);
  }
  if (edit.kind === 'add' || !edit.target) {
    return `${resume.trim()}\n\n${edit.suggestion}`;
  }
  return `${resume.trim()}\n\n${edit.suggestion}`;
}

export function ResumeCoach({
  resume,
  jd,
  intel,
  demo,
  debrief,
  onApply,
  onViewResume,
  onBackToSession,
}: {
  resume: string;
  jd: string;
  intel: IntelligenceItem[];
  demo: boolean;
  debrief?: string;
  onApply: (next: string) => void;
  onViewResume: () => void;
  onBackToSession: () => void;
}) {
  const [edits, setEdits] = useState<ResumeEdit[] | null>(demo ? demoEdits : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState(resume);
  const [showDraft, setShowDraft] = useState(false);

  useEffect(() => {
    setDraft(resume);
  }, [resume]);

  const appliedCount = Object.values(applied).filter(Boolean).length;

  async function load() {
    if (demo) {
      setEdits(demoEdits);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/interview/revise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume, jd, intelligence: intel, debrief }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? '生成失败');
      setEdits(data.edits as ResumeEdit[]);
      setApplied({});
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成修改建议失败');
    } finally {
      setLoading(false);
    }
  }

  function applyOne(edit: ResumeEdit) {
    const next = applyEdit(draft, edit);
    setDraft(next);
    onApply(next);
    setApplied((p) => ({ ...p, [edit.id]: true }));
    setShowDraft(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBackToSession}
          className="btn-ghost rounded-md px-3 py-1.5 text-xs"
        >
          ← 返回本场复盘
        </button>
      </div>

      <div className="surface rounded-lg p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium">对照这场面试改简历</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              点「应用到简历」会立刻写入本场材料，下一轮训练用新版本。可连续点多条。
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="btn-ghost rounded-md px-3 py-1.5 text-xs"
          >
            {loading ? '正在对照…' : edits ? '重新生成建议' : '生成修改建议'}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}

        {appliedCount > 0 && (
          <div className="mt-4 rounded-lg border border-[var(--ok)]/35 bg-[rgba(31,107,74,0.08)] px-4 py-3">
            <p className="text-sm font-medium text-[var(--ok)]">
              已把 {appliedCount} 条改动写入本场简历
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
              不会下载文件。回到「这场面试」能看到更新后的文本；再练一轮会按新简历出题。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onViewResume}
                className="btn-primary rounded-md px-4 py-2 text-xs"
              >
                去这场面试查看简历
              </button>
              <button
                type="button"
                onClick={() => setShowDraft((v) => !v)}
                className="btn-ghost rounded-md px-3 py-1.5 text-xs"
              >
                {showDraft ? '收起当前简历' : '预览当前简历'}
              </button>
            </div>
          </div>
        )}

        {showDraft && (
          <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-[var(--line)] bg-[var(--paper-lift)] p-3 text-xs leading-relaxed">
            {draft}
          </pre>
        )}

        {edits && (
          <ul className="mt-4 space-y-3">
            {edits.map((edit) => {
              const meta = EDIT_KIND[edit.kind];
              return (
                <li key={edit.id} className="rounded-md border border-[var(--line)] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${meta.tone}`}>
                      {meta.label}
                    </span>
                    <span className="text-xs text-[var(--muted)]">{edit.reason}</span>
                  </div>
                  {edit.target && (
                    <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
                      <span className="text-[var(--muted)]">原文：</span>
                      {edit.target}
                    </p>
                  )}
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink)]">
                    <span className="text-[var(--muted)]">建议：</span>
                    {edit.suggestion}
                  </p>
                  <button
                    type="button"
                    disabled={applied[edit.id]}
                    onClick={() => applyOne(edit)}
                    className={`mt-3 rounded-md px-4 py-2 text-xs font-medium ${
                      applied[edit.id]
                        ? 'bg-black/8 text-[var(--muted)]'
                        : 'btn-primary'
                    }`}
                  >
                    {applied[edit.id] ? '已应用到简历' : edit.kind === 'cut' ? '从简历删掉' : '应用到简历'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
