'use client';

import { Suspense, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  NextThreeCard,
  PointReplayList,
  ReviewHeadline,
  ReviewStats,
} from '@/app/interview/components/ReviewArchiveView';
import { demoReviewArchive } from '@/lib/interview-demo';
import {
  deleteReviewArchive,
  doneCount,
  formatArchiveTime,
  getHistoryServerSnapshot,
  getHistorySnapshot,
  modeLabel,
  subscribeHistory,
} from '@/lib/history';
import type { ReviewArchive } from '@/lib/types';

export default function HistoryPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-dvh bg-[var(--paper)] text-[var(--ink)]">
          <p className="p-8 text-sm text-[var(--muted)]">载入往期复盘…</p>
        </main>
      }
    >
      <HistoryApp />
    </Suspense>
  );
}

function HistoryApp() {
  const search = useSearchParams();
  const router = useRouter();
  const archives = useSyncExternalStore(
    subscribeHistory,
    getHistorySnapshot,
    getHistoryServerSnapshot,
  );
  const queryId = search.get('id');
  const [previewDemo, setPreviewDemo] = useState(false);
  const [demo, setDemo] = useState<ReviewArchive | null>(null);

  const selected = useMemo(() => {
    if (previewDemo && demo) return demo;
    if (queryId) {
      const hit = archives.find((a) => a.id === queryId);
      if (hit) return hit;
    }
    return archives[0] ?? null;
  }, [archives, queryId, previewDemo, demo]);

  function showDemo() {
    setDemo((prev) => prev ?? demoReviewArchive());
    setPreviewDemo(true);
  }

  function pick(id: string) {
    setPreviewDemo(false);
    router.replace(`/history?id=${encodeURIComponent(id)}`, { scroll: false });
  }

  function remove(id: string) {
    if (!window.confirm('删除这场复盘？问答回放会从这台设备上抹掉，无法恢复。')) return;
    deleteReviewArchive(id);
    if (queryId === id) router.replace('/history', { scroll: false });
  }

  return (
    <main className="min-h-dvh bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[var(--paper-lift)]/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-5 py-2.5">
          <Link href="/" className="shrink-0 font-brand text-lg tracking-tight">
            情报驱动 · 备战
          </Link>
          <p className="min-w-0 flex-1 text-sm text-[var(--muted)]">往期复盘</p>
          <Link href="/interview" className="btn-ghost rounded-md px-3 py-1.5 text-xs">
            继续备战 →
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-5 py-5">
        <div className="grid items-start gap-4 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-3 lg:sticky lg:top-4">
            <p className="text-xs leading-relaxed text-[var(--muted)]">
              记录只存在这台设备上。关掉标签页也不会丢，换浏览器或清缓存会空。
            </p>
            {archives.length === 0 ? (
              <EmptyList previewing={previewDemo} onPreview={showDemo} />
            ) : (
              <ul className="space-y-2">
                {archives.map((a) => (
                  <li key={a.id}>
                    <ArchiveCard
                      archive={a}
                      active={!previewDemo && selected?.id === a.id}
                      onSelect={() => pick(a.id)}
                      onDelete={() => remove(a.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <section>
            {selected ? (
              <ArchiveDetail
                archive={selected}
                preview={previewDemo || selected.id === 'demo-preview'}
              />
            ) : (
              <div className="surface rounded-lg p-8 text-sm text-[var(--muted)]">
                左边选一场，右边回看问答原文和当时该补的 3 个点。
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function EmptyList({
  previewing,
  onPreview,
}: {
  previewing: boolean;
  onPreview: () => void;
}) {
  return (
    <div className="surface rounded-lg p-4">
      <p className="text-sm font-medium">还没有自己的复盘</p>
      <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
        用自己的材料走完一场训练，进复盘页时会自动收入。问答原文、判定理由、该补的 3
        个点都会留下。
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <Link href="/interview" className="btn-primary rounded-md px-3 py-2 text-center text-xs">
          开始一场训练
        </Link>
        <button
          type="button"
          onClick={onPreview}
          className={`rounded-md px-3 py-2 text-xs ${
            previewing ? 'bg-[var(--ink)] text-[var(--paper)]' : 'btn-ghost'
          }`}
        >
          {previewing ? '正在看演示复盘' : '先看演示复盘长什么样'}
        </button>
      </div>
    </div>
  );
}

function ArchiveCard({
  archive,
  active,
  onSelect,
  onDelete,
}: {
  archive: ReviewArchive;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const done = doneCount(archive);
  return (
    <div
      className={`rounded-lg border p-3 ${
        active
          ? 'border-[var(--ink)] bg-white'
          : 'border-[var(--line)] bg-[var(--paper-lift)] hover:border-black/25'
      }`}
    >
      <button type="button" onClick={onSelect} className="w-full text-left">
        <p className="text-[11px] text-[var(--muted)]">{formatArchiveTime(archive.at)}</p>
        <p className="mt-1 text-sm font-medium leading-snug">
          {archive.company} · {archive.role}
        </p>
        <p className="mt-1.5 text-[11px] text-[var(--muted)]">
          {modeLabel(archive.mode)} · {done}/{archive.points.length} 题 · 均分 {archive.avgScore}
        </p>
        <p className="mt-1 text-[11px]">
          <span className="text-[var(--ok)]">已验证 {archive.verified}</span>
          <span className="mx-1 text-[var(--muted)]">·</span>
          <span className="text-[var(--warn)]">需加强 {archive.shaky}</span>
        </p>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="mt-2 text-[11px] text-[var(--muted)] hover:text-[var(--danger)]"
      >
        删除
      </button>
    </div>
  );
}

function ArchiveDetail({ archive, preview }: { archive: ReviewArchive; preview: boolean }) {
  return (
    <div className="space-y-4">
      {preview && (
        <p className="rounded-lg border border-[var(--accent)]/40 bg-[rgba(31,122,102,0.07)] px-4 py-2.5 text-xs leading-relaxed">
          这是演示数据，不会写入你的历史。真实训练结束进复盘页，才会留下你自己的问答。
        </p>
      )}
      <ReviewHeadline archive={archive} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ReviewStats archive={archive} />
        <NextThreeCard archive={archive} />
      </div>
      <PointReplayList key={archive.id} archive={archive} />
    </div>
  );
}
