import type {
  NextAction,
  ProbeSession,
  ReadinessCell,
  ReadinessMap,
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

  switch (cell.status) {
    case 'gap':
      return `${frequency}，而你标记为不会`;
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
