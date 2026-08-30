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
 * prompt 里的约束模型可能违反，但这里是代码层的强制校验：
 * 凡是无法在原文中逐字检索到的证据一律作废，该维度强制降级为 neutral。
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

    if (kept.length === 0) {
      audit.downgraded.push(signal.dimension);
      return {
        ...signal,
        level: 'neutral',
        reason: `${signal.reason}（原判断因无法在原文中找到支撑证据而降级）`,
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

interface RawAnalysis {
  verdict?: string;
  headline?: string;
  contentTrust?: string;
  signals?: EvidenceSignal[];
  extracted?: PostAnalysis['extracted'];
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

  // 校验证据时把标题也纳入原文范围，标题中的引流话术同样是有效证据
  const sourceText = [input.title, input.content, ...(input.comments ?? [])]
    .filter(Boolean)
    .join('\n');

  const { verified, audit } = verifyEvidence(
    fillMissingDimensions(parsed.signals ?? []),
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
