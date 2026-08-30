import { chat, parseJson } from '../llm';
import type {
  AttackPoint,
  AttackSource,
  InterviewPlan,
  IntelligenceItem,
  PracticeDifficulty,
  ReferenceAnswer,
  TrainingMode,
} from '../types';
import { MAX_PROBE_TURNS } from './probe';

const PLAN_SYSTEM = `你是一名技术面试官。目标可能是公司实习，也可能是学校或科研夏令营。你会拿到三份材料：候选人**简历**、这场面试的**选拔要求**（岗位 JD、招生简章或考核说明），以及一批**面试情报**（这场真实考过、强调过的东西，可能来自师兄经验、公开面经、招生信息）。

你的任务不是写鼓励语，而是制定一份**可深挖、且贴近这场面试真实考法**的面试提纲：
找出 4 到 8 个最值得追问的点，按优先级排序。题量以用户指定为准。

四类追问点（source）必须严格区分：
- intel_hit：情报里明确出现、这个岗位/组真实考过或反复强调的点——优先级最高，因为这是"内部消息"。哪怕简历没写，也要问，看候选人有没有准备
- resume_match：JD 明确要求，且简历里有对应经历——主战场，深挖「你到底做了什么」
- resume_risk：简历写得很满（夸张数字、职责过宽、技术栈堆砌）但可能站不住——专门打这些泡沫
- jd_gap：JD 明确要求，简历几乎没写——试探真实水平，允许候选人说不会，但要问清边界

如何用情报：
- 情报是"这个组会怎么考"的线索，用来校准出题方向和难度；优先把情报里反复出现的考点做成 intel_hit
- 情报可信度分 high/medium/low，low（疑似广告/泛化）仅作弱参考，不要据此编造具体考题
- 若没有情报，就只用简历×JD 出题

硬约束：
1. resumeQuote / jdRequirement / intelQuote 必须尽量逐字摘自对应输入；找不到就省略该字段，禁止编造
2. title 要具体，例如「订单系统 QPS 提升 30% 的测量方法」，不要「项目经历」这种空标题
3. reason 一句话说清为什么问这个（intel_hit 要点明"情报显示这个组考过/强调过"）
4. 优先技术实习常见深挖：项目数字、设计取舍、故障排查、与 JD 技能栈对齐处
5. 必须按用户指定的难度改变追问角度，三档不要出成同一组标题

只输出 JSON：
{
  "roleGuess": "推断的目标岗位",
  "companyGuess": "若能看出公司则填写，否则省略",
  "opening": "面试开场白，一两句，克制、像真人面试官",
  "points": [
    {
      "id": "p1",
      "title": "具体追问点标题",
      "source": "intel_hit | resume_match | resume_risk | jd_gap",
      "reason": "为什么问",
      "resumeQuote": "简历原文片段，可省略",
      "jdRequirement": "JD 原文片段，可省略",
      "intelQuote": "情报原文片段，intel_hit 时尽量给，可省略"
    }
  ]
}`;

const STEP_SYSTEM = `你是一名技术面试官，正在基于候选人的**简历**和这场面试的**选拔要求**做深挖。

你不是闲聊，也不是背八股。你只做两件事：
1. 判断候选人最后一次回答有没有**新增的、可被验证的具体事实**
2. 针对其回答里最薄弱的一环继续下潜——必须扣住当前追问点，以及简历/JD 原文

判定为「有信息增量」：具体机制、参数、量级、场景、取舍、边界、你本人的动作。
判定为「无信息增量」：复述、套话、「大概/应该是」、转移话题、把团队功劳说成自己却说不清细节、明确不知道。

追问规则：
- 一次只问一个问题
- 禁止「再详细说说」这类无方向追问
- 语气克制，不鼓励不评价
- 如果候选人承认不会，可以换一个更小的切入点再试一轮；若仍无增量则判 collapsed

只输出 JSON：
{
  "judgement": { "hasNewFact": true, "reason": "一句话" },
  "nextQuestion": "下一个追问，结束时可省略"
}

首轮（尚无回答）时 judgement 为 null，nextQuestion 给出开场问题——必须直接引用简历或 JD 里的具体表述。`;

