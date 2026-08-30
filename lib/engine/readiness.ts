import type {
  InterviewPlan,
  NextAction,
  ProbeSession,
  ReadinessCell,
  ReadinessMap,
  ResumeInterviewSession,
  SelfRating,
  Syllabus,
  SyllabusTopic,
  TopicStatus,
} from '../types';

/**
 * 实测结论优先于自评。
 * 用户说自己会、但追问下没能给出任何新增事实的考点，必须回落为 shaky——
 * 这个落差正是产品要暴露给用户的东西。
 */
function resolveStatus(rating: SelfRating | undefined, probe: ProbeSession | undefined): TopicStatus {
  if (probe?.outcome === 'verified') return 'verified';
  if (probe?.outcome === 'collapsed') return 'shaky';

  switch (rating) {
    case 'confident':
      return 'claimed';
    case 'unsure':
      return 'shaky';
    case 'unknown':
      return 'gap';
    default:
      return 'unrated';
  }
}

/** 缺口系数：状态离「掌握」有多远，用于决定优先补哪几个 */
const GAP_FACTOR: Record<TopicStatus, number> = {
  gap: 1.0,
  shaky: 0.7,
  unrated: 0.5,
  claimed: 0,
  verified: 0,
};

function explain(topic: SyllabusTopic, cell: ReadinessCell): string {
  const postCount = new Set(topic.sources.map((s) => s.postId)).size;
  const frequency = `在 ${postCount} 篇面经中出现`;

  // 落差是最值得说清楚的一种情况：崩在第一轮和崩在第二轮，对用户是完全不同的信息
  if (cell.selfRating === 'confident' && cell.probe?.outcome === 'collapsed') {
    const turn = cell.probe.collapsedAtTurn;
    return turn === 1
      ? `${frequency}，你自评会，但第一个追问就没能说出具体机制`
      : `${frequency}，你自评会，追问到第 ${turn} 轮时答不出新东西了`;
  }

  if (cell.probe?.outcome === 'collapsed') {
    const turn = cell.probe.collapsedAtTurn;
    return turn
      ? `${frequency}，高频，但上次追问到第 ${turn} 轮没撑住`
      : `${frequency}，高频，但上次追问没撑住`;
  }

  if (cell.status === 'unrated' || cell.status === 'gap') {
    return `${frequency}，目前尚未验证`;
  }

  switch (cell.status) {
    case 'shaky':
      return `${frequency}，你的掌握程度还不稳`;
    default:
      return `${frequency}，尚未评估`;
  }
}

export function buildReadinessMap(
  syllabus: Syllabus,
  ratings: Record<string, SelfRating> = {},
  probes: Record<string, ProbeSession> = {},
): ReadinessMap {
  const cells: ReadinessCell[] = syllabus.topics.map((topic) => {
    const rating = ratings[topic.id];
    const probe = probes[topic.id];
    return {
      topicId: topic.id,
      title: topic.title,
      category: topic.category,
      weight: topic.weight,
      status: resolveStatus(rating, probe),
      selfRating: rating,
      probe,
    };
  });

  const covered = cells.filter((c) => c.status === 'verified' || c.status === 'claimed').length;

  // 只统计「自评会、实测崩」这一种落差。自评不会、实测也不会不构成意外，不该计入
  const gapCount = cells.filter(
    (c) => c.selfRating === 'confident' && c.probe?.outcome === 'collapsed',
  ).length;

  const topicById = new Map(syllabus.topics.map((t) => [t.id, t]));

  const nextThree: NextAction[] = cells
    .map((cell) => ({ cell, priority: cell.weight * GAP_FACTOR[cell.status] }))
    .filter((x) => x.priority > 0)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3)
    .map(({ cell }) => ({
      topicId: cell.topicId,
      title: cell.title,
      reason: explain(topicById.get(cell.topicId)!, cell),
    }));

  return {
    cells,
    total: cells.length,
    covered,
    gapCount,
    nextThree,
  };
}

function tokens(text: string): string[] {
  const lower = text.toLowerCase();
  const words = lower.split(/[^a-z0-9\u4e00-\u9fff]+/i).filter((t) => t.length >= 2);
  const grams: string[] = [];
  const compact = lower.replace(/[^\u4e00-\u9fff]/g, '');
  for (let i = 0; i < compact.length - 1; i++) grams.push(compact.slice(i, i + 2));
  return [...words, ...grams];
}

export function matchTopicId(title: string, syllabus: Syllabus): string | null {
  const hay = title.toLowerCase();
  const hayTokens = new Set(tokens(title));
  let best: { id: string; score: number } | null = null;
  for (const topic of syllabus.topics) {
    let score = 0;
    for (const key of [topic.title, ...topic.variants]) {
      const k = key.toLowerCase();
      if (!k) continue;
      if (hay.includes(k) || k.includes(hay.slice(0, Math.min(12, hay.length)))) {
        score = Math.max(score, 20 + k.length);
      }
      for (const tok of tokens(key)) {
        if (hayTokens.has(tok)) score += tok.length >= 2 ? 2 : 1;
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { id: topic.id, score };
  }
  return best?.id ?? null;
}

function syllabusFromPlan(plan: InterviewPlan): Syllabus {
  return {
    company: plan.companyGuess ?? '',
    role: plan.roleGuess,
    postCount: 0,
    generatedAt: plan.generatedAt,
    topics: plan.points.map((p) => ({
      id: p.id,
      title: p.title,
      category: p.source,
      weight: p.source === 'intel_hit' ? 5 : p.source === 'resume_match' ? 3 : 2,
      variants: [p.title],
      sources: [],
    })),
  };
}

/** 把模拟面试结果叠到考纲上，得到准备度。没有考纲时用本场追问点兜底。 */
export function buildPrepReadiness(
  syllabus: Syllabus | undefined,
  plan: InterviewPlan | null,
  sessions: Record<string, ResumeInterviewSession>,
): ReadinessMap {
  const extra: SyllabusTopic[] = [];
  const probes: Record<string, ProbeSession> = {};
  const base = syllabus ?? (plan ? syllabusFromPlan(plan) : null);
  if (!base) {
    return { cells: [], total: 0, covered: 0, gapCount: 0, nextThree: [] };
  }

  if (plan) {
    for (const point of plan.points) {
      const session = sessions[point.id];
      if (!session) continue;
      let id = syllabus ? matchTopicId(point.title, syllabus) : point.id;
      if (!id) {
        id = point.id;
        if (!base.topics.some((t) => t.id === id)) {
          extra.push({
            id,
            title: point.title,
            category: point.source,
            weight: point.source === 'intel_hit' ? 5 : 2,
            variants: [point.title],
            sources: [],
          });
        }
      }
      probes[id] = {
        topicId: id,
        turns: session.turns,
        outcome: session.outcome,
        collapsedAtTurn: session.collapsedAtTurn,
      };
    }
  }

  return buildReadinessMap({ ...base, topics: [...base.topics, ...extra] }, {}, probes);
}
