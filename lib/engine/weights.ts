import type { Verdict } from '../types';

/**
 * 可信度权重。
 * promotional 不归零，因为广告帖里的题目仍可能真实——机构也需要真题来获客。
 * 但权重必须显著低于真面经，避免一批广告帖靠数量优势把假考点顶上去。
 */
const VERDICT_WEIGHT: Record<Verdict, number> = {
  trustworthy: 1.0,
  suspicious: 0.4,
  promotional: 0.15,
};

export function verdictWeight(verdict: Verdict): number {
  return VERDICT_WEIGHT[verdict];
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * 容错解析面经里出现的各种日期写法。
 * 模型通常会规范成 ISO，但仍会漏出「2024年11月」「8月12号」这类形式。
 */
export function parseInterviewDate(raw?: string, now = new Date()): Date | null {
  if (!raw) return null;

  const iso = raw.match(/(\d{4})[-/年](\d{1,2})(?:[-/月](\d{1,2}))?/);
  if (iso) {
    const [, y, m, d] = iso;
    return new Date(Number(y), Number(m) - 1, d ? Number(d) : 1);
  }

  // 只有月日时按最近的一次推断：若该日期在未来，说明是去年的
  const monthDay = raw.match(/(\d{1,2})[-/月](\d{1,2})/);
  if (monthDay) {
    const [, m, d] = monthDay;
    const candidate = new Date(now.getFullYear(), Number(m) - 1, Number(d));
    if (candidate.getTime() > now.getTime()) {
      candidate.setFullYear(candidate.getFullYear() - 1);
    }
    return candidate;
  }

  return null;
}

/**
 * 时效衰减。面试考点变化很快，两年前的考纲对今天的学生几乎没有参考价值，
 * 但也不能直接归零——基础考点是长期稳定的，靠多来源叠加仍会浮上来。
 * 日期缺失时给 0.5，即「不确定但不否定」。
 */
export function recencyDecay(interviewDate?: string, now = new Date()): number {
  const date = parseInterviewDate(interviewDate, now);
  if (!date) return 0.5;

  const days = (now.getTime() - date.getTime()) / DAY;
  if (days < 0) return 1.0;
  if (days <= 90) return 1.0;
  if (days <= 365) return 0.6;
  return 0.3;
}

export function sourceContribution(
  verdict: Verdict,
  interviewDate?: string,
  now = new Date(),
): number {
  return Number((verdictWeight(verdict) * recencyDecay(interviewDate, now)).toFixed(4));
}
