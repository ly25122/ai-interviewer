import type { Syllabus } from '../types';

export interface ResumeFit {
  score: number;
  verdict: string;
  gaps: string[];
}

function compact(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '');
}

/**
 * 岗位 × 简历匹配：对照 JD 和已聚合考点，看简历里有没有落到实处。
 * 不调用模型，分数来自原文是否出现这些词。
 */
export function scoreResumeFit(resume: string, jd: string, syllabus?: Syllabus): ResumeFit {
  const hay = compact(resume);
  const topics = syllabus?.topics ?? [];
  const gaps: string[] = [];
  let hit = 0;
  let total = 0;

  for (const topic of topics) {
    total += 1;
    const keys = [topic.title, ...topic.variants].map(compact).filter((k) => k.length >= 4);
    const found = keys.some((k) => hay.includes(k) || k.split(/[（）()\/、]/).some((p) => p.length >= 4 && hay.includes(p)));
    if (found) hit += 1;
    else gaps.push(topic.title);
  }

  const jdKeys = jd
    .split(/[，。；、\n\/]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4 && s.length <= 24)
    .slice(0, 12);
  for (const key of jdKeys) {
    total += 0.4;
    if (!compact(resume).includes(compact(key))) {
      if (gaps.length < 6 && !gaps.includes(key)) gaps.push(key);
    } else {
      hit += 0.4;
    }
  }

  const score = total <= 0 ? 50 : Math.max(18, Math.min(92, Math.round((hit / total) * 100)));
  const topGaps = gaps.slice(0, 4);
  let verdict: string;
  if (score >= 75) {
    verdict = '主线对得上。剩下的是边角，面试里被追到再说清边界就行。';
  } else if (score >= 50) {
    verdict = '主线能对上一部分，有几处 JD 要、简历没写实，面试会被点名。';
  } else {
    verdict = '和这个岗位的重合偏少。先补材料或换目标，再进训练更有用。';
  }

  return { score, verdict, gaps: topGaps };
}

export const demoResumeFit: ResumeFit = {
  score: 62,
  verdict: '高并发主线对得上，熔断降级和分片治理还是空的，数字口径也经不起追。',
  gaps: ['熔断 / 降级没有落地经历', '非分片键查询讲不清边界', 'QPS 提升缺少测量口径'],
};