interface RawPlan {
  roleGuess?: string;
  companyGuess?: string;
  opening?: string;
  points?: Array<{
    id?: string;
    title?: string;
    source?: string;
    reason?: string;
    resumeQuote?: string;
    jdRequirement?: string;
    intelQuote?: string;
  }>;
}

interface RawStep {
  judgement?: { hasNewFact?: boolean; reason?: string } | null;
  nextQuestion?: string;
}

const SOURCES: AttackSource[] = ['resume_match', 'resume_risk', 'jd_gap', 'intel_hit'];

const TRUST_LABEL: Record<string, string> = {
  high: '高可信·一手',
  medium: '中等·公开',
  low: '存疑·可能含广告',
};

function difficultyHint(difficulty: PracticeDifficulty): string {
  if (difficulty === 'easy') {
    return [
      '【难度·舒适】',
      '只问候选人做过的部分和成功路径：怎么做的、用了什么、自己负责哪一段。',
      '标题写成「XX 是怎么做的 / 实现细节」，不要把失败路径、容量估算、数字口径对质当作主轴。',
    ].join('');
  }
  if (difficulty === 'hard') {
    return [
      '【难度·加压】',
      '至少一半标题必须落到失败路径、数字口径对质或权衡（例如「如果失败怎么办」「这个数字怎么测出来的」）。',
      '禁止写成「实现细节」「如何保证」这种舒适/常规问法。同一考点也必须和常规档换角度。',
      '开场就可以下潜，不要先寒暄机制。',
    ].join('');
  }
  return [
    '【难度·常规】',
    '机制问清后再追一层边界。',
    '标题可以点到边界，但不要用失败路径或数字口径对质当主轴——那是加压档。',
  ].join('');
}
function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n…（已截断）`;
}

/** 把多条情报拼成给模型看的文本，同时返回可用于引用核验的语料 */
function buildIntel(items: IntelligenceItem[] | undefined): {
  prompt: string;
  corpus: string;
} {
  const list = (items ?? []).filter((it) => it?.content?.trim());
  if (list.length === 0) {
    return { prompt: '（本次没有额外情报，仅凭简历与 JD 出题）', corpus: '' };
  }
  const blocks = list.map((it, i) => {
    const trust = TRUST_LABEL[it.trust] ?? it.trust;
    const head = `情报${i + 1}｜${it.label || '未命名'}｜可信度：${trust}${
      it.url ? `｜来源：${it.url}` : ''
    }`;
    return `${head}\n${clip(it.content, 3000)}`;
  });
  return { prompt: blocks.join('\n\n'), corpus: list.map((it) => it.content).join('\n') };
}

/** 引用必须能在原文里找到；找不到就丢掉，防止模型编造简历内容 */
function keepIfPresent(quote: string | undefined, haystack: string): string | undefined {
  if (!quote?.trim()) return undefined;
  const q = quote.trim();
  if (haystack.includes(q)) return q;
  // 允许轻微空白差异：去掉空白再比
  const compact = (s: string) => s.replace(/\s+/g, '');
  const hq = compact(haystack);
  const cq = compact(q);
  if (cq.length >= 8 && hq.includes(cq)) return q;
  return undefined;
}

export async function planResumeInterview(
  resume: string,
  jd: string,
  intelligence?: IntelligenceItem[],
  opts: {
    trainingMode?: TrainingMode;
    questionCount?: number;
    difficulty?: PracticeDifficulty;
  } = {},
): Promise<InterviewPlan> {
  const trainingMode = opts.trainingMode ?? 'full';
  const questionCount = opts.questionCount ?? 6;
  const difficulty = opts.difficulty ?? 'medium';
  const resumeText = clip(resume, 12000);
  const jdText = clip(jd, 8000);
  const intel = buildIntel(intelligence);
  const diffHint = `\n\n${difficultyHint(difficulty)}`;
  const modeHint =
    trainingMode === 'intel'
      ? '\n\n【训练模式】情报针对训练：优先且尽量只出 intel_hit。简历与 JD 只作上下文，不要把主战场放在简历数字或 JD 缺口上。'
      : '';
  const countHint = `\n\n【题量】请给出 ${questionCount} 个追问点，不要多也不要少。`;

  const raw = await chat({
    messages: [
      { role: 'system', content: PLAN_SYSTEM },
      {
        role: 'user',
        content: `【简历】\n${resumeText}\n\n【岗位 JD】\n${jdText}\n\n【面试情报】\n${intel.prompt}${modeHint}${diffHint}${countHint}`,
      },
    ],
    temperature: 0.2,
    json: true,
    maxTokens: 2500,
  });

  const parsed = parseJson<RawPlan>(raw);
  const points: AttackPoint[] = (parsed.points ?? [])
    .filter((p) => p?.title?.trim())
    .slice(0, questionCount)
    .map((p, i) => {
      const source = SOURCES.includes(p.source as AttackSource)
        ? (p.source as AttackSource)
        : 'resume_match';
      return {
        id: p.id?.trim() || `p${i + 1}`,
        title: p.title!.trim(),
        source,
        reason: p.reason?.trim() || '与目标岗位高度相关',
        resumeQuote: keepIfPresent(p.resumeQuote, resumeText),
        jdRequirement: keepIfPresent(p.jdRequirement, jdText),
        intelQuote: keepIfPresent(p.intelQuote, intel.corpus),
      };
    });

  if (points.length === 0) {
    throw new Error('未能从简历与 JD 生成有效追问点，请检查文本是否完整');
  }

  const ordered =
    trainingMode === 'intel'
      ? [...points.filter((p) => p.source === 'intel_hit'), ...points.filter((p) => p.source !== 'intel_hit')].slice(
          0,
          questionCount,
        )
      : points;

  return {
    roleGuess: parsed.roleGuess?.trim() || '技术实习',
    companyGuess: parsed.companyGuess?.trim() || undefined,
    opening:
      parsed.opening?.trim() ||
      '我们按你的简历和这场面试的选拔要求来聊，我会针对你写过的经历往下追。',
    points: ordered,
    generatedAt: new Date().toISOString(),
  };
}

export interface ResumeInterviewStepInput {
  resume: string;
  jd: string;
  point: AttackPoint;
  turns: Array<{ question: string; answer: string }>;
  intelligence?: IntelligenceItem[];
  difficulty?: PracticeDifficulty;
}

export interface ResumeInterviewStepResult {
  judgement: { hasNewFact: boolean; reason: string } | null;
  outcome: 'continue' | 'verified' | 'collapsed';
  nextQuestion?: string;
}

export async function resumeInterviewStep(
  input: ResumeInterviewStepInput,
): Promise<ResumeInterviewStepResult> {
  const isFirst = input.turns.length === 0;
  const resumeText = clip(input.resume, 8000);
  const jdText = clip(input.jd, 5000);
  const point = input.point;

  const intel = buildIntel(input.intelligence);
  const difficulty = input.difficulty ?? 'medium';

  const context = [
    `【当前追问点】${point.title}`,
    `【类型】${point.source}`,
    `【为何问】${point.reason}`,
    difficultyHint(difficulty),
    point.resumeQuote ? `【简历原文】${point.resumeQuote}` : '',
    point.jdRequirement ? `【JD 要求】${point.jdRequirement}` : '',
    point.intelQuote ? `【命中情报】${point.intelQuote}` : '',
    `【简历全文（节选）】\n${resumeText}`,
    `【JD 全文（节选）】\n${jdText}`,
    `【面试情报（可作追问方向参考，但仍以候选人真实经历为准）】\n${intel.prompt}`,
    isFirst
      ? '【当前状态】尚未开始，请给出开场问题'
      : `【已进行的问答】\n${input.turns
          .map((t, i) => `第${i + 1}轮\n面试官：${t.question}\n候选人：${t.answer}`)
          .join('\n\n')}\n\n请判定最后一次回答有没有信息增量，并决定是否继续追问。`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const raw = await chat({
    messages: [
      { role: 'system', content: STEP_SYSTEM },
      { role: 'user', content: context },
    ],
    temperature: 0.2,
    json: true,
    maxTokens: 900,
  });

  const parsed = parseJson<RawStep>(raw);

  if (isFirst) {
    return {
      judgement: null,
      outcome: 'continue',
      nextQuestion:
        parsed.nextQuestion ??
        (point.resumeQuote
          ? `简历里写到「${point.resumeQuote.slice(0, 40)}…」，你具体是怎么做的？`
          : `围绕「${point.title}」讲一下你的实际工作。`),
    };
  }

  const hasNewFact = parsed.judgement?.hasNewFact === true;
  const judgement = {
    hasNewFact,
    reason: parsed.judgement?.reason ?? '',
  };

  if (!hasNewFact) {
    return { judgement, outcome: 'collapsed' };
  }

  if (input.turns.length >= MAX_PROBE_TURNS) {
    return { judgement, outcome: 'verified' };
  }

  return {
    judgement,
    outcome: 'continue',
    nextQuestion:
      parsed.nextQuestion ?? `关于「${point.title}」，再往下说一层：边界条件是什么？`,
  };
}

/* ===================== 参考答案 ===================== */

const REFERENCE_SYSTEM = `你是一名资深技术面试教练。候选人卡在某个面试问题上，想知道"面试官到底想听到什么"。

