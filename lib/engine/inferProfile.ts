import { chat, parseJson } from '../llm';
import type { Syllabus, SyllabusTopic } from '../types';

const INFER_PROMPT = `面经数量不足，无法只靠原文抽出完整岗位画像。
请根据目标公司、岗位、JD、简历摘要，以及已有的面经摘录，推断该岗位最可能考查的考点。

要求：
- 已有面经里出现过的问法优先保留，不要改写成空话
- 不足的部分必须能从 JD 或简历找到依据，不要编造该公司内部原题或具体数字
- 输出 6 到 8 个考点
- title 用考点名称，不要用问句
- category 从这些里选：数据库、缓存、网络、操作系统、语言基础、框架、算法、系统设计、项目经历、其他
- variants 写 1 到 3 个面试官可能的问法
- reason 一句话说明依据（面经 / JD / 简历）

只输出 JSON：
{
  "topics": [
    { "title": "考点名称", "category": "技术领域", "variants": ["问法"], "reason": "依据" }
  ]
}`;

interface InferResponse {
  topics?: Array<{ title?: string; category?: string; variants?: string[]; reason?: string }>;
}

function compact(s: string) {
  return s.toLowerCase().replace(/\s+/g, '');
}

function similar(a: string, b: string) {
  const x = compact(a);
  const y = compact(b);
  if (!x || !y) return false;
  return x.includes(y) || y.includes(x) || (x.length >= 4 && y.includes(x.slice(0, 8)));
}

/**
 * 情报少、抽出的考点不够时，用 JD / 简历把画像补到可训练的密度。
 * 不覆盖已有面经考点，只追加。
 */
export async function augmentSyllabus(
  syllabus: Syllabus,
  input: { jd: string; resume: string; intelSnippets: string[] },
): Promise<Syllabus> {
  const jd = input.jd.trim().slice(0, 2400);
  const resume = input.resume.trim().slice(0, 2800);
  if (jd.length < 40 && resume.length < 80) return syllabus;

  const raw = await chat({
    messages: [
      { role: 'system', content: INFER_PROMPT },
      {
        role: 'user',
        content: JSON.stringify(
          {
            company: syllabus.company,
            role: syllabus.role,
            jd,
            resume,
            intelSnippets: input.intelSnippets.slice(0, 6).map((s) => s.slice(0, 800)),
            existingTopics: syllabus.topics.map((t) => t.title),
          },
          null,
          1,
        ),
      },
    ],
    temperature: 0.2,
    json: true,
    maxTokens: 2500,
  });

  const inferred = (parseJson<InferResponse>(raw).topics ?? [])
    .map((t) => ({
      title: t.title?.trim() ?? '',
      category: t.category?.trim() || '其他',
      variants: (t.variants ?? []).map((v) => v.trim()).filter(Boolean).slice(0, 3),
      reason: t.reason?.trim() || '根据 JD 与简历推断',
    }))
    .filter((t) => t.title.length >= 2);

  const existing = syllabus.topics;
  const extras: SyllabusTopic[] = [];
  let i = existing.length;
  for (const t of inferred) {
    if (existing.some((e) => similar(e.title, t.title)) || extras.some((e) => similar(e.title, t.title))) {
      continue;
    }
    i += 1;
    extras.push({
      id: `t${i}`,
      title: t.title,
      category: t.category,
      weight: 1.6,
      variants: t.variants.length ? t.variants : [t.title],
      sources: [
        {
          postId: 'ai-infer',
          verdict: 'suspicious',
          contribution: 1.6,
          originalText: t.reason,
        },
      ],
    });
  }

  if (!extras.length) return syllabus;

  const topics = [...existing, ...extras].sort((a, b) => b.weight - a.weight);
  return { ...syllabus, topics, aiAugmented: true };
}

export function emptySyllabus(meta: { company: string; role: string }, now = new Date()): Syllabus {
  return {
    company: meta.company,
    role: meta.role,
    topics: [],
    postCount: 0,
    generatedAt: now.toISOString(),
  };
}

export function shouldAugmentProfile(postCount: number, topicCount: number): boolean {
  return postCount < 3 || topicCount < 5;
}
