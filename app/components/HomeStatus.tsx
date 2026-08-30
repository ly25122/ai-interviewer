'use client';

import { useMemo, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  formatArchiveTime,
  getHistoryServerSnapshot,
  getHistorySnapshot,
  subscribeHistory,
} from '@/lib/history';
import {
  getProgressServerSnapshot,
  getProgressSnapshot,
  subscribeProgress,
  summarize,
} from '@/lib/progress';
import type { ReviewArchive } from '@/lib/types';

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8.5V12l2.4 1.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function FireIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-[#ffb45c]" fill="currentColor" aria-hidden>
      <path d="M12 3c2.2 3.4 1.4 5.6.2 7.1 2.2-.5 4.6.6 5.8 2.8 1.4 2.5.6 6-2.4 7.5-2.8 1.5-6.4.5-8-2.2C5.9 15.6 6.2 12.2 8.6 10c-1.8 2.8.2 5.2 1.6 6.1C8.4 13.4 9.6 8.6 12 3Z" />
    </svg>
  );
}

function BulbIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-[#f4d35e]" fill="none" aria-hidden>
      <path
        d="M9 18h6M10 21h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M8.2 14.6c-1.8-1.4-2.7-3.4-2.2-5.4C6.6 6.6 9 4.8 12 4.8s5.4 1.8 6 4.3c.5 2-.4 4-2.2 5.5-.6.5-1 1.2-1.1 2H9.3c-.1-.8-.5-1.5-1.1-2.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-3.5 text-white/30" fill="none" aria-hidden>
      <path d="M9 6.5 15 12l-6 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function companyInitial(name: string) {
  const ch = name.trim().charAt(0);
  return ch || '面';
}

function avatarTone(name: string) {
  const palettes = [
    'from-[#1f6b58] to-[#2ea37e]',
    'from-[#1a5f7a] to-[#2d8fb8]',
    'from-[#3d5a40] to-[#5d8a4e]',
    'from-[#5a4a1f] to-[#c4a035]',
  ];
  let n = 0;
  for (const c of name) n += c.charCodeAt(0);
  return palettes[n % palettes.length];
}

function hotLine(archive: ReviewArchive) {
  const titles = archive.nextThree.map((a) => a.title).filter(Boolean);
  if (titles.length > 0) return titles.slice(0, 2).join(' · ');
  const shaky = archive.points.filter((p) => p.outcome === 'collapsed').map((p) => p.title);
  return shaky.slice(0, 2).join(' · ') || '回看当场问答，标出还没站住的点';
}

function nextAdvice(archive: ReviewArchive) {
  const first = archive.nextThree[0];
  if (first?.reason) return first.reason;
  if (first?.title) return `把「${first.title}」补成自己能讲清的路径`;
  if (archive.shaky > 0) return '先回看被追回来的那几问，下一场专攻缺口。';
  return '下一场从尚未覆盖的考点继续即可。';
}

export function HomeStatus() {
  const records = useSyncExternalStore(
    subscribeProgress,
    getProgressSnapshot,
    getProgressServerSnapshot,
  );
  const archives = useSyncExternalStore(
    subscribeHistory,
    getHistorySnapshot,
    getHistoryServerSnapshot,
  );
  const summary = useMemo(() => summarize(records), [records]);
  const lastArchive = archives[0];
  const older = archives.slice(1, 4);

  return (
    <aside className="flex h-full flex-col justify-between gap-5 py-1">
      <div>
        <p className="text-[13px] text-white/55">最近备战</p>
        {lastArchive ? (
          <RecentCard archive={lastArchive} />
        ) : (
          <EmptyRecent todayCount={summary.today.count} streak={summary.streak} />
        )}
      </div>

      <div>
        <p className="text-[13px] text-white/55">历史备战</p>
        {older.length > 0 ? (
          <ul className="mt-3 divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03] px-1">
            {older.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/history?id=${encodeURIComponent(a.id)}`}
                  className="flex items-center gap-3 px-3 py-3.5 transition hover:bg-white/[0.04]"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-semibold text-white ${avatarTone(a.company)}`}
                  >
                    {companyInitial(a.company)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-white/90">
                      {a.company} · {a.role}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-white/35">{formatArchiveTime(a.at)}</span>
                  <ChevronIcon />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-xs leading-relaxed text-white/40">
            {lastArchive
              ? '再练完一场，往期会按时间列在这里。'
              : '训练记录只留在这台设备上。走完一场后，公司和岗位会出现在这里。'}
          </p>
        )}
      </div>
    </aside>
  );
}

function RecentCard({ archive }: { archive: ReviewArchive }) {
  return (
    <div className="mt-3 rounded-2xl border border-white/12 bg-[linear-gradient(180deg,rgba(28,92,78,0.38),rgba(12,28,26,0.55))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <p className="flex items-center gap-1.5 text-xs text-white/50">
        <ClockIcon />
        {formatArchiveTime(archive.at)}
      </p>
      <h2 className="mt-3 text-[1.65rem] font-semibold leading-tight tracking-tight text-white">
        {archive.company}
      </h2>
      <p className="mt-1 text-sm text-white/70">{archive.role}</p>
      <p className="mt-3 text-xs leading-relaxed text-white/55">
        已验证 {archive.verified} 个考点 · 待加强 {archive.shaky} 个
        {archive.uncovered > 0 ? ` · 尚未覆盖 ${archive.uncovered} 个` : ''}
      </p>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-white/80">
          <FireIcon />
          <span>
            <span className="text-white/45">近期高频</span>
            <span className="ml-2 text-white/85">{hotLine(archive)}</span>
          </span>
        </p>
      </div>
      <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-white/70">
        <BulbIcon />
        <span>
          <span className="text-white/45">下一步建议</span>
          <span className="ml-2">{nextAdvice(archive)}</span>
        </span>
      </p>

      <div className="mt-5 flex justify-end">
        <Link
          href="/interview"
          className="inline-flex items-center rounded-full border border-white/20 bg-white/8 px-4 py-1.5 text-xs text-white/85 transition hover:border-white/40 hover:bg-white/12"
        >
          继续备战 →
        </Link>
      </div>
    </div>
  );
}

function EmptyRecent({ todayCount, streak }: { todayCount: number; streak: number }) {
  return (
    <div className="mt-3 rounded-2xl border border-white/12 bg-[linear-gradient(180deg,rgba(28,92,78,0.28),rgba(12,28,26,0.5))] p-5">
      <p className="flex items-center gap-1.5 text-xs text-white/50">
        <ClockIcon />
        还没有本场记录
      </p>
      <h2 className="mt-3 text-[1.65rem] font-semibold leading-tight text-white">尚未开始</h2>
      <p className="mt-2 text-sm leading-relaxed text-white/60">
        指定目标公司与岗位后，即可收集面经并开始训练。
        {todayCount > 0
          ? ` 今天已练过 ${todayCount} 个考点。`
          : streak > 1
            ? ` 已连续 ${streak} 天有过训练。`
            : ''}
      </p>
      <div className="mt-5 flex justify-end">
        <Link
          href="/interview"
          className="inline-flex items-center rounded-full border border-white/20 bg-white/8 px-4 py-1.5 text-xs text-white/85 transition hover:border-white/40"
        >
          开始备战 →
        </Link>
      </div>
    </div>
  );
}
