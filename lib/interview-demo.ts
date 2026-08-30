import type {
  InterviewPlan,
  IntelligenceItem,
  ReferenceAnswer,
  ResumeEdit,
  ResumeInterviewSession,
} from '@/lib/types';
import sample from '@/lib/interview-sample.json';

/**
 * 演示模式数据：用于「不填材料，先看懂流程」。
 * 全部为预置内容，不触发任何 LLM 调用——进入 live 阶段时每个追问点都已有
 * session，页面直接展示回放，因此演示模式可以离线、无 Key 走完整条流程。
 */

export const demoResume = sample.resume;
export const demoJd = sample.jd;

export const demoIntel: IntelligenceItem[] = [
  {
    id: 'demo-intel-1',
    source: 'paste',
    label: '师兄今年上半年面过这个交易组',
    trust: 'high',
    content:
      '师兄今年上半年面了抖音电商交易组的后端实习，交代了几点：一面会死死盯着简历里的秒杀项目往下追——库存到底怎么扣、怎么保证不超卖、Redis 和 DB 怎么保持一致，尤其爱问「如果 Lua 扣减成功但异步落库失败了怎么办」，会一层层追到你答不上来为止。还爱问技术选型题，比如「你为什么用 Kafka 不用 RocketMQ」，答不出选型理由就会被判定是跟着教程做的。分库分表会追分片键选得对不对、非分片键查询怎么走。二面大概率现场系统设计，去年考过「设计一个秒杀系统」和「设计短链服务」。面试官明显不吃背八股，喜欢结合你项目里的真实取舍问。',
  },
  {
    id: 'demo-intel-2',
    source: 'url',
    label: '牛客·字节电商后端实习一面面经',
    url: 'https://www.nowcoder.com/discuss/example',
    trust: 'medium',
    content:
      '字节电商后端实习一面：自我介绍 → 深挖秒杀项目（超卖、幂等、削峰）→ Redis 数据结构与持久化 → MySQL 事务隔离级别、MVCC、间隙锁 → 手撕「无重复字符的最长子串」。二面：分库分表怎么分、分布式事务怎么保证、设计一个订单号生成器。三面偏 HR 与反问。整体追问很细，强度较大。',
  },
];

export const demoPlan: InterviewPlan = {
  roleGuess: '后端开发实习生（电商 - 交易方向）',
  companyGuess: '字节跳动',
  opening:
    '你好，我是这轮的面试官。今天大概 40 分钟，主要顺着你简历上的秒杀项目往下聊，中间穿插一些基础。我更想看你真实的思考，答不上来直说就行。先花一分钟做个自我介绍吧。',
  generatedAt: '2026-08-30T05:00:00.000Z',
  points: [
    {
      id: 'demo-p1',
      title: '秒杀库存扣减：Redis 扣成功但异步落库失败，如何保证一致',
      source: 'intel_hit',
      reason:
        '情报里师兄点名这个组必追这条链路——「Lua 扣减成功但落库失败怎么办」，会一层层追到底。简历正好写了 Redis+Lua 扣减，这是本场最高优先级。',
      resumeQuote: '用 Redis + Lua 脚本实现库存原子扣减，解决高并发下超卖问题',
      intelQuote: '尤其爱问「如果 Lua 扣减成功但异步落库失败了怎么办」，会一层层追到你答不上来为止',
    },
    {
      id: 'demo-p2',
      title: '技术选型：为什么用 Kafka 削峰而不是 RocketMQ',
      source: 'intel_hit',
      reason:
        '情报明确说这个组爱问选型理由，答不出就被判定是照教程做的。简历里 Kafka 和 RocketMQ 都写了，正好对撞。',
      resumeQuote: '引入 Kafka 对下单请求削峰，异步落库',
      intelQuote: '还爱问技术选型题，比如「你为什么用 Kafka 不用 RocketMQ」',
    },
    {
      id: 'demo-p3',
      title: '下单幂等：消费端重复消费如何不生成两个订单',
      source: 'resume_match',
      reason:
        '异步落库必然面临重复消费，JD 也点名「幂等」。这是能拿分的硬骨头，确认你真的处理过。',
      resumeQuote: '引入 Kafka 对下单请求削峰，异步落库',
      jdRequirement: '理解高并发常见问题：缓存穿透 / 击穿 / 雪崩、超卖、幂等、分布式一致性',
    },
    {
      id: 'demo-p4',
      title: '分库分表：按 user_id 分片后，非分片键查询怎么走',
      source: 'resume_risk',
      reason:
        '简历写了按 user_id 分 8 库 64 表，但按订单号 / 时间查就会全库扇出。情报也说会追分片键，专门验证这块是不是你主导做的。',
      resumeQuote: '参与订单库分库分表改造（按 user_id 哈希分 8 库 64 表）',
    },
    {
      id: 'demo-p5',
      title: '稳定性：只有限流够不够，熔断和降级你落地过吗',
      source: 'jd_gap',
      reason:
        'JD 把限流熔断降级列为加分项，简历只有 Sentinel 限流。缺口点，提前想清楚大促下慢调用怎么扛。',
      jdRequirement: '了解分布式事务、限流熔断降级、服务治理',
    },
    {
      id: 'demo-p6',
      title: 'MySQL 可重复读下的幻读与 Next-Key Lock',
      source: 'resume_match',
      reason:
        '牛客面经明确考了事务隔离与间隙锁，是这个组的常规八股。结合项目问，答准能加印象分。',
      resumeQuote: 'MySQL、Redis、Kafka、RocketMQ、Elasticsearch',
      jdRequirement: '熟悉 MySQL、Redis，理解索引、事务与锁',
    },
  ],
};

