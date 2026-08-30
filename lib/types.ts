/**
 * 核心判断：帖子的「商业意图」与题目内容的「可用性」是两件独立的事。
 * 一篇引流广告帖里的面试题可能完全真实，一篇看似真诚的帖子也可能是编造的。
 * 因此 verdict 与 contentTrust 分开输出，不合并成单一分数。
 */

/** 帖子整体性质的三档结论。不输出数值分——分数会被追问校准依据，分档加证据更站得住。 */
export type Verdict = 'trustworthy' | 'suspicious' | 'promotional';

/** 题目内容能否进入题库 */
export type ContentTrust = 'usable' | 'partial' | 'unusable';

export type SignalDimension =
  | 'commercial' // 商业意图：引流话术、联系方式、课程/内推/资料
  | 'specificity' // 细节密度：具体追问链、报错、参数、时间地点
  | 'narrative' // 叙事完整性：是否含负面细节，还是全程爽文
  | 'author' // 账号画像：发帖公司多样性、题材单一度
  | 'recency'; // 时效性：发布时间、是否提及已变更流程

/** 该信号对可信度的贡献方向 */
export type SignalLevel = 'positive' | 'neutral' | 'negative';

export interface EvidenceSignal {
  dimension: SignalDimension;
  level: SignalLevel;
  /** 一句话说明判断依据 */
  reason: string;
  /** 原文片段。必须逐字摘自原文，用于让用户自行核验，不允许改写或编造 */
  quotes: string[];
}

export interface InterviewQuestion {
  text: string;
  /** 一面 / 二面 / 三面 / HR 面 / 未知 */
  round?: string;
  /** 追问链：面试官在这道题之后继续深挖的问题 */
  followUps?: string[];
  /** 技术领域标签，用于题库聚合去重 */
  topic?: string;
}

export interface ExtractedInterview {
  company?: string;
  role?: string;
  round?: string;
  /** 面试发生时间，非发帖时间 */
  interviewDate?: string;
  outcome?: 'offer' | 'rejected' | 'pending' | 'unknown';
  questions: InterviewQuestion[];
}

export interface PostAnalysis {
  verdict: Verdict;
  /** 主导理由，一句话，直接显示在插件角标上 */
  headline: string;
  contentTrust: ContentTrust;
  signals: EvidenceSignal[];
  extracted: ExtractedInterview;
}

/** 分析引擎的输入。author 与 publishedAt 可缺省，缺省时对应维度降级为 neutral */
export interface AnalyzeInput {
  /** 帖子正文 */
  content: string;
  title?: string;
  publishedAt?: string;
  author?: {
    /** 入库前已哈希化，不保留昵称原文 */
    idHash?: string;
    /** 近期发帖涉及的公司名列表，用于识别「一个人不可能 30 天面 27 家」 */
    recentPostCompanies?: string[];
    recentPostCount?: number;
  };
  /** 评论区片段，用于识别机构在评论区的同质化引流 */
  comments?: string[];
}

/** 证据审计结果。既用于界面标注降级情况，也用于评测集统计幻觉率 */
export interface EvidenceAudit {
  totalQuotes: number;
  /** 无法在原文中逐字找到的引用数量 */
  invalidQuotes: number;
  /** 因证据不成立而被强制降级为 neutral 的维度 */
  downgraded: SignalDimension[];
}

export interface AnalyzeResult {
  analysis: PostAnalysis;
  audit: EvidenceAudit;
}

/* ===================== 第一层：考纲 ===================== */

/** 溯源记录。用户必须能追到每个考点是从哪篇面经来的，否则考纲不可信 */
export interface TopicSource {
  postId: string;
  verdict: Verdict;
  /** 面试发生时间，用于时效衰减 */
  interviewDate?: string;
  /** 该来源贡献的权重 = 可信度权重 x 时效衰减 */
  contribution: number;
  /** 原始题目文本，保留措辞 */
  originalText: string;
}

/** 考纲中的一个考点，由多篇面经中的同义题目归并而来 */
export interface SyllabusTopic {
  id: string;
  /** 归并后的考点名称，如「Redis 缓存击穿与应对」 */
  title: string;
  /** 技术领域，用于分组展示 */
  category: string;
  /** 排序依据为权重求和，而非出现次数——一篇高可信面经胜过五篇广告帖 */
  weight: number;
  /** 同一考点下的不同问法，保留以体现真实措辞 */
  variants: string[];
  sources: TopicSource[];
}

