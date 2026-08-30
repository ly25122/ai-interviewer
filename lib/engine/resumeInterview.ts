import { chat, parseJson } from '../llm';
import type { AttackPoint, AttackSource, InterviewPlan } from '../types';
import { MAX_PROBE_TURNS } from './probe';

const PLAN_SYSTEM = `你是一名大厂技术实习招聘的面试官。你会拿到候选人的简历和目标岗位 JD。

你的任务不是写鼓励语，而是制定一份**可深挖的面试提纲**：
找出 4 到 6 个最值得追问的点，按优先级排序。

三类追问点（source）必须严格区分：
- resume_match：JD 明确要求，且简历里有对应经历——这是主战场，必须深挖「你到底做了什么」
- resume_risk：简历写得很满（夸张数字、职责过宽、技术栈堆砌）但可能站不住——专门打这些泡沫
- jd_gap：JD 明确要求，简历几乎没写——试探真实水平，允许候选人说不会，但要问清边界

硬约束：
1. resumeQuote / jdRequirement 必须尽量逐字摘自输入；找不到就省略该字段，禁止编造
2. title 要具体，例如「订单系统 QPS 提升 30% 的测量方法」，不要「项目经历」这种空标题
3. reason 一句话说清为什么问这个
4. 优先技术实习常见深挖：项目数字、设计取舍、故障排查、与 JD 技能栈对齐处

只输出 JSON：
{
  "roleGuess": "推断的目标岗位",
  "companyGuess": "若 JD 能看出公司则填写，否则省略",
  "opening": "面试开场白，一两句，克制、像真人面试官",
  "points": [
    {
      "id": "p1",
      "title": "具体追问点标题",
      "source": "resume_match | resume_risk | jd_gap",
      "reason": "为什么问",
      "resumeQuote": "简历原文片段，可省略",
      "jdRequirement": "JD 原文片段，可省略"
    }
  ]
}`;

const STEP_SYSTEM = `你是一名技术面试官，正在基于候选人的**简历**和**岗位 JD** 做深挖。

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
  }>;
}

interface RawStep {
  judgement?: { hasNewFact?: boolean; reason?: string } | null;
  nextQuestion?: string;
}

const SOURCES: AttackSource[] = ['resume_match', 'resume_risk', 'jd_gap'];

function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n…（已截断）`;
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

export async function planResumeInterview(resume: string, jd: string): Promise<InterviewPlan> {
  const resumeText = clip(resume, 12000);
  const jdText = clip(jd, 8000);

  const raw = await chat({
    messages: [
      { role: 'system', content: PLAN_SYSTEM },
      {
        role: 'user',
        content: `【简历】\n${resumeText}\n\n【岗位 JD】\n${jdText}`,
      },
    ],
    temperature: 0.2,
    json: true,
    maxTokens: 2500,
  });

  const parsed = parseJson<RawPlan>(raw);
  const points: AttackPoint[] = (parsed.points ?? [])
    .filter((p) => p?.title?.trim())
    .slice(0, 6)
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
      };
    });

  if (points.length === 0) {
    throw new Error('未能从简历与 JD 生成有效追问点，请检查文本是否完整');
  }

  return {
    roleGuess: parsed.roleGuess?.trim() || '技术实习',
    companyGuess: parsed.companyGuess?.trim() || undefined,
    opening:
      parsed.opening?.trim() ||
      '我们按你的简历和这个岗位的 JD 来聊，我会针对你写过的经历往下追。',
    points,
    generatedAt: new Date().toISOString(),
  };
}

export interface ResumeInterviewStepInput {
  resume: string;
  jd: string;
  point: AttackPoint;
  turns: Array<{ question: string; answer: string }>;
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

  const context = [
    `【当前追问点】${point.title}`,
    `【类型】${point.source}`,
    `【为何问】${point.reason}`,
    point.resumeQuote ? `【简历原文】${point.resumeQuote}` : '',
    point.jdRequirement ? `【JD 要求】${point.jdRequirement}` : '',
    `【简历全文（节选）】\n${resumeText}`,
    `【JD 全文（节选）】\n${jdText}`,
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
