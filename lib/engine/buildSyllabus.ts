import { chat, parseJson } from '../llm';
import { sourceContribution } from './weights';
import type { PostAnalysis, Syllabus, SyllabusTopic, TopicSource } from '../types';

export interface AnalyzedPost {
  postId: string;
  analysis: PostAnalysis;
}

interface QuestionRecord {
  id: string;
  text: string;
  topic?: string;
  postId: string;
  contribution: number;
  interviewDate?: string;
  verdict: PostAnalysis['verdict'];
}

const MERGE_SYSTEM_PROMPT = `你要把多篇面经中抽取出的面试题，按「考点」归并。

同一个考点会以不同措辞出现，例如「Redis 缓存击穿怎么办」和「缓存击穿的解决方案有哪些」
是同一个考点，必须归为一组。而「缓存击穿」和「缓存雪崩」是两个不同考点，不能合并。

归并粒度的判断标准：如果一个学生把这个考点准备好了，能同时答出组内所有问法，就应该归为一组。

要求：
- 每个输入的 id 必须且只能出现在一个分组里，不得遗漏，不得重复，不得编造不存在的 id
- title 用简洁的考点名称，不要用问句，例如「Redis 缓存击穿与应对」
- category 用技术领域，从这些里选：数据库、缓存、网络、操作系统、语言基础、框架、算法、系统设计、项目经历、其他

只输出 JSON，格式：
{
  "groups": [
    { "title": "考点名称", "category": "技术领域", "ids": ["id1", "id2"] }
  ]
}`;

interface MergeResponse {
  groups?: Array<{ title?: string; category?: string; ids?: string[] }>;
}

function collectQuestions(posts: AnalyzedPost[], now: Date): QuestionRecord[] {
  const records: QuestionRecord[] = [];

  for (const { postId, analysis } of posts) {
    // 题目全部泛化或明显编造的帖子不进入考纲，否则会污染整份考纲的可信度
    if (analysis.contentTrust === 'unusable') continue;

    const contribution = sourceContribution(
      analysis.verdict,
      analysis.extracted.interviewDate,
      now,
    );

    analysis.extracted.questions.forEach((q, index) => {
      if (!q.text?.trim()) return;
      records.push({
        id: `${postId}#${index}`,
        text: q.text.trim(),
        topic: q.topic,
        postId,
        contribution,
        interviewDate: analysis.extracted.interviewDate,
        verdict: analysis.verdict,
      });
    });
  }

  return records;
}

/** 模型漏掉的题目不能凭空消失，各自单独成组，宁可考纲略显零散也不丢信息 */
function rescueUngrouped(
  records: QuestionRecord[],
  grouped: Set<string>,
): Array<{ title: string; category: string; ids: string[] }> {
  return records
    .filter((r) => !grouped.has(r.id))
    .map((r) => ({
      title: r.topic || r.text.slice(0, 24),
      category: '其他',
      ids: [r.id],
    }));
}

export async function buildSyllabus(
  posts: AnalyzedPost[],
  meta: { company: string; role: string },
  now = new Date(),
): Promise<Syllabus> {
  const records = collectQuestions(posts, now);
  const byId = new Map(records.map((r) => [r.id, r]));

  let groups: Array<{ title?: string; category?: string; ids?: string[] }> = [];

  if (records.length > 0) {
    const payload = records.map((r) => ({
      id: r.id,
      text: r.text,
      topic: r.topic,
    }));

    const raw = await chat({
      messages: [
        { role: 'system', content: MERGE_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(payload, null, 1) },
      ],
      temperature: 0,
      json: true,
    });

    groups = parseJson<MergeResponse>(raw).groups ?? [];
  }

  const seen = new Set<string>();
  const validGroups = groups
    .map((g) => ({
      title: g.title?.trim() || '未命名考点',
      category: g.category?.trim() || '其他',
      // 过滤编造的 id 与重复归组
      ids: (g.ids ?? []).filter((id) => byId.has(id) && !seen.has(id) && seen.add(id)),
    }))
    .filter((g) => g.ids.length > 0);

  const allGroups = [...validGroups, ...rescueUngrouped(records, seen)];

  const topics: SyllabusTopic[] = allGroups.map((group, index) => {
    const members = group.ids.map((id) => byId.get(id)!);

    const sources: TopicSource[] = members.map((m) => ({
      postId: m.postId,
      verdict: m.verdict,
      interviewDate: m.interviewDate,
      contribution: m.contribution,
      originalText: m.text,
    }));

    // 同一篇面经反复问同一考点不应重复计权，按来源帖子去重后再求和
    const weightByPost = new Map<string, number>();
    for (const s of sources) {
      weightByPost.set(s.postId, Math.max(weightByPost.get(s.postId) ?? 0, s.contribution));
    }
    const weight = Number(
      [...weightByPost.values()].reduce((sum, w) => sum + w, 0).toFixed(4),
    );

    return {
      id: `t${index + 1}`,
      title: group.title,
      category: group.category,
      weight,
      variants: [...new Set(members.map((m) => m.text))],
      sources,
    };
  });

  topics.sort((a, b) => b.weight - a.weight);

  return {
    company: meta.company,
    role: meta.role,
    topics,
    postCount: posts.length,
    generatedAt: now.toISOString(),
  };
}