export const demoSessions: Record<string, ResumeInterviewSession> = {
  'demo-p1': {
    pointId: 'demo-p1',
    outcome: 'verified',
    collapsedAtTurn: null,
    turns: [
      {
        question:
          '你用 Redis + Lua 原子扣减库存，扣减成功之后订单是怎么落到 MySQL 的？这两步之间的一致性怎么保证？',
        answer:
          'Lua 扣减成功后，我把下单请求发到 Kafka，消费端异步落库。为了不丢消息，生产端 acks=all、开了重试，消费端手动提交 offset、落库成功再提交，保证 at-least-once。',
        hasNewFact: true,
        judgement: '说清了异步链路和可靠性投递配置，是自己搭过的样子，继续往异常路径追。',
      },
      {
        question:
          '那如果 Lua 扣减已经成功，但在发 Kafka 之前应用进程就宕了——库存少了一件、订单却没生成，这一件怎么找回来？',
        answer:
          '这种情况我加了本地消息表 + 定时补偿：扣减成功后先往本地消息表写一条 pending 记录，再发 Kafka；发送失败或超时的记录由定时任务扫出来重发。另外每天有对账任务，比对 Redis 扣减流水和已生成订单，把多扣的库存回补回去。',
        hasNewFact: true,
        judgement: '引入本地消息表和对账兜底，思路完整。但「先扣减再写本地表」这里有缝，追一下。',
      },
      {
        question:
          '你说扣减成功后再写本地消息表——可 Redis 扣减和写 MySQL 本地表并不在一个事务里，如果写本地表这一步又失败了呢？你前面说的「一个本地事务」到底指什么？',
        answer:
          '嗯……严格讲它俩确实不在一个事务里，我表述不准。真实做法是：Lua 扣减成功后写本地消息表，如果写表失败，就再调一次 Lua 把库存加回去做补偿，所以是靠补偿而不是事务保证的最终一致；能接受极小概率的补偿窗口。',
        hasNewFact: true,
        judgement:
          '被追到缝隙时没有硬撑，主动修正了「一个事务」的说法并讲清补偿机制——这种自我纠偏比背标准答案更可信。撑住了。',
      },
    ],
  },
  'demo-p2': {
    pointId: 'demo-p2',
    outcome: 'collapsed',
    collapsedAtTurn: 2,
    turns: [
      {
        question:
          '你削峰用了 Kafka，但简历中间件里 RocketMQ 也写了。这个场景为什么选 Kafka 不选 RocketMQ？',
        answer: '因为团队里 Kafka 用得比较多，基础设施现成，接入快一些。',
        hasNewFact: false,
        judgement: '只给了「团队在用」这种外部原因，没有触及两者在这个场景的技术差异，继续逼一层。',
      },
      {
        question:
          '抛开团队现状，从技术特性上讲：秒杀削峰这种场景，RocketMQ 的事务消息、定时/延时消息其实很贴合，Kafka 反而要自己补。你当时对比过这些吗？',
        answer: '这个……我确实没有仔细对比过它们的事务消息和延时消息，主要是跟着现有架构走的。',
        hasNewFact: false,
        judgement:
          '正是情报预警的「答不出选型理由」。技术选型只有「跟着现有架构」，没有自己的权衡——这是准备时必须补上的短板。',
      },
    ],
  },
  'demo-p3': {
    pointId: 'demo-p3',
    outcome: 'verified',
    collapsedAtTurn: null,
    turns: [
      {
        question:
          'Kafka at-least-once 意味着消费端可能重复消费同一条下单消息，会不会生成两个订单？你怎么保证幂等？',
        answer:
          '会有风险。我在下单消息里带了一个幂等号（user_id + 活动 id + 客户端下单序号 哈希），落库前先用 SETNX 抢这个幂等号，抢到才落库，抢不到说明已经处理过，直接丢弃。',
        hasNewFact: true,
        judgement: '用业务维度的幂等号 + SETNX，方案正确，追一下边界。',
      },
      {
        question:
          '那个 SETNX 的 key 设过期时间吗？不设会怎样，设太短又会怎样？',
        answer:
          '设了，大概 10 分钟。不设 key 会无限堆积占内存；设太短的话，如果消费积压超过了过期时间，重复消息又会被当成新消息放行、导致重复落库，所以过期时间要大于最大重试和积压窗口。另外为了兜底，订单表在幂等号上加了唯一索引，真重复了也会被 DB 挡下。',
        hasNewFact: true,
        judgement: '把过期时间的两难和 DB 唯一索引兜底都讲到了，考虑到了缓存失效后的最终防线。扎实，通过。',
      },
    ],
  },
  'demo-p4': {
    pointId: 'demo-p4',
    outcome: 'collapsed',
    collapsedAtTurn: 2,
    turns: [
      {
        question:
          '你们按 user_id 哈希分 8 库 64 表。那运营要按订单号查一笔订单，或者按时间范围拉一批订单，这些查询怎么走？',
        answer:
          '按订单号查的话，因为订单号里没有编码 user_id，确实定位不到具体分片，只能广播到所有库表去查。',
        hasNewFact: true,
        judgement: '诚实地承认了广播查询，但这本身暴露了分片设计的代价，继续追工程落地。',
      },
      {
        question:
          '广播查询在 64 张表上扇出，大促期间这类查询一多就很危险。你们线上是怎么治理的——基因法把 user_id 编进订单号？还是建异构索引表？这块是你做的吗？',
        answer:
          '说实话分片方案主要是我 mentor 设计的，我负责接入 ShardingSphere、改配置和 SQL。订单号编码 user_id、异构索引这些我听说过，但具体怎么落地的我了解得不深。',
        hasNewFact: false,
        judgement:
          '追到工程治理层就退到「mentor 做的、我接入」。简历这条写得像主导者，实际参与深度有限——面试官会顺势降低对你系统设计能力的判断。',
      },
    ],
  },
  'demo-p5': {
    pointId: 'demo-p5',
    outcome: 'collapsed',
    collapsedAtTurn: 2,
    turns: [
      {
        question:
          'JD 把熔断降级列为加分项，你简历只写了 Sentinel 限流。限流、熔断、降级这三个你实际配置过哪些，分别解决什么问题？',
        answer:
          '限流我配过，用 Sentinel 控 QPS，防止流量打垮下游。熔断和降级我知道概念——熔断是下游故障率高时快速失败、不再打过去，降级是返回兜底结果，但这两个我在项目里没有真正配置过。',
        hasNewFact: true,
        judgement: '概念清晰，也坦诚没实操，给一个更小的场景看能不能推到点子上。',
      },
      {
        question:
          '假设大促时下单依赖的库存服务响应变慢但没完全挂，你只有限流，会发生什么？',
        answer:
          '只有限流不够。慢调用会把下单服务的线程池慢慢占满，连锁把整个下单拖垮，也就是慢调用引发的雪崩。这时候需要基于慢调用比例的熔断快速失败，再加降级返回「排队中」。这个我能想清楚，但确实没在项目里落地过。',
        hasNewFact: false,
        judgement:
          '能现场推出「慢调用→线程池耗尽→雪崩」的因果，理解到位，但对项目而言仍是零实操的缺口。这类点面试要主动坦白 + 给出你会怎么做，别等被戳穿。',
      },
    ],
  },
  'demo-p6': {
    pointId: 'demo-p6',
    outcome: 'verified',
    collapsedAtTurn: null,
    turns: [
      {
        question:
          '你项目用 MySQL，InnoDB 默认可重复读。RR 下还会有幻读吗？InnoDB 是怎么处理的？',
        answer:
          '分两种读：快照读靠 MVCC 的 ReadView，事务内一致，不会看到别的事务新插入的行；当前读（select ... for update、update / delete）靠 Next-Key Lock，也就是记录锁 + 间隙锁，锁住区间不让别的事务插入，所以 RR 下当前读也基本消除了幻读。',
        hasNewFact: true,
        judgement: '把快照读和当前读分开讲，概念准确，加一个更细的坑追它。',
      },
      {
        question:
          'Next-Key Lock 什么时候会退化成只锁记录、放开间隙？举一个真会踩坑的场景。',
        answer:
          '唯一索引等值查询且记录存在时，Next-Key 会退化成只加记录锁，因为唯一性已经保证不会再插入相同值。踩坑场景是唯一索引等值查询但记录不存在：这时会对该间隙加间隙锁，两个事务对同一个不存在的值都加间隙锁、再各自插入，就会互相等待形成死锁——「insert on duplicate」并发下很容易遇到。',
        hasNewFact: true,
        judgement: '不仅答出退化条件，还给出了间隙锁导致死锁的真实并发场景，深度足够。通过。',
      },
    ],
  },
};

