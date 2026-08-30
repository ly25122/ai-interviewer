'use client';

import { useState } from 'react';
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
}: {
  resume: string;
  jd: string;
  intel: IntelligenceItem[];
  demo: boolean;
  debrief?: string;
  onApply: (next: string) => void;
}) {
  const [edits, setEdits] = useState<ResumeEdit[] | null>(demo ? demoEdits : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState<Record<string, boolean>>({});

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

  return (
    <div className="surface rounded-lg p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">对照岗位改简历</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            把虚的收一收、缺口补上、自己讲不清的别写。改完的文本会直接用于模拟面试。
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
                  onClick={() => {
                    onApply(applyEdit(resume, edit));
                    setApplied((p) => ({ ...p, [edit.id]: true }));
                  }}
                  className="mt-2 text-xs text-[#2f6df0] hover:underline disabled:text-[var(--muted)]"
                >
                  {applied[edit.id] ? '已应用到简历' : edit.kind === 'cut' ? '从简历删掉' : '应用到简历'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
