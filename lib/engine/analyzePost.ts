import { chat, parseJson } from '../llm';
import { ANALYZE_SYSTEM_PROMPT, buildAnalyzeUserPrompt } from './prompts';
import type {
  AnalyzeInput,
  AnalyzeResult,
  ContentTrust,
  EvidenceAudit,
  EvidenceSignal,
  PostAnalysis,
  SignalDimension,
  Verdict,
} from '../types';

export type { AnalyzeResult, EvidenceAudit } from '../types';

const ALL_DIMENSIONS: SignalDimension[] = [
  'commercial',
  'specificity',
  'narrative',
  'author',
  'recency',
];

/** 短于此长度的引用不构成有效证据，避免模型摘出「的」「问了」这类无意义片段充数 */
const MIN_QUOTE_LENGTH = 4;

/**
 * 归一化后比对，容忍模型在空白与标点上的细微改动，
 * 但不容忍改写措辞——那已经属于编造证据。
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。！？；：、「」『』（）()【】\[\]"'“”‘’,.!?;:~～\-—_]/g, '');
}

/**
 * 防幻觉的最后一道防线，也是唯一可靠的一道。
 * prompt 里的约束模型可能违反，这里是代码层的强制校验。
 *
 * 举证责任只落在指控方：
 * 说这篇面经有问题，必须拿出原文证据，拿不出就作废；
 * 说这篇面经没问题，依据往往是「某样东西不存在」，这类判断天然无法引用原文，
 * 强行要求举证只会逼模型编造。
 */
function verifyEvidence(signals: EvidenceSignal[], sourceText: string): {
  verified: EvidenceSignal[];
  audit: EvidenceAudit;
} {
  const haystack = normalize(sourceText);
  const audit: EvidenceAudit = { totalQuotes: 0, invalidQuotes: 0, downgraded: [] };

  const verified = signals.map((signal): EvidenceSignal => {
    if (signal.level === 'neutral') {
      return { ...signal, quotes: [] };
    }

    const kept = (signal.quotes ?? []).filter((quote) => {
      audit.totalQuotes += 1;
      const needle = normalize(quote);
      const ok = needle.length >= MIN_QUOTE_LENGTH && haystack.includes(needle);
      if (!ok) audit.invalidQuotes += 1;
      return ok;
    });

    if (signal.level === 'negative' && kept.length === 0) {
      audit.downgraded.push(signal.dimension);
      return {
        ...signal,
        level: 'neutral',
        reason: `${signal.reason}（该判断不利于可信度，但未能在原文中找到证据，已降级）`,
        quotes: [],
      };
    }

    return { ...signal, quotes: kept };
  });

  return { verified, audit };
}

/** 补齐缺失维度，保证界面上五个维度恒定存在，避免出现「这个维度去哪了」的疑问 */
function fillMissingDimensions(signals: EvidenceSignal[]): EvidenceSignal[] {
  const present = new Set(signals.map((s) => s.dimension));
  const missing = ALL_DIMENSIONS.filter((d) => !present.has(d)).map(
    (dimension): EvidenceSignal => ({
      dimension,
      level: 'neutral',
      reason: '模型未对该维度作出判断',
      quotes: [],
    }),
  );
  return [...signals, ...missing].sort(
    (a, b) => ALL_DIMENSIONS.indexOf(a.dimension) - ALL_DIMENSIONS.indexOf(b.dimension),
  );
}

/**
 * 证据被大量推翻时，原本的 verdict 已失去依据，需要相应回撤。
 * promotional 是最重的指控，若支撑它的商业意图证据不成立，必须退回 suspicious。
 */
function reconcileVerdict(
  verdict: Verdict,
  signals: EvidenceSignal[],
  audit: EvidenceAudit,
): { verdict: Verdict; note?: string } {
  const commercial = signals.find((s) => s.dimension === 'commercial');

  if (verdict === 'promotional' && commercial?.level !== 'negative') {
    return {
      verdict: 'suspicious',
      note: '原判定为疑似引流，但商业意图的证据未通过原文核验，已回撤为存疑',
    };
  }

  if (verdict === 'trustworthy' && audit.downgraded.includes('specificity')) {
    return {
      verdict: 'suspicious',
      note: '原判定为高可信，但细节密度的证据未通过原文核验，已回撤为存疑',
    };
  }

  return { verdict };
}

/**
 * 模型侧用 trustImpact 表达「对可信度的贡献方向」。
 * 早期版本直接复用 positive/negative，模型会理解成「这个特征存不存在」，
 * 于是把「发现了引流广告」标成 positive，导致判定逻辑失效。
 */
type TrustImpact = 'supports' | 'undermines' | 'insufficient';

const IMPACT_TO_LEVEL: Record<TrustImpact, EvidenceSignal['level']> = {
  supports: 'positive',
  undermines: 'negative',
  insufficient: 'neutral',
};

interface RawSignal {
  dimension?: SignalDimension;
  trustImpact?: TrustImpact;
  reason?: string;
  quotes?: string[];
}

interface RawAnalysis {
  verdict?: string;
  headline?: string;
  contentTrust?: string;
  signals?: RawSignal[];
  extracted?: PostAnalysis['extracted'];
}

function toSignals(raw: RawSignal[]): EvidenceSignal[] {
  return raw
    .filter((s): s is RawSignal & { dimension: SignalDimension } =>
      ALL_DIMENSIONS.includes(s.dimension as SignalDimension),
    )
    .map((s) => ({
      dimension: s.dimension,
      level: IMPACT_TO_LEVEL[s.trustImpact ?? 'insufficient'] ?? 'neutral',
      reason: s.reason ?? '',
      quotes: s.quotes ?? [],
    }));
}

const VERDICTS: Verdict[] = ['trustworthy', 'suspicious', 'promotional'];
const TRUSTS: ContentTrust[] = ['usable', 'partial', 'unusable'];

export async function analyzePost(input: AnalyzeInput): Promise<AnalyzeResult> {
  const raw = await chat({
    messages: [
      { role: 'system', content: ANALYZE_SYSTEM_PROMPT },
      { role: 'user', content: buildAnalyzeUserPrompt(input) },
    ],
    temperature: 0,
    json: true,
  });

  const parsed = parseJson<RawAnalysis>(raw);

  /*
   * 可核验范围必须覆盖全部输入，而不只是正文。
   * 时效性依据发布时间、账号画像依据作者数据，这些都是元数据；
   * 若只拿正文做校验，这两个维度会被无差别降级。
   */
  const sourceText = [
    input.title,
    input.content,
    ...(input.comments ?? []),
    input.publishedAt,
    input.author?.recentPostCompanies?.join('、'),
    input.author?.recentPostCount != null ? String(input.author.recentPostCount) : undefined,
  ]
    .filter(Boolean)
    .join('\n');

  const { verified, audit } = verifyEvidence(
    fillMissingDimensions(toSignals(parsed.signals ?? [])),
    sourceText,
  );

  const initialVerdict = VERDICTS.includes(parsed.verdict as Verdict)
    ? (parsed.verdict as Verdict)
    : 'suspicious';

  const { verdict, note } = reconcileVerdict(initialVerdict, verified, audit);

  const analysis: PostAnalysis = {
    verdict,
    headline: note ?? parsed.headline ?? '',
    contentTrust: TRUSTS.includes(parsed.contentTrust as ContentTrust)
      ? (parsed.contentTrust as ContentTrust)
      : 'partial',
    signals: verified,
    extracted: {
      ...parsed.extracted,
      questions: parsed.extracted?.questions ?? [],
    },
  };

  return { analysis, audit };
}
