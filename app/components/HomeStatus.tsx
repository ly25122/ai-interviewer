'use client';

import { useMemo, useSyncExternalStore } from 'react';
import {
  getProgressServerSnapshot,
  getProgressSnapshot,
  subscribeProgress,
  summarize,
} from '@/lib/progress';

function formatDay(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function HomeStatus() {
  const records = useSyncExternalStore(
    subscribeProgress,
    getProgressSnapshot,
    getProgressServerSnapshot,
  );
  const summary = useMemo(() => summarize(records), [records]);
  const last = records.at(-1);

  let eyebrow = '近期状况';
  let headline = '还没开过一场';
  let body = '不知道这家怎么考，是最耗人的。先把情报凑齐，再针对性开练。';

  if (summary.today.count > 0) {
    eyebrow = '今天';
    if (summary.today.collapsed > summary.today.verified) {
      headline = '今天被追问打回来了';
      body = `练了 ${summary.today.count} 个点，经不起追问 ${summary.today.collapsed} 个。这不是丢人，是终于知道该补哪。`;
    } else if (summary.today.verified > 0) {
      headline = '今天撑住了几轮';
      body = `练了 ${summary.today.count} 个点，已验证 ${summary.today.verified} 个。别停，把剩下的缺口补完。`;
    } else {
      headline = '今天开练了';
      body = `练了 ${summary.today.count} 个点。回头看复盘，比再刷一堆面经有用。`;
    }
  } else if (summary.streak > 1) {
    eyebrow = '连续在练';
    headline = `已经连续 ${summary.streak} 天`;
    body = last
      ? `上次练到「${last.pointTitle}」。回来接着补，比重新开始轻松。`
      : '节奏在，别断。';
  } else if (last) {
    eyebrow = formatDay(last.at);
    headline = '有一阵没练了';
    body = `上次是「${last.pointTitle}」。捡起来从缺口开始，不必重头再来。`;
  }

  return (
    <aside className="flex h-full min-h-[280px] flex-col justify-between rounded-xl border border-white/12 bg-white/[0.04] p-6 sm:p-8">
      <div>
        <p className="text-xs tracking-[0.2em] text-[#7dbaa8]">{eyebrow}</p>
        <h2 className="font-brand mt-4 text-[clamp(1.6rem,4vw,2.4rem)] leading-tight text-white">
          {headline}
        </h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-white/65">{body}</p>
      </div>

      <div className="mt-10">
        <p className="text-[11px] tracking-[0.16em] text-white/35">近 7 天</p>
        <div className="mt-3 flex items-end gap-2">
          {summary.week.map((d) => {
            const today = d.date === summary.today.date;
            const h = d.count === 0 ? 8 : Math.min(36, 10 + d.count * 8);
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                <span
                  className={`w-full rounded-sm ${
                    d.count === 0
                      ? 'bg-white/10'
                      : today
                        ? 'bg-[#7dbaa8]'
                        : 'bg-white/35'
                  }`}
                  style={{ height: h }}
                  title={`${d.date} · ${d.count} 次`}
                />
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-white/40">
          {summary.totalCount > 0
            ? `一共练过 ${summary.totalCount} 个点${summary.streak > 0 ? ` · 连续 ${summary.streak} 天` : ''}`
            : '练过之后，这里会记下你撑没撑住。'}
        </p>
      </div>
    </aside>
  );
}
