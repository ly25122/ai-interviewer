'use client';

import { ProgressPanel } from '@/app/components/ProgressPanel';
import { CoverageRing, StackedMeter } from '@/app/components/ProgressViz';
import type {
  IntelligenceItem,
  InterviewPlan,
  PracticeRecord,
  ReadinessMap,
  ResumeInterviewSession,
} from '@/lib/types';
import { ResumeCoach } from './ResumeCoach';

export function ReviewPanel({
  company,
  role,
  readiness,
  plan,
  sessions,
  records,
  resume,
  jd,
  intel,
  demo,
  onApplyResume,
  onRestart,
  onContinue,
  onTrainAgain,
}: {
  company: string;
  role: string;
  readiness: ReadinessMap;
  plan: InterviewPlan | null;
  sessions: Record<string, ResumeInterviewSession>;
  records: PracticeRecord[];
  resume: string;
  jd: string;
  intel: IntelligenceItem[];
  demo: boolean;
  onApplyResume: (next: string) => void;
  onRestart: () => void;
  onContinue: () => void;
  onTrainAgain: () => void;
}) {
  const verified = readiness.cells.filter((c) => c.status === 'verified').length;
  const shaky = readiness.cells.filter((c) => c.status === 'shaky').length;
  const uncovered = readiness.cells.filter(
    (c) => c.status === 'unrated' || c.status === 'gap',
  ).length;
  const incomplete = plan ? plan.points.some((p) => !sessions[p.id]) : false;
  const debrief = (plan?.points ?? [])
    .map((p) => {
      const s = sessions[p.id];
      if (!s) return `· ${p.title}：未开始`;
      return `· ${p.title}：${s.outcome === 'verified' ? '经得起追问' : `第 ${s.collapsedAtTurn} 轮经不起追问`}`;
    })
    .join('\n');

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-3 lg:sticky lg:top-4">
        <div>
          <h1 className="font-brand text-2xl leading-tight">
            {company} · {role}
          </h1>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {readiness.total > 0
              ? `高频考点 ${readiness.total} 个，已验证 ${verified} 个。`
              : '还没有可对照的考点。'}
          </p>
        </div>

        <div className="surface rounded-lg p-4">
          <CoverageRing
            value={verified}
            max={Math.max(1, readiness.total)}
            label="已验证"
            caption={`经不起追问 ${shaky} · 尚未覆盖 ${uncovered}`}
            tone={verified > 0 && shaky === 0 ? 'ok' : 'accent'}
          />
          <div className="mt-4">
            <StackedMeter
              label="准备度"
              segments={[
                { value: verified, tone: 'ok', title: '已验证' },
                { value: shaky, tone: 'warn', title: '需加强' },
                { value: uncovered, tone: 'muted', title: '尚未覆盖' },
              ]}
              hint="不看平均分，只看哪几个点还没站住。"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Bucket label="已验证" value={verified} tone="ok" />
          <Bucket label="经不起" value={shaky} tone="warn" />
          <Bucket label="未覆盖" value={uncovered} />
        </div>

        <div className="flex flex-wrap gap-2">
          {incomplete && (
            <button type="button" onClick={onContinue} className="btn-primary rounded-md px-4 py-2 text-xs">
              继续未完成的题
            </button>
          )}
          <button type="button" onClick={onTrainAgain} className="btn-primary rounded-md px-4 py-2 text-xs">
            再练一轮
          </button>
          <button type="button" onClick={onRestart} className="btn-ghost rounded-md px-4 py-2 text-xs">
            换一个目标岗位
          </button>
        </div>
      </aside>

      <section className="space-y-4">
        <div className="surface rounded-lg p-4">
          <p className="text-sm font-medium">今天不用继续刷题。只补这 3 个：</p>
          {readiness.nextThree.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">当前没有必须补的缺口。</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {readiness.nextThree.map((a, i) => (
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

        <ProgressPanel records={records} compact />

        <ResumeCoach
          resume={resume}
          jd={jd}
          intel={intel}
          demo={demo}
          debrief={debrief}
          onApply={onApplyResume}
        />
      </section>
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
