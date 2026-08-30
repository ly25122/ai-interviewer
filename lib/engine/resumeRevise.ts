import { chat, parseJson } from '../llm';
import type { IntelligenceItem, ResumeEdit, ResumeEditKind } from '../types';

const SYSTEM = `你是简历教练。对照候选人简历、这场面试的选拔要求（岗位 JD、招生简章或考核说明），以及可选的面试情报 / 刚刚那场模拟面试的复盘，给出可直接改进简历的修改建议。

任务：找出 4 到 6 条最该改的地方。每条必须具体、可执行，不要空话。

kind 只能是：
- strengthen：经历是真的，但写得太虚，补口径、数字、边界
- soften：写得太满 / 数字站不住，收一收，免得面试被追穿
- add：JD 或面经明确要求、简历几乎没写，补一条能经得起问的表述
- cut：堆砌、与岗位无关、或自己讲不清的条目，建议删

硬约束：
1. target 尽量逐字摘自简历；找不到就省略（新增条目可以没有 target）
2. suggestion 是改完后的表述，候选人可以直接替换或追加
3. 不要编造候选人没写过的项目；add 只能建议「用已有经历换一种写法」或「补一句能讲清的真实细节」
4. reason 一句话说清为什么改（对照 JD 哪条、或面试哪一题崩了）

只输出 JSON：
{
  "edits": [
    {
      "id": "e1",
      "kind": "strengthen | soften | add | cut",
      "target": "简历原文片段，可省略",
      "suggestion": "建议改成/补上的句子",
      "reason": "为什么改"
    }
  ]
}`;

const KINDS: ResumeEditKind[] = ['strengthen', 'soften', 'add', 'cut'];

function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n…（已截断）`;
}

function keepIfPresent(quote: string | undefined, haystack: string): string | undefined {
  if (!quote?.trim()) return undefined;
  const q = quote.trim();
  if (haystack.includes(q)) return q;
  const compact = (s: string) => s.replace(/\s+/g, '');
  const hq = compact(haystack);
  const cq = compact(q);
  if (cq.length >= 8 && hq.includes(cq)) return q;
  return undefined;
}

export interface ResumeReviseInput {
  resume: string;
  jd: string;
  intelligence?: IntelligenceItem[];
  debrief?: string;
}

export async function reviseResume(input: ResumeReviseInput): Promise<ResumeEdit[]> {
  const resumeText = clip(input.resume, 12000);
  const jdText = clip(input.jd, 8000);
  const intel = (input.intelligence ?? [])
    .filter((it) => it.content?.trim())
    .map((it, i) => `面经${i + 1}｜${it.label}\n${clip(it.content, 2000)}`)
    .join('\n\n');

  const raw = await chat({
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: [
          `【简历】\n${resumeText}`,
          `【岗位 JD】\n${jdText}`,
          intel ? `【面经辅助】\n${intel}` : '【面经辅助】无',
          input.debrief ? `【模拟面试复盘】\n${clip(input.debrief, 4000)}` : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
      },
    ],
    temperature: 0.3,
    json: true,
    maxTokens: 2200,
  });

  const parsed = parseJson<{ edits?: Array<Partial<ResumeEdit>> }>(raw);
  return (parsed.edits ?? [])
    .filter((e) => e?.suggestion?.trim() && e?.reason?.trim())
    .slice(0, 6)
    .map((e, i) => {
      const kind = KINDS.includes(e.kind as ResumeEditKind)
        ? (e.kind as ResumeEditKind)
        : 'strengthen';
      return {
        id: e.id?.trim() || `e${i + 1}`,
        kind,
        target: keepIfPresent(e.target, resumeText),
        suggestion: e.suggestion!.trim(),
        reason: e.reason!.trim(),
      };
    });
}
