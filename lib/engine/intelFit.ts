import type { IntelligenceItem } from '../types';

const SCARCE_COUNT = 3;

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/i)
    .filter((t) => t.length >= 2);
}

/**
 * 情报很少时，先判断这些材料是不是在说目标岗位。
 * 对不上就不进画像，避免用无关面经画出一张假图。
 */
export function checkIntelJobFit(input: {
  items: IntelligenceItem[];
  company: string;
  role: string;
  jd: string;
}): { ok: boolean; scarce: boolean; reason: string } {
  const scarce = input.items.length < SCARCE_COUNT;
  if (input.items.length === 0) {
    return { ok: false, scarce: true, reason: '还没有情报。先检索或粘贴至少一条。' };
  }
  if (!scarce) {
    return { ok: true, scarce: false, reason: '' };
  }

  const corpus = input.items.map((it) => `${it.label}\n${it.content}`).join('\n').toLowerCase();
  const company = input.company.trim();
  const role = input.role.trim();
  const companyHit = company.length >= 2 && corpus.includes(company.toLowerCase());
  const roleToks = tokens(role).filter((t) => t.length >= 2);
  const roleHits = roleToks.filter((t) => corpus.includes(t)).length;
  const jdHits = tokens(input.jd)
    .filter((t) => t.length >= 2)
    .filter((t) => corpus.includes(t)).length;

  const matched = companyHit || roleHits >= 2 || jdHits >= 5;
  if (matched) {
    return { ok: true, scarce: true, reason: '' };
  }
  return {
    ok: false,
    scarce: true,
    reason: `现在只有 ${input.items.length} 条情报，而且对不上「${company} · ${role}」。再检索几条，或贴这场面试的面经，才能进画像。`,
  };
}
