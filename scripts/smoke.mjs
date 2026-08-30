/**
 * 端到端冒烟测试：用一篇引流帖和一篇真面经验证判定引擎是否可用。
 * 用法：node scripts/smoke.mjs [baseUrl]
 */

const BASE = process.argv[2] ?? 'http://localhost:3000';

const promotional = {
  title: '字节跳动后端开发实习面经｜一面真题整理',
  publishedAt: '2026-08-11',
  author: {
    idHash: 'sample-a',
    recentPostCount: 27,
    recentPostCompanies: ['字节', '腾讯', '阿里', '美团', '快手', '京东', '百度', '滴滴'],
  },
  comments: ['求一份题库', '已私信啦', '蹲一个资料'],
  content: `姐妹们！刚帮学员整理完字节后端实习一面的题目，来给大家分享一下～

一面主要考察这些方向：
1. 自我介绍和项目经历
2. MySQL 索引原理
3. Redis 常见数据结构
4. TCP 三次握手四次挥手
5. 手撕算法：反转链表

整体来说难度适中，把基础打牢就没问题！

我这边整理了一份《大厂后端面试全套题库》，包含答案解析和高频考点总结，
需要的宝子评论区扣「面经」或者直接私信我，免费领取～
关注我，每天更新各大厂最新面经和内推机会！`,
};

const trustworthy = {
  title: '字节后端一面挂了，记录一下被追问到答不上来的全过程',
  publishedAt: '2026-08-20',
  author: { idHash: 'sample-b', recentPostCount: 4, recentPostCompanies: ['字节'] },
  content: `8月12号下午两点面的，面试官全程没开摄像头，说话很慢。

自我介绍完直接问项目。我简历上写了「订单系统性能优化，QPS 提升 30%」，然后就开始被一路深挖：

面试官：这个 30% 是怎么测出来的？
我：用 JMeter 压测的。
面试官：压测环境和线上一致吗？
我：不完全一致，压测是单机，线上是三台。
面试官：那你怎么排除这个提升其实是缓存预热带来的？
我：当时就卡住了，只能含糊说可能有一点影响。

后面还问了 Redis 缓存击穿是什么、怎么解决。我说了互斥锁，
他追问互斥锁在集群环境下有什么问题，我答分布式锁，
他继续问 Redlock 的争议点在哪，我没答上来。

还问了 MySQL 的 MVCC，追问了 ReadView 的生成时机。
手撕 LRU 缓存，写出来了但边界条件没处理好。

一面就凉了。反思下来最大的问题是简历上写的数字自己站不住脚。`,
};

async function analyze(label, payload) {
  const started = Date.now();
  const res = await fetch(`${BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`\n===== ${label} （${elapsed}s） =====`);
  if (!res.ok) {
    console.log(`失败 ${res.status}:`, data.error);
    return null;
  }

  const { analysis, audit } = data;
  console.log(`判定: ${analysis.verdict}  |  题目可用性: ${analysis.contentTrust}`);
  console.log(`主导理由: ${analysis.headline}`);
  console.log(
    `证据核验: 共 ${audit.totalQuotes} 条引用，作废 ${audit.invalidQuotes} 条` +
      (audit.downgraded.length ? `，降级维度 ${audit.downgraded.join('、')}` : ''),
  );
  console.log('--- 五维 ---');
  for (const s of analysis.signals) {
    console.log(`  [${s.level.padEnd(8)}] ${s.dimension.padEnd(12)} ${s.reason}`);
    for (const q of s.quotes) console.log(`             证据: ${q}`);
  }
  console.log(`--- 抽取到 ${analysis.extracted.questions.length} 道题 ---`);
  for (const q of analysis.extracted.questions) {
    console.log(`  · ${q.text}${q.topic ? `  [${q.topic}]` : ''}`);
    for (const f of q.followUps ?? []) console.log(`      追问: ${f}`);
  }
  return analysis;
}

const a = await analyze('引流帖（期望 promotional）', promotional);
const b = await analyze('真面经（期望 trustworthy）', trustworthy);

console.log('\n===== 结论 =====');
console.log(`引流帖判定正确: ${a?.verdict === 'promotional' ? '是' : `否（${a?.verdict}）`}`);
console.log(`真面经判定正确: ${b?.verdict === 'trustworthy' ? '是' : `否（${b?.verdict}）`}`);
