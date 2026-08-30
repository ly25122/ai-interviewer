'use client';

import { useState } from 'react';
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

const VERDICT_META: Record<Verdict, { label: string; tone: string; dot: string }> = {
  trustworthy: {
    label: '高可信',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    dot: 'bg-emerald-500',
  },
  suspicious: {
    label: '存疑',
    tone: 'border-amber-200 bg-amber-50 text-amber-900',
    dot: 'bg-amber-500',
  },
  promotional: {
    label: '疑似引流',
    tone: 'border-rose-200 bg-rose-50 text-rose-900',
    dot: 'bg-rose-500',
  },
};

const TRUST_META: Record<ContentTrust, { label: string; desc: string; tone: string }> = {
  usable: {
    label: '题目可用',
    desc: '题目具体、有上下文，可以进入考纲',
    tone: 'bg-emerald-100 text-emerald-800',
  },
  partial: {
    label: '部分可用',
    desc: '一部分题目有价值，其余过于泛化',
    tone: 'bg-amber-100 text-amber-800',
  },
  unusable: {
    label: '题目不可用',
    desc: '题目全部泛化或明显编造，不进入考纲',
    tone: 'bg-slate-200 text-slate-700',
  },
};

const DIMENSION_META: Record<SignalDimension, { label: string; desc: string }> = {
  commercial: { label: '商业意图', desc: '是否存在引流与转化目的' },
  specificity: { label: '细节密度', desc: '真实性最强的单一指标' },
  narrative: { label: '叙事完整性', desc: '是否包含失败与不确定' },
  author: { label: '账号画像', desc: '发帖公司多样性与题材单一度' },
  recency: { label: '时效性', desc: '内容是否仍然反映当前流程' },
};

const LEVEL_META: Record<SignalLevel, { label: string; tone: string; bar: string }> = {
  positive: { label: '支持可信', tone: 'text-emerald-700', bar: 'bg-emerald-400' },
  negative: { label: '不利可信', tone: 'text-rose-700', bar: 'bg-rose-400' },
  neutral: { label: '证据不足', tone: 'text-slate-500', bar: 'bg-slate-300' },
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
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <header className="mb-8">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">底气</h1>
          <p className="text-sm text-slate-500">让你知道自己准备到哪了</p>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          小红书上的面经真假混杂，广告帖里的题目却可能是真的。这里先判断一篇面经能不能信、
          题目能不能用，每条结论都附上原文证据，你可以自己核验。
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">没有素材？直接试这三篇：</span>
            {SAMPLES.map((sample) => (
              <button
                key={sample.key}
                type="button"
                onClick={() => applySample(sample)}
                title={sample.hint}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  activeSample === sample.key
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
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
            placeholder="把小红书面经的正文粘贴到这里，包含标题和文末内容效果更好"
            className="h-[420px] w-full resize-none rounded-xl border border-slate-300 bg-white p-4 text-sm leading-relaxed outline-none focus:border-slate-500"
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={runAnalysis}
              disabled={loading || !input.content.trim()}
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? '分析中，约 10 到 30 秒' : '开始分析'}
            </button>
            <span className="text-xs text-slate-400">{input.content.length} 字</span>
          </div>

          {error && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}
        </section>

        <section>
          {!result && !loading && (
            <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
              <p className="max-w-xs text-sm leading-relaxed text-slate-400">
                分析结果会出现在这里。每一条判断都会附上原文中的证据片段，找不到证据的维度会被标为
                证据不足，而不是编一个理由给你。
              </p>
            </div>
          )}

          {loading && <LoadingPanel />}

          {result && <ResultPanel result={result} />}
        </section>
      </div>
    </main>
  );
}

function LoadingPanel() {
  return (
    <div className="min-h-[420px] animate-pulse space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <div className="h-16 rounded-lg bg-slate-100" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 rounded-lg bg-slate-100" />
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
      <div className={`rounded-xl border p-4 ${verdict.tone}`}>
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${verdict.dot}`} />
          <span className="text-sm font-semibold">{verdict.label}</span>
        </div>
        {analysis.headline && (
          <p className="mt-1.5 text-sm leading-relaxed opacity-90">{analysis.headline}</p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${trust.tone}`}>
            {trust.label}
          </span>
          <span className="text-xs text-slate-500">{trust.desc}</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          帖子的商业意图与题目的可用性是两件事。即使判定为引流，题目依然可能是真的。
        </p>
      </div>

      <div className="space-y-2">
        {analysis.signals.map((signal) => (
          <SignalRow key={signal.dimension} signal={signal} />
        ))}
      </div>

      {audit.invalidQuotes > 0 && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
          证据核验：模型给出 {audit.totalQuotes} 条引用，其中 {audit.invalidQuotes}{' '}
          条无法在原文中逐字找到，已作废并将对应维度降级。
        </p>
      )}

      {analysis.extracted.questions.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold">
            抽取到 {analysis.extracted.questions.length} 道题
            {analysis.extracted.company && (
              <span className="ml-2 text-xs font-normal text-slate-500">
                {analysis.extracted.company}
                {analysis.extracted.role ? ` · ${analysis.extracted.role}` : ''}
                {analysis.extracted.interviewDate ? ` · ${analysis.extracted.interviewDate}` : ''}
              </span>
            )}
          </h3>
          <ul className="mt-3 space-y-3">
            {analysis.extracted.questions.map((q, i) => (
              <li key={i} className="border-l-2 border-slate-200 pl-3">
                <p className="text-sm leading-relaxed">{q.text}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {q.topic && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                      {q.topic}
                    </span>
                  )}
                  {q.round && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                      {q.round}
                    </span>
                  )}
                </div>
                {q.followUps && q.followUps.length > 0 && (
                  <ol className="mt-2 space-y-1">
                    {q.followUps.map((f, j) => (
                      <li key={j} className="text-xs leading-relaxed text-slate-500">
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
    <div className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
      <span className={`mt-0.5 w-1 shrink-0 rounded-full ${level.bar}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{dim.label}</span>
          <span className={`text-[11px] ${level.tone}`}>{level.label}</span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">{signal.reason}</p>
        {signal.quotes.length > 0 && (
          <ul className="mt-2 space-y-1">
            {signal.quotes.map((quote, i) => (
              <li
                key={i}
                className="border-l-2 border-slate-200 bg-slate-50 py-1 pl-2 text-xs leading-relaxed text-slate-500"
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
