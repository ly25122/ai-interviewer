'use client';

import sample from '@/lib/interview-sample.json';
import { ErrorNote, JD_MIN_CHARS, MaterialCard, RESUME_MIN_CHARS } from './shared';

export function SetupPanel({
  company,
  role,
  resume,
  jd,
  parsing,
  error,
  demo,
  onCompany,
  onRole,
  onResume,
  onJd,
  onImport,
  onDemo,
  onSample,
  onNext,
}: {
  company: string;
  role: string;
  resume: string;
  jd: string;
  parsing: 'resume' | 'jd' | null;
  error: string;
  demo: boolean;
  onCompany: (v: string) => void;
  onRole: (v: string) => void;
  onResume: (v: string) => void;
  onJd: (v: string) => void;
  onImport: (which: 'resume' | 'jd', file: File) => void;
  onDemo: () => void;
  onSample: () => void;
  onNext: () => void;
}) {
  const resumeReady = resume.trim().length >= RESUME_MIN_CHARS;
  const jdReady = jd.trim().length >= JD_MIN_CHARS;
  const targetReady = company.trim().length >= 2 && role.trim().length >= 2;
  const canNext = resumeReady && jdReady && targetReady && !parsing;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-brand text-2xl leading-tight">下一场要面什么</h1>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {demo
              ? '演示已放入字节电商交易组。下一步去看这场怎么考。'
              : '实习、夏令营都可以。去向、方向、简历和选拔要求都要有，一场一场准备。'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onDemo} className="btn-ghost rounded-md px-3 py-1.5 text-xs">
            先看演示
          </button>
          <button
            type="button"
            onClick={onSample}
            className="btn-primary rounded-md px-4 py-2 text-sm font-medium"
          >
            填入示例
          </button>
        </div>
      </div>

      {!resume.trim() && !jd.trim() && !demo && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-[var(--accent)] bg-[rgba(31,122,102,0.08)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--ink)]">还没有自己的材料</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              可先填入一份电商后端实习示例，再走收集情报与训练。
            </p>
          </div>
          <button
            type="button"
            onClick={onSample}
            className="btn-primary shrink-0 rounded-md px-4 py-2 text-sm font-medium"
          >
            填入示例
          </button>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="text-[11px] text-[var(--muted)]">去向</span>
          <input
            value={company}
            onChange={(e) => onCompany(e.target.value)}
            placeholder="如「字节跳动」或「清华夏令营」"
            className="field mt-1 w-full rounded-md px-3 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-[11px] text-[var(--muted)]">方向</span>
          <input
            value={role}
            onChange={(e) => onRole(e.target.value)}
            placeholder="如「后端实习」或「计算机营」"
            className="field mt-1 w-full rounded-md px-3 py-1.5 text-sm"
          />
        </label>
        <div className="flex items-end sm:col-span-2">
          <button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            className="btn-primary w-full rounded-md px-4 py-2 text-sm font-medium"
          >
            下一步：收集面试情报 →
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <MaterialCard
          key={demo ? 'resume-demo' : 'resume-own'}
          step="你的简历"
          label="用来对照要求和情报"
          value={resume}
          ready={resumeReady}
          minLen={80}
          parsing={parsing === 'resume'}
          onChange={onResume}
          onImport={(file) => onImport('resume', file)}
          pastePlaceholder="粘贴或上传简历。训练和复盘都会用这份。"
          readyHint="可以进入下一步"
          waitHint="再补一点项目或实习细节"
          defaultMode="paste"
          compact
        />
        <MaterialCard
          key={demo ? 'jd-demo' : 'jd-own'}
          step="选拔要求"
          label="JD、招生简章或考核说明"
          value={jd}
          ready={jdReady}
          minLen={40}
          parsing={parsing === 'jd'}
          onChange={onJd}
          onImport={(file) => onImport('jd', file)}
          pastePlaceholder="粘贴 JD、招生简章或考核说明：考什么、要什么、怎么评"
          readyHint="选拔要求已能对照"
          waitHint="把选拔要求也贴进来"
          defaultMode="paste"
          compact
        />
      </div>

      <p className="text-[11px] text-[var(--muted)]">
        {canNext
          ? '目标已锁定。'
          : `去向、方向、简历、选拔要求都齐了才能继续。${sample ? '示例来自一份电商后端实习材料。' : ''}`}
      </p>

      <ErrorNote error={error} />
    </div>
  );
}
