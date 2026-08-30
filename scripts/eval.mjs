/**
 * 回测：把引擎判定与人工标注对比，产出 PRD 验收标准里的那几个数字。
 *
 * 用法：node scripts/eval.mjs [baseUrl]
 *
 * 这批数字是答辩时回答「你的准确率是多少」的唯一依据。
 */

import { readFile, writeFile } from 'node:fs/promises';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const CONCURRENCY = 4;

const dataset = JSON.parse(await readFile(new URL('../eval/dataset.json', import.meta.url), 'utf8'));
const samples = dataset.samples ?? [];

if (samples.length === 0) {
  console.error('评测集为空');
  process.exit(1);
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return out;
}

console.log(`回测 ${samples.length} 条样本，并发 ${CONCURRENCY}\n`);
const started = Date.now();

const results = await mapLimit(samples, CONCURRENCY, async (sample) => {
  const { id, label } = sample;
  // 显式构造，避免把标注信息泄漏给模型造成回测失真
  const payload = {
    title: sample.title,
    content: sample.content,
    publishedAt: sample.publishedAt,
    author: sample.author,
    comments: sample.comments,
  };
  try {
    const res = await fetch(`${BASE}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { id, label, error: data.error };
    return { id, label, analysis: data.analysis, audit: data.audit };
  } catch (e) {
    return { id, label, error: e.message };
  }
});

const ok = results.filter((r) => r.analysis);
const failed = results.filter((r) => !r.analysis);

/* ---------- 三档判定一致率 ---------- */

const VERDICTS = ['trustworthy', 'suspicious', 'promotional'];
const matrix = {};
for (const truth of VERDICTS) {
  matrix[truth] = Object.fromEntries(VERDICTS.map((p) => [p, 0]));
}
for (const r of ok) {
  matrix[r.label.verdict][r.analysis.verdict] += 1;
}

const agreed = ok.filter((r) => r.analysis.verdict === r.label.verdict).length;
const agreementRate = ok.length ? (agreed / ok.length) * 100 : 0;

/* ---------- promotional 召回率：宁可误伤，漏掉广告危害更大 ---------- */

const adTruth = ok.filter((r) => r.label.verdict === 'promotional');
const adCaught = adTruth.filter((r) => r.analysis.verdict === 'promotional').length;
const adRecall = adTruth.length ? (adCaught / adTruth.length) * 100 : NaN;

/* ---------- 幻觉率：证据无法在原文中检索到的比例 ---------- */

const totalQuotes = ok.reduce((s, r) => s + r.audit.totalQuotes, 0);
const invalidQuotes = ok.reduce((s, r) => s + r.audit.invalidQuotes, 0);
const hallucinationRate = totalQuotes ? (invalidQuotes / totalQuotes) * 100 : 0;

/* ---------- 题目抽取召回率 ---------- */

const withCount = ok.filter((r) => typeof r.label.questionCount === 'number');
const extractionRecall = withCount.length
  ? (withCount.reduce(
      (s, r) =>
        s + Math.min(r.analysis.extracted.questions.length / Math.max(r.label.questionCount, 1), 1),
      0,
    ) /
      withCount.length) *
    100
  : NaN;

/* ---------- 输出 ---------- */

console.log('===== 逐条结果 =====');
for (const r of results) {
  if (!r.analysis) {
    console.log(`${r.id.padEnd(10)} 失败: ${r.error}`);
    continue;
  }
  const hit = r.analysis.verdict === r.label.verdict;
  console.log(
    `${r.id.padEnd(10)} ${hit ? '对' : '错'}  ` +
      `人工=${r.label.verdict.padEnd(13)} 模型=${r.analysis.verdict.padEnd(13)} ` +
      `题目 ${r.analysis.extracted.questions.length}/${r.label.questionCount ?? '-'}  ` +
      `作废引用 ${r.audit.invalidQuotes}/${r.audit.totalQuotes}`,
  );
}

console.log('\n===== 混淆矩阵（行为人工标注，列为模型判定）=====');
console.log(`${''.padEnd(14)}${VERDICTS.map((v) => v.padEnd(14)).join('')}`);
for (const truth of VERDICTS) {
  console.log(
    `${truth.padEnd(14)}${VERDICTS.map((p) => String(matrix[truth][p]).padEnd(14)).join('')}`,
  );
}

const pct = (n) => (Number.isNaN(n) ? '样本不足' : `${n.toFixed(1)}%`);

console.log('\n===== 验收指标 =====');
console.log(`样本数              ${ok.length}（失败 ${failed.length}）`);
console.log(`三档判定一致率      ${pct(agreementRate)}   目标 >= 70%`);
console.log(`引流帖召回率        ${pct(adRecall)}   目标 >= 80%`);
console.log(`证据幻觉率          ${pct(hallucinationRate)}   目标 = 0%（作废后不影响结论）`);
console.log(`题目抽取召回率      ${pct(extractionRecall)}   目标 >= 80%`);
console.log(`总耗时              ${((Date.now() - started) / 1000).toFixed(1)}s`);

const report = {
  ranAt: new Date().toISOString(),
  sampleCount: ok.length,
  failedCount: failed.length,
  agreementRate,
  adRecall,
  hallucinationRate,
  extractionRecall,
  matrix,
  details: results.map((r) => ({
    id: r.id,
    truth: r.label.verdict,
    predicted: r.analysis?.verdict ?? null,
    error: r.error ?? null,
  })),
};

await writeFile(
  new URL('../eval/report.json', import.meta.url),
  JSON.stringify(report, null, 2),
  'utf8',
);
console.log('\n报告已写入 eval/report.json');