/** 演示模式的参考答案预置：无需调用模型，点开即看 */
export const demoReference: Record<string, ReferenceAnswer> = {
  'demo-p1': {
    points: [
      '把链路拆成"预占-确认"两段：Redis+Lua 原子扣减是库存预占，DB 落库是订单确认，中间用可靠消息（MQ）解耦',
      '消息不丢：生产端 acks=all + 本地消息表（或事务消息），消费端手动提交 offset、幂等落库',
      '扣减成功但落库失败的兜底：本地消息表 + 定时补偿重发；再加对账任务比对 Redis 扣减流水与实际订单，多扣的库存回补',
      '明确一致性级别：这是最终一致，接受极小补偿窗口；若要更强一致可用 RocketMQ 事务消息或 TCC',
    ],
    sample:
      '我会把它看成"预占-确认"两段。用户下单先用 Lua 原子扣 Redis 库存做预占，成功后写一条本地消息表并发 MQ，消费端幂等地把订单落 MySQL、再把消息标记完成。如果扣减成功但落库这一步失败，就靠本地消息表的定时任务补偿重发；万一进程在发消息前宕机，还有一个对账任务定期比对扣减流水和订单，把多扣的库存加回去。所以整体是最终一致，能接受一个很短的补偿窗口——这里的具体补偿间隔你替换成你项目里的真实配置。',
    pitfalls: [
      '别说"Redis 扣减和 MySQL 落库在一个事务里"——两者无法共享本地事务，一追就穿',
      '只说"发到 MQ"却答不出消息丢失、进程宕机时怎么兜底',
    ],
  },
  'demo-p2': {
    points: [
      '先点明这个场景的诉求：削峰缓冲、可靠投递，是否需要事务消息 / 延时消息',
      'Kafka：超高吞吐、生态成熟、分区内有序，适合大流量削峰与日志流',
      'RocketMQ：原生事务消息、定时/延时消息、消息回溯，对交易一致性场景更贴',
      '给出你的取舍：纯削峰缓冲 Kafka 足够；若要"扣减+落库"事务一致，RocketMQ 事务消息更省事',
    ],
    sample:
      '选型要看这个场景到底要什么。秒杀削峰的核心诉求是把瞬时洪峰缓冲成平稳的消费速率，这一点 Kafka 的高吞吐和分区顺序完全够用，团队生态也成熟。如果我的诉求进一步是"扣减和落库要保证事务一致"，那 RocketMQ 的事务消息其实更贴，能省掉自己搭本地消息表。所以我的结论是——当前只做削峰用 Kafka，如果后面要强一致我会重新评估 RocketMQ。',
    pitfalls: [
      '只回答"团队在用 Kafka"这种外部原因，等于承认没做技术权衡',
      '把两者说成完全等价，说不出各自擅长的场景',
    ],
  },
  'demo-p3': {
    points: [
      '幂等号取业务唯一键（user_id + 活动 id + 客户端序号 哈希），不要用自增或时间戳',
      '拦截层用 Redis SETNX 抢占，过期时间要大于最大积压/重试窗口',
      '最终防线：订单表在幂等号上建唯一索引，缓存失效也不会重复落库',
      '语义上：MQ 的 at-least-once + 业务幂等 = 有效的 exactly-once',
    ],
    sample:
      '异步落库一定要考虑重复消费。我会在下单消息里带一个业务维度的幂等号，落库前用 SETNX 抢这个号、抢到才处理，过期时间设得比最大消费积压还长，避免积压恢复后重复放行。同时订单表在幂等号上加唯一索引作为最终兜底，即使 Redis 那层失效，DB 也会把重复挡下。这样 MQ 的至少一次加上业务幂等，就等于有效的恰好一次。',
    pitfalls: [
      'SETNX 不设过期→key 堆积泄漏；设太短→积压恢复后重复放行',
      '只靠缓存幂等、不加 DB 唯一索引兜底',
    ],
  },
  'demo-p4': {
    points: [
      '分片键选择原则：覆盖最高频查询、数据分布均匀——按 user_id 适合"我的订单"',
      '非分片键查询的通用解法：基因法（把 user_id 编进订单号，解析出分片）、异构索引表（另建按订单号分片的映射，或用 ES）',
      '运营的时间范围/大批量查询走搜索引擎或离线数仓，不打在线分片库',
      '坦诚取舍：分库分表不是银弹，跨分片聚合/分页代价高，要按查询模式设计',
    ],
    sample:
      '按 user_id 分片能很好地支撑"我的订单"这类查询，但按订单号或时间查就会全库扇出。工程上常见两个解法：一是基因法，把 user_id 的分片位编进订单号，这样拿订单号也能直接定位分片；二是建异构索引表，比如再维护一份按订单号分片的映射，或者把订单同步到 ES 专门给运营查。时间范围的大批量查询我会放到搜索引擎或离线数仓，不去压在线分片库。',
    pitfalls: [
      '简历写"参与"却答不出治理方案，会暴露你其实只是接了配置',
      '把广播查询当成正常方案，不提任何治理手段',
    ],
  },
  'demo-p5': {
    points: [
      '三者定位分清：限流控入口流量、熔断隔离故障依赖、降级保核心可用',
      '关键场景：限流拦不住"慢调用"，慢调用会耗尽线程池引发雪崩，必须靠熔断',
      '熔断触发条件：慢调用比例 / 异常比例超阈值，快速失败一段时间后半开探活',
      '降级策略：返回兜底（排队中/默认值）、异步补偿；Sentinel 除限流外也支持熔断与线程隔离',
    ],
    sample:
      '只有限流是不够的。限流管的是入口 QPS，但如果下游库存服务变慢而不是直接挂，请求会堆在线程池里，慢慢把整个下单服务拖垮，也就是慢调用引发的雪崩。这时候需要基于慢调用比例的熔断，达到阈值就快速失败、过一会儿半开探活；同时对非核心路径降级，返回"排队中"之类的兜底。Sentinel 其实除了 QPS 限流也能配熔断和线程数隔离，我会在这块补上实际配置。',
    pitfalls: [
      '把限流当万能，忽略慢调用场景',
      '只背概念、说不出"慢调用→线程池耗尽→雪崩"这条因果',
    ],
  },
  'demo-p6': {
    points: [
      '分两种读：快照读靠 MVCC 的 ReadView，当前读（for update / update / delete）靠 Next-Key Lock',
      'Next-Key Lock = 记录锁 + 间隙锁，锁住区间不让其他事务插入，从而在 RR 下也能挡当前读的幻读',
      '退化规则：唯一索引等值查询且记录存在→退化为记录锁；记录不存在→加间隙锁',
      '间隙锁的坑：两个事务对同一个不存在的值都加间隙锁再插入，会互相等待形成死锁',
    ],
    sample:
      'RR 下要分快照读和当前读。快照读靠 MVCC 的 ReadView，事务内一致，不会看到别的事务新插入的行；当前读比如 select for update，靠 Next-Key Lock，也就是记录锁加间隙锁，锁住区间不让别人插入，所以 RR 下当前读也基本消除了幻读。要注意退化：唯一索引等值查询且记录存在时会退成记录锁，但记录不存在时会加间隙锁——两个事务对同一个不存在的值都加间隙锁再各自插入，就可能死锁，insert on duplicate 并发下很常见。',
    pitfalls: [
      '混淆快照读和当前读，把两者的机制说反',
      '断言"RR 完全没有幻读"，过于绝对',
    ],
  },
};