请给出一份参考答案，服务于"看完能自己组织出来"，而不是背诵。要求：
1. points：3 到 5 条采分点，是这道题的关键结构与必答要素，每条一句话，具体、可操作
2. sample：一段范例回答（120~220 字），像候选人在面试里口述，展示怎么把采分点串起来
3. pitfalls：1 到 3 条常见减分点 / 容易答歪的地方

硬约束：
- 必须紧扣【当前问题】作答。当前问题是什么，参考答案就必须回答什么，禁止换成另一道题的通用答案
- 若没有单独的当前问题，则紧扣【追问点】标题
- 若涉及候选人的项目数字/经历，用占位说法（如"这里替换成你项目里的真实数字"），严禁替候选人编造具体经历冒充事实
- 技术表述必须正确，不确定就给方向而非编造细节
- sample 里要能看出这是在回答哪一道题，不要写成可以套到任何题上的空话

只输出 JSON：
{
  "points": ["采分点1", "采分点2"],
  "sample": "范例回答",
  "pitfalls": ["常见减分点"]
}`;

export interface ReferenceInput {
  resume: string;
  jd: string;
  point: AttackPoint;
  /** 当前被问到的问题；没有则针对追问点整体 */
  question?: string;
  turns?: Array<{ question: string; answer: string }>;
  intelligence?: IntelligenceItem[];
}

export async function referenceAnswer(input: ReferenceInput): Promise<ReferenceAnswer> {
  const point = input.point;
  const intel = buildIntel(input.intelligence);
  const history = (input.turns ?? [])
    .map((t, i) => `第${i + 1}轮\n面试官：${t.question}\n候选人：${t.answer}`)
    .join('\n\n');

  const currentQuestion =
    input.question?.trim() ||
    (input.turns && input.turns.length > 0
      ? input.turns[input.turns.length - 1]?.question
      : undefined);

  const context = [
    currentQuestion
      ? `【当前必须回答的问题】${currentQuestion}\n（参考答案必须直接回答这句话，不能换成别的题）`
      : `【当前必须回答的问题】围绕追问点「${point.title}」给出面试官想听到的答法`,
    `【追问点】${point.title}`,
    `【为何问】${point.reason}`,
    point.resumeQuote ? `【简历原文】${point.resumeQuote}` : '',
    point.jdRequirement ? `【JD 要求】${point.jdRequirement}` : '',
    point.intelQuote ? `【命中情报】${point.intelQuote}` : '',
    history ? `【已进行的问答，仅作上下文，不要回答已经问过的旧问题】\n${history}` : '',
    `【岗位 JD（节选）】\n${clip(input.jd, 3000)}`,
    `【面试情报（可选参考）】\n${intel.prompt}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const raw = await chat({
    messages: [
      { role: 'system', content: REFERENCE_SYSTEM },
      { role: 'user', content: context },
    ],
    temperature: 0.3,
    json: true,
    maxTokens: 2500,
  });

  const parsed = parseJson<{
    points?: string[];
    sample?: string;
    pitfalls?: string[];
  }>(raw);

  const points = (parsed.points ?? [])
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
    .slice(0, 6);
  const pitfalls = (parsed.pitfalls ?? [])
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
    .slice(0, 4);

  if (points.length === 0 && !parsed.sample?.trim()) {
    throw new Error('未能生成参考答案，请稍后重试');
  }

  return {
    points,
    sample: parsed.sample?.trim() ?? '',
    pitfalls: pitfalls.length > 0 ? pitfalls : undefined,
  };
}
