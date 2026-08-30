'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SAMPLES, type Sample } from '@/lib/samples';
import type {
  AnalyzeInput,
  AnalyzeResult,
  ContentTrust,
  EvidenceSignal,
  SignalDimension,
  SignalLevel,
  Verdict,
} from '@/lib/types';

const VERDICT_META: Record<Verdict, { label: string; tone: string; bar: string }> = {
  trustworthy: {
    label: '高可信',
    tone: 'border-[rgba(31,107,74,0.25)] bg-[rgba(31,107,74,0.08)] text-[var(--ok)]',
    bar: 'bg-[var(--ok)]',
  },
  suspicious: {
    label: '存疑',
    tone: 'border-[rgba(161,98,7,0.25)] bg-[rgba(161,98,7,0.08)] text-[var(--warn)]',
    bar: 'bg-[var(--warn)]',
  },
  promotional: {
    label: '疑似引流',
    tone: 'border-[rgba(159,45,58,0.25)] bg-[rgba(159,45,58,0.08)] text-[var(--danger)]',
    bar: 'bg-[var(--danger)]',
  },
};

const TRUST_META: Record<ContentTrust, { label: string; desc: string; tone: string }> = {
  usable: {
    label: '题目可用',
    desc: '题目具体、有上下文，可以进入考纲',
    tone: 'bg-[rgba(31,107,74,0.12)] text-[var(--ok)]',
  },
  partial: {
    label: '部分可用',
    desc: '一部分题目有价值，其余过于泛化',
    tone: 'bg-[rgba(161,98,7,0.12)] text-[var(--warn)]',
  },
  unusable: {
    label: '题目不可用',
    desc: '题目全部泛化或明显编造，不进入考纲',
    tone: 'bg-black/5 text-[var(--muted)]',
  },
};

const DIMENSION_META: Record<SignalDimension, { label: string }> = {
  commercial: { label: '商业意图' },
  specificity: { label: '细节密度' },
  narrative: { label: '叙事完整性' },
  author: { label: '账号画像' },
  recency: { label: '时效性' },
};

const LEVEL_META: Record<SignalLevel, { label: string; tone: string; bar: string }> = {
  positive: { label: '支持可信', tone: 'text-[var(--ok)]', bar: 'bg-[var(--ok)]' },
  negative: { label: '不利可信', tone: 'text-[var(--danger)]', bar: 'bg-[var(--danger)]' },
  neutral: { label: '证据不足', tone: 'text-[var(--muted)]', bar: 'bg-black/20' },
};

export default function AnalyzePage() {
  const [input, setInput] = useState<AnalyzeInput>({ content: '' });
  const [activeSample, setActiveSample] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function applySample(sample: Sample) {
    setInput({
      content: sample.content,
      title: sample.title,
      publishedAt: sample.publishedAt,
      author: sample.author,
      comments: sample.comments,
    });
    setActiveSample(sample.key);
    setResult(null);
    setError('');
  }

  async function runAnalysis() {
    if (!input.content.trim() || loading) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? '分析失败');
      setResult(data as AnalyzeResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : '分析失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[var(--paper-lift)]/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="font-brand text-xl tracking-tight">
            AI面试官
          </Link>
          <nav className="flex items-center gap-4 text-sm text-[var(--muted)]">
            <span className="text-[var(--ink)]">面经甄别</span>
            <Link href="/prepare" className="transition hover:text-[var(--ink)]">
              面试准备
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-5 py-10">
        <div className="max-w-2xl">
          <p className="text-xs tracking-[0.2em] text-[var(--accent)]">FACE CHECK</p>
          <h1 className="font-brand mt-3 text-3xl leading-tight sm:text-4xl">这篇面经，能不能信？</h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
            小红书面经真假混杂。广告帖里的题可能是真的，看起来真诚的帖也可能是拼的。
            这里分开判断：帖子想干什么，题目能不能用——每条指控都要有原文证据。
          </p>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--muted)]">试这三篇：</span>
              {SAMPLES.map((sample) => (
                <button
                  key={sample.key}
                  type="button"
                  onClick={() => applySample(sample)}
                  title={sample.hint}
                  className={`rounded-md border px-3 py-1.5 text-xs transition ${
                    activeSample === sample.key
                      ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]'
                      : 'btn-ghost'
                  }`}
                >
                  {sample.label}
                </button>
              ))}
            </div>

            <textarea
              value={input.content}
              onChange={(e) => {
                setInput((prev) => ({ ...prev, content: e.target.value }));
                setActiveSample(null);
              }}
              placeholder="把小红书面经正文粘贴到这里，含标题和文末效果更好"
              className="field h-[420px] w-full resize-none rounded-lg p-4 text-sm leading-relaxed"
            />

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={runAnalysis}
                disabled={loading || !input.content.trim()}
                className="btn-primary rounded-md px-5 py-2.5 text-sm font-medium"
              >
                {loading ? '分析中，约 10–30 秒' : '开始甄别'}
              </button>
              <span className="text-xs text-[var(--muted)]">{input.content.length} 字</span>
            </div>

            {error && (
              <p className="rounded-md border border-[rgba(159,45,58,0.25)] bg-[rgba(159,45,58,0.08)] px-3 py-2 text-sm text-[var(--danger)]">
                {error}
              </p>
            )}
          </section>

          <section>
            {!result && !loading && (
              <div className="flex h-full min-h-[420px] items-center justify-center border border-dashed border-[var(--line)] bg-white/40 p-8 text-center">
                <p className="max-w-xs text-sm leading-relaxed text-[var(--muted)]">
                  结果会出现在这里。找不到证据的维度会标成「证据不足」，而不是编一个理由。
                </p>
              </div>
            )}
            {loading && <LoadingPanel />}
            {result && <ResultPanel result={result} />}
          </section>
        </div>
      </div>
    </main>
  );
}