export const demoEdits: ResumeEdit[] = [
  {
    id: 'demo-e1',
    kind: 'soften',
    target: '将秒杀下单接口 QPS 从约 2000 提升到 12000',
    suggestion:
      '将秒杀下单接口压测 QPS 从约 2000 提升到约 12000（单机压测，线上未同口径复测）；库存扣减用 Redis + Lua，落库走 Kafka 异步，靠本地消息表 + 对账补偿保证最终一致',
    reason: '数字太满、口径没写。模拟面试里选型和技术细节能讲清，但这个 6 倍提升一追口径就虚。',
  },
  {
    id: 'demo-e2',
    kind: 'strengthen',
    target: '参与订单库分库分表改造（按 user_id 哈希分 8 库 64 表），基于 ShardingSphere 完成分片路由接入',
    suggestion:
      '参与订单库分库分表接入（按 user_id 哈希分 8 库 64 表）：负责 ShardingSphere 路由配置与 SQL 改造；分片方案由 mentor 设计，非分片键查询的治理未独立完成',
    reason: '模拟面试追到非分片键查询就退成「mentor 做的」。写「参与」可以，但要划清自己做了哪一层。',
  },
  {
    id: 'demo-e3',
    kind: 'add',
    suggestion:
      '限流：用 Sentinel 对秒杀下单接口做 QPS 限流 + 热点参数限流。熔断 / 降级未在本项目落地，大促慢调用场景目前只能讲方案、没有线上配置。',
    reason: 'JD 把熔断降级列为加分项，简历只有限流。与其被当面戳穿，不如自己先写清边界。',
  },
  {
    id: 'demo-e4',
    kind: 'cut',
    target: '了解 JVM 内存模型与基础调优',
    suggestion: '删掉这句。JD 不考、简历也没有对应项目，面试官随口一问就会露怯。',
    reason: '技能栏里的「了解」最容易被追，又不是这个岗位的主战场。',
  },
];
