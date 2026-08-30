'use client';

import { useState } from 'react';
import type {
  IntelligenceItem,
  IntelTrust,
  Verdict,
} from '@/lib/types';
import {
  ACCEPT,
  INTEL_SOURCE_META,
  TRUST_OPTIONS,
  ErrorNote,
  PhaseNav,
  formatIntelDate,
  hostFromUrl,
  parseUpload,
  uid,
} from './shared';

type CollectHit = {
  title: string;
  url: string;
  snippet: string;
  platform: string;
  content: string;
  relevanceScore: number;
  publishedAt?: string;
  searchProvider?: string;
};

const ENGINES = [
  { id: 'tavily', name: 'Tavily', hint: '公开网页' },
  { id: 'bocha', name: '博查', hint: '中文网页' },
] as const;

export function IntelligenceHub({
  company,
  role,
  jd,
  items,
  summarizing,
  error,
  onChange,
  onBack,
  onNext,
}: {
  company: string;
  role: string;
  jd: string;
  items: IntelligenceItem[];
  summarizing: boolean;
  error: string;
  onChange: (items: IntelligenceItem[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [mode, setMode] = useState<'paste' | 'url' | 'file' | 'auto'>('auto');
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');
  const [trust, setTrust] = useState<IntelTrust>('high');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<null | 'fetch' | 'collect' | 'parse'>(null);
  const [note, setNote] = useState('');
  const [collectDept, setCollectDept] = useState('');
  const [hits, setHits] = useState<CollectHit[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [usedEngines, setUsedEngines] = useState<string[]>(['tavily', 'bocha']);
  const [screens, setScreens] = useState<Record<string, { verdict: Verdict; headline: string }>>(
    {},
  );
  const [screeningId, setScreeningId] = useState<string | null>(null);

  function add(item: IntelligenceItem) {
    onChange([...items, item]);
  }
  function remove(id: string) {
    onChange(items.filter((it) => it.id !== id));
  }
  function updateTrust(id: string, t: IntelTrust) {
    onChange(items.map((it) => (it.id === id ? { ...it, trust: t } : it)));
  }

  function addPaste() {
    if (text.trim().length < 10) {
      setNote('内容太短，至少写一句有用的情报');
      return;
    }
    add({
      id: uid(),
      source: 'paste',
      label: label.trim() || '手动整理',
      content: text.trim(),
      trust,
    });
    setLabel('');
    setText('');
    setNote('');
  }

  async function addFile(file: File) {
    setBusy('parse');
    setNote('');
    try {
      const content = await parseUpload(file);
      add({
        id: uid(),
        source: 'file',
        label: label.trim() || file.name,
        content,
        trust,
      });
      setLabel('');
    } catch (e) {
      setNote(e instanceof Error ? e.message : '文件解析失败');
    } finally {
      setBusy(null);
    }
  }

  async function addUrl() {
    if (!url.trim()) return;
    setBusy('fetch');
    setNote('正在抓取正文…');
    try {
      const res = await fetch('/api/interview/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? '抓取失败');
      add({
        id: uid(),
        source: 'url',
        label: label.trim() || data.title || url.trim(),
        url: data.url,
        platform: hostFromUrl(data.url),
        content: data.text,
        trust: trust === 'high' ? 'medium' : trust,
      });
      setUrl('');
      setLabel('');
      setNote(data.truncated ? '已抓取（内容较长，已截断）' : '已抓取正文');
    } catch (e) {
      setNote(e instanceof Error ? e.message : '抓取失败，可手动复制正文用「整理/粘贴」加入');
    } finally {
      setBusy(null);
    }
  }

  async function screenItem(item: IntelligenceItem) {
    setScreeningId(item.id);
    setNote('');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: item.content, title: item.label }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? '甄别失败');
      const verdict = data.analysis?.verdict as Verdict;
      const headline = data.analysis?.headline as string;
      setScreens((prev) => ({ ...prev, [item.id]: { verdict, headline } }));
      const nextTrust: IntelTrust =
        verdict === 'promotional' ? 'low' : verdict === 'trustworthy' ? 'high' : 'medium';
      onChange(items.map((it) => (it.id === item.id ? { ...it, trust: nextTrust } : it)));
    } catch (e) {
      setNote(e instanceof Error ? e.message : '甄别失败');
    } finally {
      setScreeningId(null);
    }
  }

  async function collectAuto() {
    if (company.trim().length < 2 || role.trim().length < 2) {
      setNote('先回上一页把去向和方向填好');
      return;
    }
    setBusy('collect');
    setNote('正在检索公开面经，按时间往近收…');
    setHits([]);
    setPicked([]);
    try {
      const res = await fetch('/api/interview/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: company.trim(),
          department: collectDept.trim(),
          role: role.trim(),
          targetType: 'auto',
          context: jd.trim().slice(0, 200),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? '检索失败');
      const provider = String(data.stats?.provider ?? '');
      if (provider) {
        setUsedEngines(
          provider
            .split('+')
            .map((p: string) => p.trim().toLowerCase())
            .filter(Boolean),
        );
      }
      const sources = ((data.sources ?? []) as CollectHit[]).slice().sort((a, b) => {
        const da = Date.parse(a.publishedAt ?? '') || 0;
        const db = Date.parse(b.publishedAt ?? '') || 0;
        return db - da;
      });
      setHits(sources);
      setPicked(sources.map((s) => s.url));
      const warn = Array.isArray(data.warnings) ? data.warnings.join(' ') : '';
      if (!sources.length) {
        setNote(warn || '没找到够近的公开面经。可以改部门名再搜，或自己粘贴。');
      } else {
        setNote(
          `${warn ? `${warn} ` : ''}找到 ${sources.length} 条，已按时间从近到远排。勾选后加入。`,
        );
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : '自动检索失败，请改为手动粘贴');
    } finally {
      setBusy(null);
    }
  }

  function addHits() {
    const existing = new Set(items.map((it) => it.url).filter(Boolean));
    const chosen = hits.filter((h) => picked.includes(h.url) && !existing.has(h.url));
    const next: IntelligenceItem[] = [...items];
    let added = 0;
    for (const hit of chosen) {
      const content = (hit.content || hit.snippet).trim();
      if (content.length < 20) continue;
      next.push({
        id: uid(),
        source: 'web',
        label: hit.title || hit.platform || '公开面经',
        url: hit.url,
        platform: hit.platform || hostFromUrl(hit.url),
        publishedAt: hit.publishedAt,
        content: content.slice(0, 8000),
        trust: 'medium',
      });
      added += 1;
    }
    if (!added) {
      setNote('没有可加入的条目（可能已添加过，或正文太短）');
      return;
    }
    onChange(next);
    setHits([]);
    setPicked([]);
    setNote(`已加入 ${added} 条公开面经。`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-brand text-2xl leading-tight">
            {company} · {role}
          </h1>
          <p className="mt-1 text-xs text-[var(--muted)]">
            面经会抽高频考点和原题，聚成下一页的考情画像。条数太少、又对不上这场面试时，不会硬画一张图。
          </p>
        </div>
        <span className="text-[11px] text-[var(--muted)]">已收集 {items.length} 条</span>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="surface space-y-3 rounded-lg p-3 sm:p-4">
          <div className="flex flex-wrap gap-3">
            {(
              [
                {
                  group: '公开收集',
                  hint: '网上找、贴链接',
                  items: [
                    ['auto', '自动检索'],
                    ['url', '链接抓取'],
                  ],
                },
                {
                  group: '手动加入',
                  hint: '自己整理的材料',
                  items: [
                    ['paste', '整理/粘贴'],
                    ['file', '上传文件'],
                  ],
                },
              ] as const
            ).map((g) => {
              const active = g.items.some(([m]) => m === mode);
              return (
                <div
                  key={g.group}
                  className={`min-w-[200px] flex-1 rounded-lg border p-2 ${
                    active ? 'border-[var(--accent)]/40 bg-[rgba(31,122,102,0.05)]' : 'border-[var(--line)]'
                  }`}
                >
                  <p className="px-1 text-[10px] text-[var(--muted)]">
                    {g.group}
                    <span className="ml-1.5 opacity-70">· {g.hint}</span>
                  </p>
                  <div className="mt-1.5 inline-flex w-full gap-0.5 rounded-md bg-black/[0.03] p-0.5 text-[11px]">
                    {g.items.map(([m, t]) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setMode(m);
                          setNote('');
                        }}
                        className={`flex-1 rounded px-2.5 py-1.5 transition ${
                          mode === m
                            ? m === 'auto' || m === 'url'
                              ? 'bg-[var(--accent)] text-[var(--paper)]'
                              : 'bg-[var(--ink)] text-[var(--paper)]'
                            : 'text-[var(--muted)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {mode !== 'auto' && (
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="来源备注，如「师兄去年面过这场」"
                className="field rounded-md px-2.5 py-1.5 text-xs"
              />
              <select
                value={trust}
                onChange={(e) => setTrust(e.target.value as IntelTrust)}
                className="field rounded-md px-2.5 py-1.5 text-xs"
              >
                {TRUST_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    可信度：{o.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mode === 'paste' && (
            <div className="space-y-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="粘贴/整理：这场考过什么、面试官风格、几轮、重点方向…"
                className="field h-28 w-full resize-none rounded-md p-2.5 text-xs leading-relaxed"
              />
              <button type="button" onClick={addPaste} className="btn-primary rounded-md px-3 py-1.5 text-xs">
                加入这条情报
              </button>
            </div>
          )}

          {mode === 'url' && (
            <div className="flex flex-wrap gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https:// 牛客 / 博客 / GitHub / 招聘页"
                className="field min-w-[200px] flex-1 rounded-md px-2.5 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={addUrl}
                disabled={busy === 'fetch' || !url.trim()}
                className="btn-primary rounded-md px-3 py-1.5 text-xs"
              >
                {busy === 'fetch' ? '抓取中…' : '抓取正文'}
              </button>
            </div>
          )}

          {mode === 'file' && (
            <label className="flex h-24 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-[var(--line)] p-3 text-center transition hover:border-[var(--accent)]">
              <input
                type="file"
                accept={ACCEPT}
                className="hidden"
                disabled={busy === 'parse'}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) addFile(file);
                  e.target.value = '';
                }}
              />
              <span className="text-xs text-[var(--ink)]">
                {busy === 'parse' ? '解析中…' : '上传 PDF / 截图导出 / MD / TXT'}
              </span>
            </label>
          )}

          {mode === 'auto' && (
            <div className="space-y-2.5 rounded-md border border-[var(--accent)]/35 bg-[rgba(31,122,102,0.06)] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-medium text-[var(--accent-deep)]">检索引擎</p>
                {ENGINES.map((eng) => {
                  const on = usedEngines.includes(eng.id);
                  return (
                    <span
                      key={eng.id}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ${
                        on
                          ? 'bg-[var(--accent)] text-white'
                          : 'border border-[var(--line)] text-[var(--muted)]'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${eng.id === 'tavily' ? 'bg-[#7dbaa8]' : 'bg-[#8fb0ff]'}`}
                      />
                      {eng.name}
                      <span className={on ? 'text-white/70' : ''}>{eng.hint}</span>
                    </span>
                  );
                })}
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  value={collectDept}
                  onChange={(e) => setCollectDept(e.target.value)}
                  placeholder="细分（可选），如「电商交易」或「营期方向」"
                  className="field rounded-md px-2.5 py-1.5 text-xs"
                />
                <p className="self-center text-[11px] text-[var(--muted)]">
                  按 {company} · {role} 检索
                </p>
              </div>
              <button
                type="button"
                onClick={collectAuto}
                disabled={busy === 'collect'}
                className="btn-primary rounded-md px-4 py-2 text-sm font-medium"
              >
                {busy === 'collect' ? '检索中…' : '开始检索公开面经'}
              </button>
              {hits.length > 0 && (
                <ul className="max-h-64 space-y-1 overflow-auto rounded-md border border-[var(--line)] bg-[var(--paper-lift)] p-1.5">
                  {hits.map((hit) => (
                    <li key={hit.url} className="flex items-start gap-2 rounded px-1 py-1">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={picked.includes(hit.url)}
                        onChange={() =>
                          setPicked((prev) =>
                            prev.includes(hit.url)
                              ? prev.filter((u) => u !== hit.url)
                              : [...prev, hit.url],
                          )
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs leading-snug">{hit.title}</p>
                        <p className="mt-0.5 truncate text-[10px] text-[var(--muted)]">
                          {formatIntelDate(hit.publishedAt) || '日期未标注'} · {hit.platform}
                          {' · '}
                          <a
                            href={hit.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#2f6df0] hover:underline"
                          >
                            原文
                          </a>
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {hits.length > 0 && (
                <button
                  type="button"
                  onClick={addHits}
                  disabled={!picked.length}
                  className="btn-primary rounded-md px-3 py-1.5 text-xs"
                >
                  加入选中的 {picked.length} 条
                </button>
              )}
            </div>
          )}
          {note && <p className="text-[11px] text-[var(--muted)]">{note}</p>}
        </section>

        <section className="surface rounded-lg p-3 sm:p-4">
          <p className="text-[11px] tracking-[0.14em] text-[var(--muted)]">已收集情报</p>
          {items.length === 0 ? (
            <p className="mt-6 text-center text-xs text-[var(--muted)]">
              还没有条目。用左侧检索或粘贴加入。
            </p>
          ) : (
            <ul className="mt-2 max-h-[28rem] space-y-1.5 overflow-auto">
              {items
                .slice()
                .sort((a, b) => {
                  const da = Date.parse(a.publishedAt ?? '') || 0;
                  const db = Date.parse(b.publishedAt ?? '') || 0;
                  return db - da;
                })
                .map((it) => {
                const meta = INTEL_SOURCE_META[it.source];
                const screen = screens[it.id];
                const site = it.platform || hostFromUrl(it.url);
                const date = formatIntelDate(it.publishedAt);
                return (
                  <li key={it.id} className="rounded-md border border-[var(--line)] px-2.5 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${meta.tone}`}>
                        {meta.label}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">{it.label}</span>
                      <select
                        value={it.trust}
                        onChange={(e) => updateTrust(it.id, e.target.value as IntelTrust)}
                        className="rounded border border-[var(--line)] bg-transparent px-1 py-0.5 text-[10px] text-[var(--muted)]"
                      >
                        {TRUST_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => screenItem(it)}
                        disabled={screeningId === it.id}
                        className="text-[10px] text-[#2f6df0] hover:underline disabled:opacity-50"
                      >
                        {screeningId === it.id ? '甄别中…' : '甄别'}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(it.id)}
                        className="text-[10px] text-[var(--danger)] hover:underline"
                      >
                        删除
                      </button>
                    </div>
                    <p className="mt-1 text-[10px] text-[var(--muted)]">
                      {it.source === 'web' || it.source === 'url'
                        ? date || '日期未标注'
                        : date || '手动加入'}
                      {site ? ` · ${site}` : ''}
                      {it.url ? (
                        <>
                          {' · '}
                          <a
                            href={it.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#2f6df0] hover:underline"
                          >
                            打开原文
                          </a>
                        </>
                      ) : null}
                    </p>
                    {screen && (
                      <p className="mt-1 text-[10px] text-[var(--muted)]">
                        {screen.verdict === 'promotional'
                          ? '疑似引流'
                          : screen.verdict === 'trustworthy'
                            ? '较可信'
                            : '存疑'}
                        {' · '}
                        {screen.headline}
                      </p>
                    )}
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--muted)]">
                      {it.content}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <ErrorNote error={error} />

      <PhaseNav
        nextLabel={summarizing ? '正在聚合考点…' : '查看考情画像 →'}
        onNext={onNext}
        backLabel="返回这场面试"
        onBack={onBack}
        nextDisabled={items.length === 0 || summarizing}
      />
    </div>
  );
}
