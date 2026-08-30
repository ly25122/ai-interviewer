import { describe, expect, it } from 'vitest';
import { canonicalUrl, generateQueryPlan } from '../collectIntel';

describe('generateQueryPlan', () => {
  it('builds company queries with interview terms and nowcoder site search', () => {
    const plans = generateQueryPlan({
      name: '字节跳动',
      department: '电商',
      role: '后端实习',
    });
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.some((p) => p.query.includes('面试经验') || p.intent === '面试流程')).toBe(true);
    expect(plans.some((p) => p.query.includes('site:nowcoder.com'))).toBe(true);
    expect(plans.some((p) => p.query.includes(String(new Date().getFullYear())))).toBe(true);
    expect(plans.every((p) => p.query.includes('字节跳动'))).toBe(true);
  });

  it('switches to 复试 queries for a school target', () => {
    const plans = generateQueryPlan({
      name: '清华大学',
      role: '计算机',
      targetType: 'school',
    });
    expect(plans.some((p) => p.query.includes('复试'))).toBe(true);
    expect(plans.some((p) => p.query.includes('面试经验'))).toBe(false);
  });
});

describe('canonicalUrl', () => {
  it('strips tracking params and trailing slash', () => {
    expect(canonicalUrl('https://www.nowcoder.com/discuss/123/?utm_source=x&from=share')).toBe(
      'https://www.nowcoder.com/discuss/123',
    );
  });

  it('rejects non-http urls', () => {
    expect(canonicalUrl('javascript:alert(1)')).toBe('');
  });
});
