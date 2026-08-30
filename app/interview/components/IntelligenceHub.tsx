'use client';

import { useState } from 'react';
import type {
  IntelligenceItem,
  IntelTrust,
  Syllabus,
  Verdict,
} from '@/lib/types';
import {
  ACCEPT,
  INTEL_SOURCE_META,
  TRUST_OPTIONS,
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
};

function starBar(weight: number, max: number) {
  const n = Math.max(1, Math.min(5, Math.round((weight / Math.max(max, 0.01)) * 5)));
  return '★'.repeat(n);
}

export function IntelligenceHub({
  company,
  role,
  jd,
  items,
  syllabus,
  summarizing,
  error,
  onChange,
  onSummarize,
  onBack,
  onNext,
}: {
  company: string;
  role: string;
  jd: string;
  items: IntelligenceItem[];
  syllabus?: Syllabus;
  summarizing: boolean;
  error: string;
  onChange: (items: IntelligenceItem[]) => void;
  onSummarize: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [mode, setMode] = useState<'paste' | 'url' | 'file' | 'auto'>('auto');
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');
  const [trust, setTrust] = useState<IntelTrust>('high');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [collectName, setCollectName] = useState(company);
  const [collectDept, setCollectDept] = useState('');
  const [collectRole, setCollectRole] = useState(role);
  const [collectType, setCollectType] = useState<'auto' | 'company' | 'school'>('auto');
  const [hits, setHits] = useState<CollectHit[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
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
    setBusy(true);
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
      setBusy(false);
    }
  }

  async function addUrl() {
    if (!url.trim()) return;
    setBusy(true);
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
        content: data.text,
        trust: trust === 'high' ? 'medium' : trust,
      });
      setUrl('');
      setLabel('');
      setNote(data.truncated ? '已抓取（内容较长，已截断）' : '已抓取正文');
    } catch (e) {
      setNote(e instanceof Error ? e.message : '抓取失败，可手动复制正文用「整理/粘贴」加入');
    } finally {
      setBusy(false);
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
    const name = collectName.trim() || company;
    const r = collectRole.trim() || role;
    if (name.length < 2 || r.length < 2) {
      setNote('请填写目标公司/学校和岗位（或专业）');
      return;
    }
    setBusy(true);
    setNote('正在检索公开面经…不含知乎、小红书。');
    setHits([]);
    setPicked([]);
    try {
      const res = await fetch('/api/interview/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          department: collectDept.trim(),
          role: r,
          targetType: collectType,
          context: jd.trim().slice(0, 200),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? '检索失败');
      const sources = (data.sources ?? []) as CollectHit[];
      setHits(sources);
      setPicked(sources.map((s) => s.url));
      const warn = Array.isArray(data.warnings) ? data.warnings.join(' ') : '';
      if (!sources.length) {
        setNote(warn || '没有找到足够相关的公开面经，可换更具体的公司/岗位名，或改为手动粘贴。');
      } else {
        setNote(
          `${warn ? `${warn} ` : ''}找到 ${sources.length} 条，勾选后加入。公开检索默认中等可信度。`,
        );
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : '自动检索失败，请改为手动粘贴');
    } finally {
      setBusy(false);
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
    setNote(`已加入 ${added} 条公开面经。点下面「生成岗位情报总结」。`);
  }

  const maxWeight = Math.max(0, ...(syllabus?.topics.map((t) => t.weight) ?? [0]));
  const questions = (syllabus?.topics ?? []).flatMap((t) => t.variants).slice(0, 8);

  return (
    <div className="space-y-8">
      <div className="max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-[var(--accent)]">② 面试情报</p>
        <h1 className="font-brand mt-2 text-3xl leading-tight sm:text-4xl">
          {company} · {role}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
          不要停在一堆面经原文。先收集，再聚合成「这个组怎么考」。
        </p>
      </div>

      <div className="surface rounded-lg p-4 sm:p-5">
        <div className="inline-flex flex-wrap gap-0.5 rounded-md border border-[var(--line)] p-0.5 text-xs">
          {([
            ['auto', '自动检索'],
            ['paste', '整理/粘贴'],
            ['url', '链接抓取'],
            ['file', '上传文件'],
          ] as const).map(([m, t]) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setNote('');
              }}
              className={`rounded px-3 py-1 transition ${
                mode === m
                  ? 'bg-[var(--accent)] text-[var(--paper)]'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {mode !== 'auto' && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="来源备注，如「师兄去年面这个组」"
              className="field rounded-md px-3 py-2 text-sm"
            />
            <select
              value={trust}
              onChange={(e) => setTrust(e.target.value as IntelTrust)}
              className="field rounded-md px-3 py-2 text-sm"
            >
              {TRUST_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  可信度：{o.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-3">
          {mode === 'paste' && (
            <div className="space-y-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="粘贴/整理情报正文：这个组考过什么、面试官风格、几轮、重点方向…"
                className="field h-32 w-full resize-none rounded-md p-3 text-sm leading-relaxed"
              />
              <button type="button" onClick={addPaste} className="btn-primary rounded-md px-4 py-2 text-sm">
                加入这条情报
              </button>
            </div>
          )}
          {mode === 'url' && (
            <div className="flex flex-wrap gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https:// 牛客/博客/GitHub 面经/招聘页链接"
                className="field min-w-[240px] flex-1 rounded-md px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={addUrl}
                disabled={busy || !url.trim()}
                className="btn-primary rounded-md px-4 py-2 text-sm"
              >
                {busy ? '抓取中…' : '抓取正文'}
              </button>
            </div>
          )}
          {mode === 'file' && (
            <label className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--line)] p-4 text-center transition hover:border-[var(--accent)]">
              <input
                type="file"
                accept={ACCEPT}
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) addFile(file);
                  e.target.value = '';
                }}
              />
              <span className="text-sm text-[var(--ink)]">
                {busy ? '解析中…' : '上传面经文件（PDF / 截图导出 / MD / TXT）'}
              </span>
            </label>
          )}
          {mode === 'auto' && (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={collectName}
                  onChange={(e) => setCollectName(e.target.value)}
                  placeholder="公司或学校"
                  className="field rounded-md px-3 py-2 text-sm"
                />
                <input
                  value={collectRole}
                  onChange={(e) => setCollectRole(e.target.value)}
                  placeholder="岗位或专业"
                  className="field rounded-md px-3 py-2 text-sm"
                />
                <input
                  value={collectDept}
                  onChange={(e) => setCollectDept(e.target.value)}
                  placeholder="部门/组（可选）"
                  className="field rounded-md px-3 py-2 text-sm"
                />
                <select
                  value={collectType}
                  onChange={(e) => setCollectType(e.target.value as 'auto' | 'company' | 'school')}
                  className="field rounded-md px-3 py-2 text-sm"
                >
                  <option value="auto">自动判断：公司 / 学校</option>
                  <option value="company">公司校招/社招</option>
                  <option value="school">学校复试</option>
                </select>
              </div>
              <p className="text-xs text-[var(--muted)]">
                只搜公开网页，不登录。知乎和小红书不会纳入自动检索。
              </p>
              <button
                type="button"
                onClick={collectAuto}
                disabled={busy}
                className="btn-primary rounded-md px-4 py-2 text-sm"
              >
                {busy ? '检索中…' : '开始检索公开面经'}
              </button>
              {hits.length > 0 && (
                <ul className="space-y-1.5 rounded-md border border-[var(--line)] p-2">
                  {hits.map((hit) => (
                    <li key={hit.url} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-1"
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
                        <p className="text-sm leading-snug">{hit.title}</p>
                        <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">
                          {hit.platform} · {hit.url}
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
                  className="btn-primary rounded-md px-4 py-2 text-sm"
                >
                  加入选中的 {picked.length} 条
                </button>
              )}
            </div>
          )}
        </div>
        {note && <p className="mt-2 text-xs text-[var(--muted)]">{note}</p>}
      </div>

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((it) => {
            const meta = INTEL_SOURCE_META[it.source];
            const screen = screens[it.id];
            return (
              <li key={it.id} className="rounded-md border border-[var(--line)] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${meta.tone}`}>
                    {meta.label}
                  </span>
                  <span className="text-sm font-medium">{it.label}</span>
                  <span className="text-xs text-[var(--muted)]">{it.content.length} 字</span>
                  <select
                    value={it.trust}
                    onChange={(e) => updateTrust(it.id, e.target.value as IntelTrust)}
                    className="ml-auto rounded border border-[var(--line)] bg-transparent px-1.5 py-0.5 text-[11px] text-[var(--muted)]"
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
                    className="text-xs text-[#2f6df0] hover:underline disabled:opacity-50"
                  >
                    {screeningId === it.id ? '甄别中…' : '甄别'}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(it.id)}
                    className="text-xs text-[var(--danger)] hover:underline"
                  >
                    删除
                  </button>
                </div>
                {screen && (
                  <p className="mt-1.5 text-xs text-[var(--muted)]">
                    {screen.verdict === 'promotional'
                      ? '疑似引流'
                      : screen.verdict === 'trustworthy'
                        ? '较可信'
                        : '存疑'}
                    {' · '}
                    {screen.headline}
                  </p>
                )}
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">
                  {it.content}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSummarize}
          disabled={summarizing || items.length === 0}
          className="btn-primary rounded-md px-5 py-2.5 text-sm font-medium"
        >
          {summarizing ? '正在聚合考点…' : '生成岗位情报总结'}
        </button>
        <span className="text-xs text-[var(--muted)]">已收集 {items.length} 条。一次最多聚合 8 篇。</span>
      </div>

      {syllabus && (
        <div className="surface rounded-lg p-4 sm:p-5">
          <p className="text-xs tracking-[0.16em] text-[var(--accent)]">岗位情报总结</p>
          <h2 className="font-brand mt-2 text-2xl">
            {syllabus.company} · {syllabus.role}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{syllabus.postCount} 条有效情报</p>

          <h3 className="mt-5 text-sm font-medium">高频考点</h3>
          <ul className="mt-2 space-y-2">
            {syllabus.topics
              .slice()
              .sort((a, b) => b.weight - a.weight)
              .slice(0, 8)
              .map((t) => (
                <li key={t.id} className="flex items-baseline justify-between gap-3">
                  <span className="text-sm">{t.title}</span>
                  <span className="shrink-0 text-xs tracking-widest text-[var(--accent)]">
                    {starBar(t.weight, maxWeight)}
                  </span>
                </li>
              ))}
          </ul>

          {questions.length > 0 && (
            <>
              <h3 className="mt-5 text-sm font-medium">近期真实问题</h3>
              <ul className="mt-2 space-y-1.5">
                {questions.map((q) => (
                  <li key={q} className="text-sm text-[var(--ink)]">
                    · {q}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-md border border-[rgba(159,45,58,0.25)] bg-[rgba(159,45,58,0.08)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onNext}
          disabled={items.length === 0 && !syllabus}
          className="btn-primary rounded-md px-5 py-2.5 text-sm font-medium"
        >
          开始针对性训练 →
        </button>
        <button type="button" onClick={onBack} className="btn-ghost rounded-md px-4 py-2.5 text-sm">
          返回目标岗位
        </button>
      </div>
    </div>
  );
}
