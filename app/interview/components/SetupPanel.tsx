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
          <h1 className="font-brand text-2xl leading-tight">这次要面哪一家</h1>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {demo
              ? '演示已放入字节电商交易组。下一步去看这个组怎么考。'
              : '公司、岗位、简历、JD 都要有。后续情报和训练都围着这个目标转。'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onDemo} className="btn-ghost rounded-md px-3 py-1.5 text-xs">
            先看演示
          </button>
          <button type="button" onClick={onSample} className="btn-ghost rounded-md px-3 py-1.5 text-xs">
            填入示例
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="text-[11px] text-[var(--muted)]">公司 / 学校</span>
          <input
            value={company}
            onChange={(e) => onCompany(e.target.value)}
            placeholder="如「字节跳动」"
            className="field mt-1 w-full rounded-md px-3 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-[11px] text-[var(--muted)]">岗位 / 专业</span>
          <input
            value={role}
            onChange={(e) => onRole(e.target.value)}
            placeholder="如「后端开发实习生」"
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
          key={`resume-${demo ? 'demo' : 'own'}-${resume.trim() ? '1' : '0'}`}
          step="你的简历"
          label="用来对照 JD 和情报"
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
          key={`jd-${demo ? 'demo' : 'own'}-${jd.trim() ? '1' : '0'}`}
          step="岗位 JD"
          label="目标岗位描述"
          value={jd}
          ready={jdReady}
          minLen={40}
          parsing={parsing === 'jd'}
          onChange={onJd}
          onImport={(file) => onImport('jd', file)}
          pastePlaceholder="粘贴岗位 JD：职责、任职要求、技术栈"
          readyHint="岗位要求已能对照"
          waitHint="把职位要求也贴进来"
          defaultMode="paste"
          compact
        />
      </div>

      <p className="text-[11px] text-[var(--muted)]">
        {canNext
          ? '目标已锁定。'
          : `公司、岗位、简历、JD 都齐了才能继续。${sample ? '示例来自一份电商后端实习材料。' : ''}`}
      </p>

      <ErrorNote error={error} />
    </div>
  );
}
