/**
 * 验证考纲聚合链路：三篇形态各异的面经 -> 逐篇判定 -> 归并考点 -> 加权排序。
 * 用法：node scripts/smoke-syllabus.mjs [baseUrl]
 */

import { readFile } from 'node:fs/promises';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const samples = JSON.parse(await readFile(new URL('../lib/samples.json', import.meta.url), 'utf8'));

const started = Date.now();
const res = await fetch(`${BASE}/api/syllabus`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    posts: samples.map((s) => ({
      title: s.title,
      content: s.content,
      publishedAt: s.publishedAt,
      author: s.author,
      comments: s.comments,
    })),
  }),
});

const data = await res.json();
const elapsed = ((Date.now() - started) / 1000).toFixed(1);

if (!res.ok) {
  console.error(`失败 ${res.status}:`, data.error);
  process.exit(1);
}

const { syllabus, analyzed, failedCount } = data;

console.log(`===== 逐篇判定（${elapsed}s，失败 ${failedCount} 篇）=====`);
for (const { postId, analysis } of analyzed) {
  console.log(
    `${postId}  ${analysis.verdict.padEnd(13)} 题目${analysis.contentTrust.padEnd(9)} ` +
      `抽取 ${analysis.extracted.questions.length} 题  ${analysis.headline}`,
  );
}

console.log(`\n===== 考纲：${syllabus.company} · ${syllabus.role} =====`);
console.log(`共 ${syllabus.topics.length} 个考点，来自 ${syllabus.postCount} 篇面经\n`);

for (const topic of syllabus.topics) {
  const posts = [...new Set(topic.sources.map((s) => s.postId))];
  console.log(`权重 ${topic.weight.toFixed(2).padStart(5)}  [${topic.category}] ${topic.title}`);
  console.log(`         出现于 ${posts.join(', ')}`);
  if (topic.variants.length > 1) {
    for (const v of topic.variants) console.log(`         · ${v}`);
  }
}

console.log('\n===== 校验 =====');
const allIds = analyzed.flatMap(({ postId, analysis }) =>
  analysis.extracted.questions.map((_, i) => `${postId}#${i}`),
);
const usable = analyzed
  .filter(({ analysis }) => analysis.contentTrust !== 'unusable')
  .flatMap(({ postId, analysis }) => analysis.extracted.questions.map((_, i) => `${postId}#${i}`));
const grouped = syllabus.topics.flatMap((t) => t.sources.map((s) => s.originalText));

console.log(`抽取题目总数 ${allIds.length}，其中可用 ${usable.length}，进入考纲 ${grouped.length}`);
console.log(`题目无丢失: ${grouped.length === usable.length ? '是' : '否'}`);
console.log(
  `排序按权重递减: ${syllabus.topics.every(
    (t, i) => i === 0 || syllabus.topics[i - 1].weight >= t.weight,
  )}`,
);
