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
