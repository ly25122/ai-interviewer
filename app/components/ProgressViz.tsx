/**
 * 焦虑来自不确定。这组可视化只做一件事：让人随时看见自己在哪、还剩多少。
 * 不给虚假满分，数字必须来自真实进度。
 */

export interface JourneyStep {
  id: string;
  label: string;
}

export function JourneyBar({
  steps,
  current,
  compact = false,
}: {
  steps: JourneyStep[];
  current: string;
  compact?: boolean;
}) {
  const idx = Math.max(
    0,
    steps.findIndex((s) => s.id === current),
  );

  return (
    <ol className="flex items-start gap-0" aria-label="当前进度">
      {steps.map((step, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={step.id} className="flex min-w-0 flex-1 items-start">
            <div className="flex min-w-0 flex-col items-center text-center">
              <span
                className={`flex items-center justify-center rounded-full font-medium transition ${
                  compact ? 'h-5 w-5 text-[10px]' : 'h-7 w-7 text-xs'
                } ${
                  done
                    ? 'bg-[var(--accent)] text-white'
                    : active
                      ? 'bg-[var(--ink)] text-[var(--paper)]'
                      : 'bg-black/8 text-[var(--muted)]'
                }`}
              >
                {done ? '✓' : i + 1}
              </span>
              <span
                className={`leading-tight ${
                  compact ? 'mt-0.5 text-[10px]' : 'mt-1.5 text-[11px]'
                } ${active ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mx-1 flex-1 ${compact ? 'mt-2.5 h-px' : 'mt-3 h-px'} ${
                  i < idx ? 'bg-[var(--accent)]' : 'bg-black/10'
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function Meter({
  label,
  value,
  max,
  hint,
  tone = 'accent',
}: {
  label: string;
  value: number;
  max: number;
  hint?: string;
  tone?: 'accent' | 'ok' | 'warn';
}) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  const bar =
    tone === 'ok' ? 'bg-[var(--ok)]' : tone === 'warn' ? 'bg-[var(--warn)]' : 'bg-[var(--accent)]';

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-[var(--muted)]">{label}</span>
        <span className="font-brand text-sm tabular-nums">
          {value}
          <span className="text-[var(--muted)]"> / {max}</span>
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/8">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {hint && <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

export function CoverageRing({
  value,
  max,
  label,
  caption,
  tone = 'accent',
}: {
  value: number;
  max: number;
  label: string;
  caption?: string;
  tone?: 'accent' | 'ok' | 'warn';
}) {
  const pct = max <= 0 ? 0 : Math.min(1, value / max);
  const r = 36;
  const c = 2 * Math.PI * r;
  const color =
    tone === 'ok' ? 'var(--ok)' : tone === 'warn' ? 'var(--warn)' : 'var(--accent)';

  return (
    <div className="flex items-center gap-4">
      <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden>
        <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(15,23,20,0.08)" strokeWidth="8" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform="rotate(-90 48 48)"
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
        <text
          x="48"
          y="46"
          textAnchor="middle"
          className="font-brand"
          fill="var(--ink)"
          fontSize="18"
        >
          {max === 0 ? '—' : `${Math.round(pct * 100)}%`}
        </text>
        <text x="48" y="62" textAnchor="middle" fill="var(--muted)" fontSize="9">
          {label}
        </text>
      </svg>
      {caption && (
        <p className="max-w-[220px] text-xs leading-relaxed text-[var(--muted)]">{caption}</p>
      )}
    </div>
  );
}

export function StackedMeter({
  label,
  segments,
  hint,
}: {
  label: string;
  segments: Array<{ value: number; tone: 'ok' | 'warn' | 'muted' | 'accent'; title: string }>;
  hint?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);

  return (
    <div>
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-black/8">
        {total === 0 ? null : (
          segments.map((seg) =>
            seg.value <= 0 ? null : (
              <div
                key={seg.title}
                title={`${seg.title} ${seg.value}`}
                className={`h-full ${
                  seg.tone === 'ok'
                    ? 'bg-[var(--ok)]'
                    : seg.tone === 'accent'
                      ? 'bg-[var(--accent)]'
                      : seg.tone === 'warn'
                        ? 'bg-[var(--warn)]'
                        : 'bg-black/20'
                }`}
                style={{ width: `${(seg.value / total) * 100}%` }}
              />
            ),
          )
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[var(--muted)]">
        {segments.map((seg) => (
          <span key={seg.title} className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-sm ${
                seg.tone === 'ok'
                  ? 'bg-[var(--ok)]'
                  : seg.tone === 'accent'
                    ? 'bg-[var(--accent)]'
                    : seg.tone === 'warn'
                      ? 'bg-[var(--warn)]'
                      : 'bg-black/20'
              }`}
            />
            {seg.title} {seg.value}
          </span>
        ))}
      </div>
      {hint && <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

export function WeekBars({
  days,
}: {
  days: Array<{ date: string; count: number; avgScore: number }>;
}) {
  const max = Math.max(100, ...days.map((d) => d.avgScore));
  const weekday = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div>
      <p className="text-xs text-[var(--muted)]">近 7 天平均分</p>
      <div className="mt-3 flex items-end gap-2">
        {days.map((d) => {
          const h = d.count === 0 ? 4 : Math.max(8, Math.round((d.avgScore / max) * 72));
          const day = weekday[new Date(`${d.date}T12:00:00`).getDay()] ?? '';
          return (
            <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="text-[10px] tabular-nums text-[var(--muted)]">
                {d.count === 0 ? '—' : d.avgScore}
              </span>
              <div
                className={`w-full max-w-8 rounded-sm ${
                  d.count === 0
                    ? 'bg-black/8'
                    : d.avgScore >= 80
                      ? 'bg-[var(--ok)]'
                      : d.avgScore >= 50
                        ? 'bg-[var(--warn)]'
                        : 'bg-[var(--accent)]'
                }`}
                style={{ height: h }}
                title={`${d.date} · ${d.count} 题 · 均分 ${d.avgScore}`}
              />
              <span className="text-[10px] text-[var(--muted)]">{day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
