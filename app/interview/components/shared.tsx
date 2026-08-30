'use client';

import { useState } from 'react';
import type { AttackSource, IntelSource, IntelTrust } from '@/lib/types';

export const ACCEPT =
  '.pdf,.docx,.txt,.md,.markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

export const SOURCE_META: Record<AttackSource, { label: string; tone: string }> = {
  intel_hit: {
    label: '情报命中 · 该组考过',
    tone: 'bg-[rgba(37,99,235,0.12)] text-[#2f6df0]',
  },
  resume_match: {
    label: 'JD × 简历重合',
    tone: 'bg-[rgba(31,107,74,0.12)] text-[var(--ok)]',
  },
  resume_risk: {
    label: '简历风险点',
    tone: 'bg-[rgba(161,98,7,0.12)] text-[var(--warn)]',
  },
  jd_gap: {
    label: 'JD 有要求 · 简历弱',
    tone: 'bg-[rgba(159,45,58,0.1)] text-[var(--danger)]',
  },
};

export const INTEL_SOURCE_META: Record<IntelSource, { label: string; tone: string }> = {
  paste: { label: '整理/粘贴', tone: 'bg-[rgba(37,99,235,0.1)] text-[#2f6df0]' },
  file: { label: '文件', tone: 'bg-[rgba(31,107,74,0.12)] text-[var(--ok)]' },
  url: { label: '链接', tone: 'bg-[rgba(161,98,7,0.12)] text-[var(--warn)]' },
  web: { label: '自动检索', tone: 'bg-[rgba(120,120,120,0.14)] text-[var(--muted)]' },
};

export const TRUST_OPTIONS: { value: IntelTrust; label: string }[] = [
  { value: 'high', label: '一手可信（师兄/内部）' },
  { value: 'medium', label: '公开面经' },
  { value: 'low', label: '存疑/可能含广告' },
];

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export async function parseUpload(file: File): Promise<string> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch('/api/interview/parse', { method: 'POST', body });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? '解析失败');
  if (typeof data.text !== 'string' || !data.text.trim()) {
    throw new Error('解析结果为空');
  }
  return data.text as string;
}

export function MaterialCard({
  step,
  label,
  value,
  ready,
  minLen,
  parsing,
  onChange,
  onImport,
  pastePlaceholder,
  readyHint,
  waitHint,
  defaultMode = 'upload',
  tall = false,
}: {
  step: string;
  label: string;
  value: string;
  ready: boolean;
  minLen: number;
  parsing: boolean;
  onChange: (v: string) => void;
  onImport: (file: File) => void;
  pastePlaceholder: string;
  readyHint: string;
  waitHint: string;
  defaultMode?: 'upload' | 'paste';
  tall?: boolean;
}) {
  const [mode, setMode] = useState<'upload' | 'paste'>(defaultMode);
  const [dragOver, setDragOver] = useState(false);
  const box = tall ? 'h-80' : 'h-64';

  return (
    <div className="surface flex flex-col rounded-lg p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] tracking-[0.18em] text-[var(--muted)]">{step}</p>
          <h2 className="text-sm font-medium">{label}</h2>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] ${
            ready
              ? 'bg-[rgba(43,122,74,0.12)] text-[var(--ok,#2b7a4a)]'
              : 'border border-[var(--line)] text-[var(--muted)]'
          }`}
        >
          {ready ? '已就绪' : '待补充'}
        </span>
      </div>

      <div className="mt-3 inline-flex self-start rounded-md border border-[var(--line)] p-0.5 text-xs">
        {(['upload', 'paste'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded px-3 py-1 transition ${
              mode === m
                ? 'bg-[var(--accent)] text-[var(--paper)]'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {m === 'upload' ? '上传文件' : '粘贴文本'}
          </button>
        ))}
      </div>

      <div className="mt-3 flex-1">
        {mode === 'upload' ? (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) onImport(file);
            }}
            className={`flex ${box} cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition ${
              dragOver
                ? 'border-[var(--accent)] bg-[rgba(159,45,58,0.05)]'
                : 'border-[var(--line)] hover:border-[var(--accent)]'
            }`}
          >
            <input
              type="file"
              accept={ACCEPT}
              className="hidden"
              disabled={parsing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImport(file);
                e.target.value = '';
              }}
            />
            {parsing ? (
              <span className="text-sm text-[var(--muted)]">正在解析文件…</span>
            ) : value.trim() ? (
              <>
                <span className="text-sm text-[var(--ink)]">已导入 {value.trim().length} 字</span>
                <span className="mt-1 text-xs text-[var(--muted)]">
                  点击重新上传，或切到「粘贴文本」查看/编辑
                </span>
              </>
            ) : (
              <>
                <span className="text-sm text-[var(--ink)]">拖拽文件到这里，或点击选择</span>
                <span className="mt-1 text-xs text-[var(--muted)]">
                  PDF · Word · TXT · Markdown
                </span>
              </>
            )}
          </label>
        ) : (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={pastePlaceholder}
            className={`field ${box} w-full resize-none rounded-lg p-3.5 text-sm leading-relaxed`}
          />
        )}
      </div>

      <p className="mt-3 text-xs text-[var(--muted)]">
        {ready
          ? readyHint
          : `${waitHint}（还差约 ${Math.max(minLen - value.trim().length, 0)} 字）`}
      </p>
    </div>
  );
}


export function ResumeSheet({
  resume,
  jd,
  defaultOpen = false,
}: {
  resume: string;
  jd?: string;
  defaultOpen?: boolean;
}) {
  const [openResume, setOpenResume] = useState(defaultOpen);
  const [openJd, setOpenJd] = useState(defaultOpen);
  if (!resume.trim() && !jd?.trim()) return null;

  return (
    <div className="surface space-y-4 rounded-lg p-4">
      <p className="text-sm font-medium">这份材料</p>
      {resume.trim() && (
        <div>
          <button
            type="button"
            onClick={() => setOpenResume((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="text-xs font-medium">简历</span>
            <span className="text-xs text-[var(--muted)]">
              {openResume ? '收起' : `展开 · ${resume.trim().length} 字`}
            </span>
          </button>
          {openResume && (
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-[var(--line)] bg-[var(--paper)] p-3 text-xs leading-relaxed text-[var(--ink)]">
              {resume}
            </pre>
          )}
        </div>
      )}
      {jd?.trim() && (
        <div>
          <button
            type="button"
            onClick={() => setOpenJd((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <span className="text-xs font-medium">岗位 JD</span>
            <span className="text-xs text-[var(--muted)]">
              {openJd ? '收起' : `展开 · ${jd.trim().length} 字`}
            </span>
          </button>
          {openJd && (
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-[var(--line)] bg-[var(--paper)] p-3 text-xs leading-relaxed text-[var(--ink)]">
              {jd}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