function LoadingPanel() {
  return (
    <div className="min-h-[420px] animate-pulse space-y-3 surface rounded-lg p-5">
      <div className="h-16 rounded-md bg-black/5" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 rounded-md bg-black/5" />
      ))}
    </div>
  );
}

function ResultPanel({ result }: { result: AnalyzeResult }) {
  const { analysis, audit } = result;
  const verdict = VERDICT_META[analysis.verdict];
  const trust = TRUST_META[analysis.contentTrust];

  return (
    <div className="space-y-4">
      <div className={`rounded-lg border p-4 ${verdict.tone}`}>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${verdict.bar}`} />
          <span className="text-sm font-semibold">{verdict.label}</span>
        </div>
        {analysis.headline && (
          <p className="mt-1.5 text-sm leading-relaxed opacity-90">{analysis.headline}</p>
        )}
      </div>

      <div className="surface rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${trust.tone}`}>
            {trust.label}
          </span>
          <span className="text-xs text-[var(--muted)]">{trust.desc}</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
          商业意图与题目可用性是两件事。即使判定为引流，题目依然可能是真的。
        </p>
      </div>

      <div className="space-y-2">
        {analysis.signals.map((signal) => (
          <SignalRow key={signal.dimension} signal={signal} />
        ))}
      </div>

      {audit.invalidQuotes > 0 && (
        <p className="rounded-md border border-[var(--line)] bg-white/60 px-3 py-2 text-xs leading-relaxed text-[var(--muted)]">
          证据核验：模型给出 {audit.totalQuotes} 条引用，其中 {audit.invalidQuotes}{' '}
          条无法在原文中逐字找到，已作废并将对应维度降级。
        </p>
      )}

      {analysis.extracted.questions.length > 0 && (
        <div className="surface rounded-lg p-4">
          <h3 className="font-brand text-lg">
            抽取到 {analysis.extracted.questions.length} 道题
            {analysis.extracted.company && (
              <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                {analysis.extracted.company}
                {analysis.extracted.role ? ` · ${analysis.extracted.role}` : ''}
                {analysis.extracted.interviewDate ? ` · ${analysis.extracted.interviewDate}` : ''}
              </span>
            )}
          </h3>
          <ul className="mt-3 space-y-3">
            {analysis.extracted.questions.map((q, i) => (
              <li key={i} className="border-l-2 border-[var(--accent)]/40 pl-3">
                <p className="text-sm leading-relaxed">{q.text}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {q.topic && (
                    <span className="rounded bg-black/5 px-1.5 py-0.5 text-[11px] text-[var(--muted)]">
                      {q.topic}
                    </span>
                  )}
                  {q.round && (
                    <span className="rounded bg-black/5 px-1.5 py-0.5 text-[11px] text-[var(--muted)]">
                      {q.round}
                    </span>
                  )}
                </div>
                {q.followUps && q.followUps.length > 0 && (
                  <ol className="mt-2 space-y-1">
                    {q.followUps.map((f, j) => (
                      <li key={j} className="text-xs leading-relaxed text-[var(--muted)]">
                        追问 {j + 1}：{f}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SignalRow({ signal }: { signal: EvidenceSignal }) {
  const dim = DIMENSION_META[signal.dimension];
  const level = LEVEL_META[signal.level];

  return (
    <div className="surface flex gap-3 rounded-lg p-3.5">
      <span className={`mt-0.5 w-1 shrink-0 rounded-full ${level.bar}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{dim.label}</span>
          <span className={`text-[11px] ${level.tone}`}>{level.label}</span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{signal.reason}</p>
        {signal.quotes.length > 0 && (
          <ul className="mt-2 space-y-1">
            {signal.quotes.map((quote, i) => (
              <li
                key={i}
                className="border-l-2 border-[var(--line)] bg-white/70 py-1 pl-2 text-xs leading-relaxed text-[var(--muted)]"
              >
                {quote}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
