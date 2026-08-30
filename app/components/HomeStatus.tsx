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
  const archives = useSyncExternalStore(
    subscribeHistory,
    getHistorySnapshot,
    getHistoryServerSnapshot,
  );
  const summary = useMemo(() => summarize(records), [records]);
  const last = records.at(-1);
  const lastArchive = archives[0];
  const recent = archives.slice(0, 3);

  let eyebrow = '准备进度';
  let headline = '尚未开始';
  let body = '指定目标公司与岗位后，即可收集面经并开始训练。';

  if (lastArchive) {
    eyebrow = formatArchiveTime(lastArchive.at);
    headline = lastArchive.company;
    body =
      lastArchive.shaky > lastArchive.verified
        ? `「${lastArchive.role}」仍有 ${lastArchive.shaky} 个考点需加强，可回看当场问答。`
        : `「${lastArchive.role}」已验证 ${lastArchive.verified} 个考点。建议优先回看当场记录。`;
  } else if (summary.today.count > 0) {
    eyebrow = '今日';
    if (summary.today.collapsed > summary.today.verified) {
      headline = '今日训练：追问未通过较多';
      body = `已练习 ${summary.today.count} 个考点，其中 ${summary.today.collapsed} 个经不起追问。可从复盘中查看具体缺口。`;
    } else if (summary.today.verified > 0) {
      headline = '今日已验证部分考点';
      body = `已练习 ${summary.today.count} 个考点，其中 ${summary.today.verified} 个已通过追问。`;
    } else {
      headline = '今日已开始训练';
      body = `已练习 ${summary.today.count} 个考点。完成后可在复盘中查看问答记录。`;
    }
  } else if (summary.streak > 1) {
    eyebrow = '连续训练';
    headline = `已连续 ${summary.streak} 天`;
    body = last
      ? `上次练习「${last.pointTitle}」。可从尚未覆盖或需加强的考点继续。`
      : `已连续训练 ${summary.streak} 天。`;
  } else if (last) {
    eyebrow = formatDay(last.at);
    headline = '距上次训练已有间隔';
    body = `上次练习「${last.pointTitle}」。可从缺口继续，不必重新收集情报。`;
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
        {recent.length > 0 ? (
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[11px] tracking-[0.16em] text-white/35">往期复盘</p>
              <Link href="/history" className="text-[11px] text-[#7dbaa8] hover:text-white">
                全部 {archives.length} 场 →
              </Link>
            </div>
            <ul className="mt-3 space-y-2">
              {recent.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/history?id=${encodeURIComponent(a.id)}`}
                    className="block rounded-md border border-white/10 bg-white/[0.03] px-3 py-2.5 transition hover:border-white/25"
                  >
                    <p className="text-[11px] text-white/40">{formatArchiveTime(a.at)}</p>
                    <p className="mt-0.5 truncate text-sm text-white/85">
                      {a.company} · {a.role}
                    </p>
                    <p className="mt-1 text-[11px] text-white/45">
                      已验证 {a.verified} · 需加强 {a.shaky} · 均分 {a.avgScore}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
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
                ? `累计练习 ${summary.totalCount} 个考点${summary.streak > 0 ? ` · 连续 ${summary.streak} 天` : ''}`
                : '训练记录保存在本机，不会上传。'}
            </p>
          </>
        )}
      </div>
    </aside>
  );
}