export interface Syllabus {
  company: string;
  role: string;
  topics: SyllabusTopic[];
  /** 由多少篇面经聚合而来，需向用户明示以交代可信度 */
  postCount: number;
  generatedAt: string;
  /** 情报不足时，部分考点由模型根据 JD / 简历补全 */
  aiAugmented?: boolean;
}

/* ===================== 第二层：自评 ===================== */

/** 三档快评。不要求用户输入文字，目的只是快速建立位置感 */
export type SelfRating = 'confident' | 'unsure' | 'unknown';

/* ===================== 第三层：实测 ===================== */

/** collapsed 表示自评会但经不起追问——这是产品要暴露的核心落差 */
export type ProbeOutcome = 'verified' | 'collapsed' | 'not_probed';

/**
 * 单轮追问的判定。
 * 关键：不评价答案好坏，只检测信息增量。这是与「让 ChatGPT 扮演面试官」的根本区别。
 */
export interface ProbeTurn {
  question: string;
  answer: string;
  /** 回答中是否出现新增的可验证事实。复述、「大概」「应该是」、转移话题均为 false */
  hasNewFact: boolean;
  judgement: string;
}

export interface ProbeSession {
  topicId: string;
  turns: ProbeTurn[];
  outcome: ProbeOutcome;
  /** 在第几轮崩掉，未崩为 null */
  collapsedAtTurn: number | null;
}

/* ===================== 准备度地图 ===================== */

/**
 * verified 实测确认 / claimed 自评会但未验证 / shaky 模糊或被追问打回
 * gap 不会 / unrated 未评估
 */
export type TopicStatus = 'verified' | 'claimed' | 'shaky' | 'gap' | 'unrated';

export interface ReadinessCell {
  topicId: string;
  title: string;
  category: string;
  weight: number;
  status: TopicStatus;
  selfRating?: SelfRating;
  probe?: ProbeSession;
}

/** 只给三条。焦虑的人需要明确的下一步，一长串待办清单只会加重压力 */
export interface NextAction {
  topicId: string;
  title: string;
  /** 为什么是这一条：考点权重高，且是你的缺口 */
  reason: string;
}

export interface ReadinessMap {
  cells: ReadinessCell[];
  total: number;
  /** 已覆盖数 = verified + claimed */
  covered: number;
  /** 自评与实测的落差数。这是整个产品最核心的那个数字 */
  gapCount: number;
  nextThree: NextAction[];
}

/* ===================== 备战项目 ===================== */

/** 用户心智阶段。面试提纲是内部产物，不单独成阶段。 */
export type PrepPhase = 'setup' | 'intel' | 'profile' | 'practice' | 'review';

/** 针对性训练：完整模拟，或只练情报/高频弱点 */
export type TrainingMode = 'full' | 'intel';

export type PracticeDifficulty = 'easy' | 'medium' | 'hard';

export interface PracticePrefs {
  durationMin: number;
  questionCount: number;
  difficulty: PracticeDifficulty;
}

/**
 * 一次备战围绕一个目标岗位展开。
 * 以后可扩展为多个目标（字节大数据 / 腾讯后台），当前 MVP 同时只跑一个。
 */
export interface PrepProject {
  id: string;
  company: string;
  role: string;
  resume: string;
  jd: string;
  intelligence: IntelligenceItem[];
  syllabus?: Syllabus;
  readiness?: ReadinessMap;
  interviewDate?: string;
}

/* ===================== 简历 × JD 面试 ===================== */

/* ===================== 面试情报 ===================== */

/**
 * 情报来源分两条路：
 * 用户主动提供（护城河，很多情报根本不在搜索引擎里）：
 *   paste — 直接粘贴文本（微信整理、师兄口述）
 *   file  — 上传 PDF / 截图 / Markdown / TXT
 *   url   — 用户给的链接，系统抓正文
 * 系统自动获取：
 *   web   — 系统检索到的公开面经 / GitHub 仓库 / 牛客 / 博客 / 招聘信息
 */
