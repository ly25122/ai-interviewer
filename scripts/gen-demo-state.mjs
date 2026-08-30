/**
 * 生成演示用的完整状态（考纲 + 自评 + 实测结果），写入 lib/demo-state.json。
 *
 * 用途：现场演示时完整跑一遍需要等模型十几秒、手点十几次自评、再做几轮追问，
 * 时长撑不住。预置一份状态用于「先看结果、再倒叙讲过程」的讲法。
 *
 * 重要：这里只有「学生的回答」是模型扮演出来的，判定结论全部由真实引擎产出，
 * 没有任何一处结果是手写死的。
 *
 * 用法：node scripts/gen-demo-state.mjs [baseUrl]
 */

import { readFile, writeFile } from 'node:fs/promises';

const BASE = process.argv[2] ?? 'http://localhost:3000';

const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
const API_KEY = env.match(/DEEPSEEK_API_KEY\s*=\s*(.+)/)?.[1]?.trim();
if (!API_KEY) throw new Error('.env.local 里没有 DEEPSEEK_API_KEY');

const samples = JSON.parse(await readFile(new URL('../lib/samples.json', import.meta.url), 'utf8'));

/** 扮演两类学生。产品要暴露的正是这两类人在自评时都会说「会」 */
const PERSONAS = {
  shallow: `你是一名准备不充分的本科生，对这个知识点只有从八股文里背来的模糊印象。
像真人那样回答：简短，多用「大概」「应该是」「差不多」，只给结论不给机制，
被继续追问就开始重复前面说过的话，或者直接承认不清楚。
只输出回答本身，不要任何旁白，不超过 80 字。`,
  solid: `你是一名真的在项目里踩过这个坑的本科生。
回答具体：讲清机制、给出参数或量级、说明什么场景下会失效、当时怎么取舍的。
不吹嘘，也不背书。只输出回答本身，不要任何旁白，不超过 120 字。`,
};

async function deepseek(system, user) {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.7,
      max_tokens: 300,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? '模型调用失败');
  return data.choices[0].message.content.trim();
}

async function probeStep(topic, turns) {
  const res = await fetch(`${BASE}/api/probe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topicTitle: topic.title, variants: topic.variants, turns }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

/** 完整跑一个考点的追问，直到引擎判定 verified 或 collapsed */
async function runProbe(topic, persona) {
  const turns = [];
  let step = await probeStep(topic, []);

  while (step.outcome === 'continue' && step.nextQuestion) {
    const question = step.nextQuestion;
    const answer = await deepseek(
      PERSONAS[persona],
      `考点：${topic.title}\n面试官问：${question}\n` +
        (turns.length ? `（你前面已经说过：${turns.map((t) => t.answer).join('；')}）` : ''),
    );
    console.log(`    Q${turns.length + 1} ${question}`);
    console.log(`    A${turns.length + 1} ${answer}`);

    step = await probeStep(topic, [...turns.map((t) => ({ ...t })), { question, answer }]);
    turns.push({
      question,
      answer,
      hasNewFact: step.judgement?.hasNewFact ?? false,
      judgement: step.judgement?.reason ?? '',
    });
  }

  const collapsedAtTurn = turns.findIndex((t) => !t.hasNewFact);
  return {
    topicId: topic.id,
    turns,
    outcome: step.outcome === 'verified' ? 'verified' : 'collapsed',
    collapsedAtTurn: collapsedAtTurn === -1 ? null : collapsedAtTurn + 1,
  };
}

console.log('1/3 生成考纲…');
const syllabusRes = await fetch(`${BASE}/api/syllabus`, {
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
const { syllabus } = await syllabusRes.json();
if (!syllabus) throw new Error('考纲生成失败');
console.log(`    ${syllabus.topics.length} 个考点\n`);

/**
 * 自评分布刻意做成「大部分说会」——这正是真实学生的状态，
 * 也是后面实测打回时落差感的来源。
 */
console.log('2/3 构造自评…');
const ratings = {};
syllabus.topics.forEach((t, i) => {
  ratings[t.id] = i % 5 === 3 ? 'unsure' : i % 7 === 6 ? 'unknown' : 'confident';
});
console.log(`    ${Object.values(ratings).filter((r) => r === 'confident').length} 个自评「会」\n`);

console.log('3/3 实测追问…');
const confident = syllabus.topics.filter((t) => ratings[t.id] === 'confident');
const probes = {};

for (const [topic, persona] of [
  [confident[0], 'shallow'],
  [confident[1], 'solid'],
  [confident[2], 'shallow'],
].filter(([t]) => t)) {
  console.log(`  ${topic.title}（${persona}）`);
  const session = await runProbe(topic, persona);
  probes[topic.id] = session;
  console.log(`    → ${session.outcome}\n`);
}

await writeFile(
  new URL('../lib/demo-state.json', import.meta.url),
  JSON.stringify({ syllabus, ratings, probes }, null, 2),
  'utf8',
);

const collapsed = Object.values(probes).filter((p) => p.outcome === 'collapsed').length;
console.log(`已写入 lib/demo-state.json`);
console.log(`考点 ${syllabus.topics.length}｜实测 ${Object.keys(probes).length}｜被打回 ${collapsed}`);
