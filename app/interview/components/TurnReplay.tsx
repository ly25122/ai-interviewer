'use client';

import type { ProbeTurn } from '@/lib/types';

export function TurnReplay({
  turns,
  collapsedAtTurn,
}: {
  turns: ProbeTurn[];
  collapsedAtTurn: number | null;
}) {
  if (turns.length === 0) {
    return <p className="text-xs text-[var(--muted)]">这一题还没开始。</p>;
  }

  return (
    <div className="space-y-4">
      {turns.map((t, i) => {
        const fail = collapsedAtTurn === i + 1;
        return (
          <div
            key={i}
            className={`border-l-2 pl-3 ${fail ? 'border-[var(--warn)]' : 'border-[var(--line)]'}`}
          >
            <p className="text-[11px] text-[var(--muted)]">第 {i + 1} 轮 · 面试官</p>
            <p className="mt-0.5 text-sm leading-relaxed">{t.question}</p>
            <p className="mt-2 text-[11px] text-[var(--muted)]">你</p>
            <p className="mt-0.5 text-sm leading-relaxed">{t.answer}</p>
            {t.judgement && (
              <p
                className={`mt-1.5 text-[11px] leading-relaxed ${
                  fail || !t.hasNewFact ? 'text-[var(--warn)]' : 'text-[var(--ok)]'
                }`}
              >
                {t.judgement}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
