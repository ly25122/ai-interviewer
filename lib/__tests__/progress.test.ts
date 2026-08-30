import { describe, expect, it } from 'vitest';
import { scoreSession, summarize, todayKey } from '../progress';

describe('scoreSession', () => {
  it('gives a high score when two factual turns survive', () => {
    expect(
      scoreSession({
        outcome: 'verified',
        turns: [{ hasNewFact: true }, { hasNewFact: true }],
      }),
    ).toBe(100);
  });

  it('gives a low score when the first turn collapses with no fact', () => {
    expect(
      scoreSession({
        outcome: 'collapsed',
        turns: [{ hasNewFact: false }],
      }),
    ).toBe(15);
  });
});

describe('summarize', () => {
  it('counts today and computes a 7-day week', () => {
    const now = new Date('2026-08-30T12:00:00+08:00');
    const summary = summarize(
      [
        {
          id: 'a',
          at: now.toISOString(),
          pointTitle: '幂等',
          outcome: 'verified',
          collapsedAtTurn: null,
          factTurns: 2,
          totalTurns: 2,
          score: 100,
        },
        {
          id: 'b',
          at: now.toISOString(),
          pointTitle: '选型',
          outcome: 'collapsed',
          collapsedAtTurn: 2,
          factTurns: 0,
          totalTurns: 2,
          score: 40,
        },
      ],
      now,
    );
    expect(summary.today.count).toBe(2);
    expect(summary.today.avgScore).toBe(70);
    expect(summary.week).toHaveLength(7);
    expect(summary.week[6]?.date).toBe(todayKey(now));
  });
});
