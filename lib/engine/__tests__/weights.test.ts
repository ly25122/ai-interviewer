import { describe, expect, it } from 'vitest';
import { parseInterviewDate, recencyDecay, sourceContribution, verdictWeight } from '../weights';

const NOW = new Date('2026-08-30T00:00:00+08:00');

describe('verdictWeight', () => {
  it('引流帖权重不归零，因为广告帖里的题目仍可能真实', () => {
    expect(verdictWeight('promotional')).toBeGreaterThan(0);
  });

  it('真面经的分量必须显著高于引流帖，避免广告靠数量顶上假考点', () => {
    // 一篇真面经要能压过五篇以上的广告帖
    expect(verdictWeight('trustworthy')).toBeGreaterThan(verdictWeight('promotional') * 5);
  });
});

describe('parseInterviewDate', () => {
  it('解析完整日期', () => {
    expect(parseInterviewDate('2026-08-12', NOW)?.getMonth()).toBe(7);
  });

  it('解析中文年月日', () => {
    const d = parseInterviewDate('2024年11月3日', NOW);
    expect(d?.getFullYear()).toBe(2024);
    expect(d?.getMonth()).toBe(10);
  });

  it('只有月日时，若落在未来则视为去年', () => {
    const d = parseInterviewDate('12月20号', NOW);
    expect(d?.getFullYear()).toBe(2025);
  });

  it('无日期信息返回 null', () => {
    expect(parseInterviewDate('前段时间面的', NOW)).toBeNull();
    expect(parseInterviewDate(undefined, NOW)).toBeNull();
  });
});

describe('recencyDecay', () => {
  it('三个月内不衰减', () => {
    expect(recencyDecay('2026-08-01', NOW)).toBe(1.0);
  });

  it('超过一年大幅衰减', () => {
    expect(recencyDecay('2024-11-03', NOW)).toBe(0.3);
  });

  it('日期缺失时取中间值，不确定但不否定', () => {
    expect(recencyDecay(undefined, NOW)).toBe(0.5);
  });
});

describe('sourceContribution', () => {
  it('一篇当季真面经的贡献高于一篇当季引流帖', () => {
    const real = sourceContribution('trustworthy', '2026-08-01', NOW);
    const ad = sourceContribution('promotional', '2026-08-01', NOW);
    expect(real).toBeGreaterThan(ad);
  });

  it('两年前的真面经贡献低于当季真面经', () => {
    expect(sourceContribution('trustworthy', '2024-01-01', NOW)).toBeLessThan(
      sourceContribution('trustworthy', '2026-08-01', NOW),
    );
  });
});
