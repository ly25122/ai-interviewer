import { chat, parseJson } from '../llm';

/**
 * 连续两轮都能给出新增事实即认定掌握。
 *
 * 这个数字是回测出来的，不是拍脑袋定的：门槛设为三轮时，连刻意扮演的「真做过项目」
 * 的回答也会在第三轮开始复述前面说过的内容，导致所有考点无一幸免地判为不稳。
 * 一张全红的地图只会加重焦虑，而产品的目的恰恰相反。
 * 两轮已经足以区分「背过八股」和「真做过」——前者往往第一轮就露馅。
 */
export const MAX_PROBE_TURNS = 2;

export interface ProbeTurnInput {
  question: string;
  answer: string;
}

export interface ProbeStepInput {
  topicTitle: string;
  /** 该考点在面经中出现过的真实问法，让追问贴近真实面试而非凭空生成 */
  variants: string[];
  turns: ProbeTurnInput[];
}

export interface ProbeStepResult {
  /** 对最后一轮回答的判定。首轮尚无回答可判，为 null */
  judgement: { hasNewFact: boolean; reason: string } | null;
  outcome: 'continue' | 'verified' | 'collapsed';
  nextQuestion?: string;
}

const PROBE_SYSTEM_PROMPT = `你是一名技术面试官，正在就某一个考点深挖候选人。

你的目标不是评价回答得好不好，而是判断一件事：
**这次回答里，有没有出现新增的、可被验证的具体事实。**

判定为「有信息增量」的情形：
- 说出了具体机制、步骤、数据结构、参数、量级
- 举出了具体场景、具体做法、具体取舍
- 明确指出了边界条件或失效情况

判定为「无信息增量」的情形：
- 复述问题，或重复前面已经说过的内容
- 只给结论不给机制，例如「用锁就行了」
- 大量使用「大概」「应该是」「可能」「差不多」这类模糊限定
- 转移话题，或用「这个我们项目里没涉及」回避
- 明确表示不知道

注意：回答简短不等于没有信息增量。一句准确的机制描述，胜过一段空泛的展开。
反过来，长篇大论但全是套话，就是没有信息增量。

追问规则：
- 每一次追问都要针对候选人上一次回答里**最薄弱的一环**继续下潜，而不是换一个新话题
- 追问必须具体，不要问「你能再详细说说吗」这种没有方向的问题
- 语气克制、简短，像真实面试官那样，不要鼓励也不要评价
- 一次只问一个问题

只输出 JSON：
{
  "judgement": { "hasNewFact": true, "reason": "一句话说明依据" },
  "nextQuestion": "下一个追问，如果不再追问则省略"
}

首轮（尚无回答）时，judgement 输出 null，nextQuestion 给出这个考点的开场问题。`;

interface RawProbe {
  judgement?: { hasNewFact?: boolean; reason?: string } | null;
  nextQuestion?: string;
}

export async function probeStep(input: ProbeStepInput): Promise<ProbeStepResult> {
  const isFirstTurn = input.turns.length === 0;

  const context = [
    `【考点】${input.topicTitle}`,
    input.variants.length > 0
      ? `【这个考点在真实面经中的问法】\n${input.variants.map((v) => `- ${v}`).join('\n')}`
      : '',
    isFirstTurn
      ? '【当前状态】尚未开始，请给出开场问题'
      : `【已进行的问答】\n${input.turns
          .map((t, i) => `第${i + 1}轮\n面试官：${t.question}\n候选人：${t.answer}`)
          .join('\n\n')}\n\n请判定候选人最后一次回答有没有信息增量。`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const raw = await chat({
    messages: [
      { role: 'system', content: PROBE_SYSTEM_PROMPT },
      { role: 'user', content: context },
    ],
    temperature: 0.2,
    json: true,
    maxTokens: 800,
  });

  const parsed = parseJson<RawProbe>(raw);

  if (isFirstTurn) {
    return {
      judgement: null,
      outcome: 'continue',
      nextQuestion: parsed.nextQuestion ?? `请讲一下${input.topicTitle}。`,
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
    nextQuestion: parsed.nextQuestion ?? `关于${input.topicTitle}，再具体一点，你怎么验证它有效？`,
  };
}
