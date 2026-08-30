/**
 * 用随机生成的公司/岗位/简历/JD/面经（非 demo、非 lib/samples）走一遍核心链路。
 * 用法：node scripts/smoke-random-flow.mjs [baseUrl]
 */

const BASE = process.argv[2] ?? 'http://localhost:3000';

/** 每次运行换一组材料，避免命中 demo 缓存 */
const seed = Date.now();
const pick = (arr) => arr[seed % arr.length];

const company = pick(['美团', '拼多多', '携程', '哔哩哔哩']);
const role = pick(['Java 后端开发', '后端开发工程师', '服务端开发实习生']);
const dept = pick(['到店', '交易', '用户增长']);

const resume = `
${pick(['李明', '王晨', '赵一'])} · ${pick(['华东师范大学', '同济大学', '南京大学'])} · 计算机 · 2027 届

项目经历
1. 校园二手交易平台（Spring Boot + MySQL + Redis）
   - 负责订单模块：下单接口 QPS 约 800，用 Redis 分布式锁解决并发下单重复问题
   - 库存扣减走 Lua 脚本，异步写 MySQL，消费端手动 ack
   - 分页查询用 MyBatis，慢 SQL 通过索引优化从 800ms 降到 120ms

2. 日志检索小工具（Elasticsearch + Kafka）
   - 接入 Kafka 收集应用日志，Flink 做简单清洗后写入 ES
   - 负责检索 API 与权限校验，日均 20 万条写入

技能：Java、Spring Boot、MySQL、Redis、Kafka、Git
`.trim();

const jd = `
${company} · ${role}（${dept}方向）

岗位职责：
- 参与核心业务服务端开发与维护，保障接口稳定与性能
- 负责需求评审、方案设计、编码与单测
- 排查线上问题，参与容量评估与限流降级治理

任职要求：
- 熟悉 Java，了解 Spring / Spring Boot
- 熟悉 MySQL，了解索引、事务与常见优化
- 了解 Redis、消息队列（Kafka 或 RocketMQ）
- 有高并发、分布式系统项目经验者优先
- 良好的沟通与学习能力
`.trim();

const intelPosts = [
  {
    title: `${company}${dept}后端一面面经（匿名）`,
    content: `
${company}${dept}后端实习一面（约 45 分钟）：
1. 自我介绍
2. 深挖二手交易平台：并发下单怎么防重、Redis 锁过期怎么办、消息重复消费怎么处理
3. MySQL：事务隔离级别、MVCC 大概原理、什么情况下会幻读
4. 算法：链表反转、LRU（口述思路）
面试官追问很细，尤其是项目里「异步落库失败」和「重复消费」两条路径。
`.trim(),
  },
  {
    title: `师兄分享 · ${company}后端二面`,
    content: `
二面偏工程和系统设计：
- 如果下单 QPS 从 800 提到 3000，你会改哪几处？如何做压测口径？
- Kafka 和 RocketMQ 在你项目里为什么这样选？
- 限流做过吗？熔断降级有没有落地？
整体感觉：不会背八股，但要能讲清自己项目里的取舍和失败路径。
`.trim(),
  },
  {
    title: `牛客粘贴 · ${company} Java 后端`,
    content: `
一面还问了 ES 写入延迟、索引怎么设计；二面问了分库分表有没有做过，没做过也问了如果按 user_id 分片后非主键查询怎么办。
HR 面常规。建议把简历里的数字和链路讲扎实。
`.trim(),
  },
];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function post(path, body) {
  const started = Date.now();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data, ms: Date.now() - started };
}

console.log(`===== 随机材料（seed ${seed}）=====`);
console.log(`公司：${company} · 岗位：${role} · 方向：${dept}`);
console.log(`简历 ${resume.length} 字 · JD ${jd.length} 字 · 面经 ${intelPosts.length} 篇\n`);

// 1. 考纲 + 画像（含 JD/简历补全）
const syl = await post('/api/syllabus', {
  company,
  role,
  jd,
  resume,
  posts: intelPosts,
});
assert(syl.ok, `syllabus 失败 ${syl.status}: ${syl.data.error}`);
const { syllabus } = syl.data;
assert(syllabus.topics.length >= 3, `考点过少：${syllabus.topics.length}`);
assert(syllabus.company.includes(company) || syllabus.role.includes(role.split(' ')[0]), '考纲 meta 不对');
console.log(`[syllabus] ${syl.ms}ms · ${syllabus.topics.length} 考点 · aiAugmented=${Boolean(syllabus.aiAugmented)}`);
for (const t of syllabus.topics.slice(0, 5)) {
  console.log(`  · [${t.category}] ${t.title}`);
}

// 2. 出题计划
const questionCount = 4;
const planRes = await post('/api/interview/plan', {
  resume,
  jd,
  intelligence: intelPosts.map((p, i) => ({
    id: `rand-${i}`,
    source: 'paste',
    label: p.title,
    content: p.content,
    trust: 'medium',
  })),
  trainingMode: 'full',
  questionCount,
  difficulty: 'medium',
});
assert(planRes.ok, `plan 失败 ${planRes.status}: ${planRes.data.error}`);
const { plan } = planRes.data;
assert(plan.points.length === questionCount, `题量应为 ${questionCount}，实际 ${plan.points.length}`);
const sources = new Set(plan.points.map((p) => p.source));
assert(sources.size >= 2, `追问点来源单一：${[...sources].join(',')}`);
console.log(`\n[plan] ${planRes.ms}ms · ${plan.points.length} 题 · 来源 ${[...sources].join(', ')}`);
for (const p of plan.points) {
  console.log(`  · [${p.source}] ${p.title.slice(0, 48)}…`);
}

// 3. 参考答案（此前 maxTokens 截断会在这里炸）
const point = plan.points[0];
const firstQ = point.probeQuestions?.[0] ?? point.title;
const refRes = await post('/api/interview/reference', {
  resume,
  jd,
  point,
  question: firstQ,
  intelligence: intelPosts.map((p, i) => ({
    id: `rand-${i}`,
    source: 'paste',
    label: p.title,
    content: p.content,
    trust: 'medium',
  })),
});
assert(refRes.ok, `reference 失败 ${refRes.status}: ${refRes.data.error}`);
const ref = refRes.data.reference;
assert(
  (ref.points?.length ?? 0) >= 1 || (ref.sample?.trim().length ?? 0) >= 40,
  '参考答案为空或过短',
);
assert(
  ref.sample?.includes('Redis') ||
    ref.sample?.includes('锁') ||
    ref.sample?.includes('订单') ||
    ref.points?.some((x) => /Redis|锁|订单|并发|Kafka/i.test(x)),
  '参考答案与当前题（并发/订单/Redis）无关，可能答偏了',
);
console.log(`\n[reference] ${refRes.ms}ms · 采分点 ${ref.points?.length ?? 0} · 范例 ${ref.sample?.length ?? 0} 字`);
for (const p of (ref.points ?? []).slice(0, 4)) console.log(`  · ${p}`);
if (ref.sample) console.log(`  范例：${ref.sample.slice(0, 120)}…`);

console.log('\n===== 全部通过 =====');