export type IntelSource = 'paste' | 'file' | 'url' | 'web';

/** 用户对该条情报的可信度标注，影响出题权重 */
export type IntelTrust = 'high' | 'medium' | 'low';

export interface IntelligenceItem {
  id: string;
  source: IntelSource;
  /** 一句话来源说明，如「师兄去年面这个组」「牛客帖」「GitHub 面经仓库」 */
  label: string;
  /** 原始链接（url / web 来源时有） */
  url?: string;
  /** 站点，如 nowcoder.com */
  platform?: string;
  /** 公开页标注的日期（自动检索时有） */
  publishedAt?: string;
  /** 抽取出的正文 */
  content: string;
  /** 可信度：师兄一手经验 high，公开面经默认 medium，疑似广告 low */
  trust: IntelTrust;
}

/**
 * 追问点来源：
 * resume_match — JD 要求与简历经历重合，最该深挖
 * resume_risk — 简历写得很满但可能站不住（数字、职责过宽）
 * jd_gap — JD 明确要求但简历几乎没写，试探真实水平
 * intel_hit — 面试情报里出现、该岗位/该组真实考过或强调的点
 */
export type AttackSource = 'resume_match' | 'resume_risk' | 'jd_gap' | 'intel_hit';

export interface AttackPoint {
  id: string;
  title: string;
  source: AttackSource;
  /** 为什么要问这个：给用户看，也给追问引擎当上下文 */
  reason: string;
  /** 简历原文摘录，便于用户核验「问的是不是我写的」 */
  resumeQuote?: string;
  /** 对应的 JD 要求摘录 */
  jdRequirement?: string;
  /** 命中的情报摘录（intel_hit 时有），让用户知道这题不是凭空来的 */
  intelQuote?: string;
}

export interface InterviewPlan {
  roleGuess: string;
  companyGuess?: string;
  /** 面试开场一句话，像真实面试官 */
  opening: string;
  points: AttackPoint[];
  generatedAt: string;
}

export interface ResumeInterviewSession {
  pointId: string;
  turns: ProbeTurn[];
  outcome: ProbeOutcome;
  collapsedAtTurn: number | null;
}

/** 一次追问点的可量化记录，用来看今天练了多少、答得怎样、有没有进步 */
export interface PracticeRecord {
  id: string;
  at: string;
  pointTitle: string;
  outcome: ProbeOutcome;
  collapsedAtTurn: number | null;
  factTurns: number;
  totalTurns: number;
  /** 0–100，由信息增量和是否撑住追问算出，不是模型主观打分 */
  score: number;
}

/** 一场训练里单个追问点的完整快照，用于事后回看 */
export interface ReviewPointSnapshot {
  id: string;
  title: string;
  source: AttackSource;
  outcome: ProbeOutcome;
  collapsedAtTurn: number | null;
  score: number;
  turns: ProbeTurn[];
}

/**
 * 一场训练的完整复盘。存在本机，不上传。
 * 够还原：问了什么、你怎么答、判定理由、当时该补哪 3 个。
 */
export interface ReviewArchive {
  id: string;
  /** 同一场反复进出复盘页时用来去重 */
  fingerprint: string;
  at: string;
  company: string;
  role: string;
  mode: TrainingMode;
  /** 对应这场提纲的生成时间，同一场继续练完时覆盖而不是新开一条 */
  planAt: string;
  verified: number;
  shaky: number;
  uncovered: number;
  avgScore: number;
  nextThree: NextAction[];
  points: ReviewPointSnapshot[];
}

/** 对照 JD / 面试结果给出的简历修改建议 */
export type ResumeEditKind = 'strengthen' | 'soften' | 'add' | 'cut';

export interface ResumeEdit {
  id: string;
  kind: ResumeEditKind;
  /** 简历里要改的原文；新增条目可省略 */
  target?: string;
  suggestion: string;
  reason: string;
}

/** 参考答案：面试官想听到的要点 + 一段可照着组织的范例表述 */
export interface ReferenceAnswer {
  /** 采分点，逐条 */
  points: string[];
  /** 一段范例回答，提醒用户替换成自己的真实经历 */
  sample: string;
  /** 常见的答歪 / 减分点 */
  pitfalls?: string[];
}
