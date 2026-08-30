import { describe, expect, it } from 'vitest';
import { buildReadinessMap } from '../readiness';
import type { ProbeSession, Syllabus, SyllabusTopic } from '../../types';

function topic(id: string, weight: number, title = `考点${id}`): SyllabusTopic {
  return {
    id,
    title,
    category: '数据库',
    weight,
    variants: [title],
    sources: [
      {
        postId: `p-${id}`,
        verdict: 'trustworthy',
        contribution: weight,
        originalText: title,
      },
    ],
  };
}

const syllabus: Syllabus = {
  company: '字节',
  role: '后端实习',
  postCount: 3,
  generatedAt: NOW_ISO(),
  topics: [topic('t1', 3.0), topic('t2', 2.0), topic('t3', 1.0), topic('t4', 0.5)],
};

function NOW_ISO() {
  return '2026-08-30T00:00:00.000Z';
}

function collapsed(topicId: string): ProbeSession {
  return {
    topicId,
    turns: [{ question: 'q', answer: 'a', hasNewFact: false, judgement: '只有结论没有机制' }],
    outcome: 'collapsed',
    collapsedAtTurn: 1,
  };
}

function verified(topicId: string): ProbeSession {
  return {
    topicId,
    turns: [{ question: 'q', answer: 'a', hasNewFact: true, judgement: '给出了具体机制' }],
    outcome: 'verified',
    collapsedAtTurn: null,
  };
}

describe('buildReadinessMap', () => {
  it('未评估的考点不计入已覆盖', () => {
    const map = buildReadinessMap(syllabus);
    expect(map.total).toBe(4);
    expect(map.covered).toBe(0);
    expect(map.cells.every((c) => c.status === 'unrated')).toBe(true);
  });

  it('自评会计入已覆盖，自评不会不计入', () => {
    const map = buildReadinessMap(syllabus, { t1: 'confident', t2: 'unknown' });
    expect(map.covered).toBe(1);
    expect(map.cells.find((c) => c.topicId === 't2')?.status).toBe('gap');
  });

  it('实测结论优先于自评：说会但答不出新事实，回落为不稳', () => {
    const map = buildReadinessMap(syllabus, { t1: 'confident' }, { t1: collapsed('t1') });
    expect(map.cells.find((c) => c.topicId === 't1')?.status).toBe('shaky');
    expect(map.covered).toBe(0);
  });

  it('落差只统计「自评会但实测崩」，自评不会的不算意外', () => {
    const map = buildReadinessMap(
      syllabus,
      { t1: 'confident', t2: 'unknown', t3: 'confident' },
      { t1: collapsed('t1'), t2: collapsed('t2'), t3: verified('t3') },
    );
    expect(map.gapCount).toBe(1);
  });

  it('下一步只给三条，且按权重乘缺口排序', () => {
    const map = buildReadinessMap(syllabus, {
      t1: 'unknown',
      t2: 'unknown',
      t3: 'unknown',
      t4: 'unknown',
    });
    expect(map.nextThree).toHaveLength(3);
    expect(map.nextThree.map((a) => a.topicId)).toEqual(['t1', 't2', 't3']);
  });

  it('已掌握的考点不会出现在下一步里', () => {
    const map = buildReadinessMap(syllabus, { t1: 'confident', t2: 'unknown' });
    expect(map.nextThree.some((a) => a.topicId === 't1')).toBe(false);
  });

  it('高权重的不稳考点优先于低权重的完全不会', () => {
    // t1 权重 3.0 且不稳（系数 0.7）得 2.1，t3 权重 1.0 完全不会（系数 1.0）得 1.0
    const map = buildReadinessMap(syllabus, { t1: 'unsure', t3: 'unknown' });
    expect(map.nextThree[0].topicId).toBe('t1');
  });
});
