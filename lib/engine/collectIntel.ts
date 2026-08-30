/**
 * 公开面试情报采集。逻辑移植自 https://github.com/54wanciwang/ai830
 * 不登录、不读 Cookie、不绕过验证码；知乎/小红书不纳入自动检索。
 */

export interface CollectTarget {
  name: string;
  department?: string;
  role: string;
  aliases?: string[];
  context?: string;
  targetType?: 'auto' | 'company' | 'school';
}

export interface CollectedSource {
  title: string;
  url: string;
  snippet: string;
  platform: string;
  query: string;
  content: string;
  contentStatus: 'fulltext' | 'snippet_only' | 'search_summary' | 'skipped';
  publishedAt?: string;
  relevanceScore: number;
  searchProvider: string;
}

export interface CollectReport {
  target: CollectTarget;
  sources: CollectedSource[];
  queryPlan: Array<{ query: string; platform: string; intent: string }>;
  stats: {
    provider: string;
    queries: number;
    raw: number;
    kept: number;
    fulltext: number;
  };
  warnings: string[];
}

const INTERVIEW_TERMS = [
  '面试',
  '面经',
  '一面',
  '二面',
  '三面',
  '终面',
  '复试',
  '校招',
  '笔试',
  '面试题',
];
const NOISE_TERMS = [
  '课程推广',
  '培训报名',
  '招聘广告',
  '简历代写',
  '刷题班',
  '宣讲会',
  '招聘启动',
  '就业信息',
  '工作总结',
  '招聘快讯',
  '内推专场',
  '校园招聘',
  '招满即止',
];
const AUTO_EXCLUDED = ['zhihu.com', 'xiaohongshu.com'];
const USER_AGENT =
  'InterviewIntelligence/0.1 (public-web-research; +https://github.com/ly25122/ai-interviewer)';

function cleanText(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function platformOf(url: string): string {
  const host = hostOf(url);
  for (const domain of [
    'nowcoder.com',
    'yingjiesheng.com',
    'kanzhun.com',
    'maimai.cn',
    'juejin.cn',
    'csdn.net',
    'leetcode.cn',
    'zhihu.com',
    'xiaohongshu.com',
  ]) {
    if (host === domain || host.endsWith(`.${domain}`)) return domain;
  }
  return host || 'unknown';
}

function excluded(platform: string): boolean {
  return AUTO_EXCLUDED.some((d) => platform === d || platform.endsWith(`.${d}`));
}

export function canonicalUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    if (!/^https?:$/.test(u.protocol) || !u.host) return '';
    const kept: string[] = [];
    u.searchParams.forEach((v, k) => {
      if (!/^(utm_|spm|from|share_)/i.test(k)) kept.push(`${k}=${v}`);
    });
    u.hash = '';
    u.search = kept.length ? `?${kept.join('&')}` : '';
    u.pathname = u.pathname.replace(/\/+$/, '') || '/';
    return u.toString();
  } catch {
    return '';
  }
}

function quoted(value: string): string {
  return value ? `"${value}"` : '';
}

function recencyYear(now = new Date()) {
  return now.getFullYear();
}

function isRecencyQuery(query: string): boolean {
  return /今年|20\d{2}|26届|27届|春招|秋招/.test(query);
}

/** 查询词已带年份时，把搜索窗收到当年；其余不限，以免漏掉去年发的应届面经。 */
function recencyFreshness(query: string, now = new Date()): string {
  if (!isRecencyQuery(query)) return 'noLimit';
  const y = recencyYear(now);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-01-01..${y}-${m}-${d}`;
}

/**
 * 引擎经常不给 publishedAt。只有标题里出现完整年月日才补，
 * 不用「2026届」这种届次冒充发布日期。
 */
function inferPublishedAt(title?: string, extra?: string): string | undefined {
  const text = `${title ?? ''} ${extra ?? ''}`;
  const m = text.match(/(20[2-3]\d)[-./年](\d{1,2})[-./月](\d{1,2})/);
  if (!m) return undefined;
  const month = m[2].padStart(2, '0');
  const day = m[3].padStart(2, '0');
  if (Number(month) > 12 || Number(day) > 31) return undefined;
  return `${m[1]}-${month}-${day}`;
}

export function generateQueryPlan(target: CollectTarget, maxQueries = 8) {
  const name = target.name.trim();
  const role = target.role.trim();
  const department = (target.department ?? '').trim();
  const context = (target.context ?? '').trim();
  const year = recencyYear();
  const cohort = `${String(year).slice(2)}届`;
  const isSchool =
    target.targetType === 'school' ||
    (target.targetType !== 'company' && /大学|学院|研究院/.test(name));
  const base = [quoted(name), quoted(department), quoted(role), context].filter(Boolean).join(' ');
  const alias = [quoted(name), ...(target.aliases ?? []).map(quoted)].filter(Boolean).join(' ');
  const intents = isSchool
    ? [
        ['复试流程', '复试经验'],
        ['专业问题', '专业课 面试题'],
        ['保研夏令营', '保研 夏令营 面试'],
      ]
    : [
        ['面试流程', '面试经验'],
        ['高频问题', '面试题'],
        ['专业面试', '一面 二面'],
      ];
  const plans: Array<{ query: string; platform: string; intent: string }> = [];
  const add = (query: string, platform: string, intent: string) => {
    const q = query.replace(/\s+/g, ' ').trim();
    if (q && !plans.some((p) => p.query === q)) plans.push({ query: q, platform, intent });
  };
  for (const [intent, suffix] of intents) add(`${base} ${suffix}`, 'general', intent);
  if (isSchool) {
    add(`${base} ${year} 复试`, 'general', '当年复试');
  } else {
    add(`${base} ${year} 面经`, 'general', '当年面经');
    add(`${quoted(name)} ${quoted(role)} ${cohort} 一面`, 'general', '应届面经');
  }
  const suffix = isSchool ? '复试 面经' : '面试经验';
  for (const [domain, label, intent] of [
    ['nowcoder.com/discuss', '牛客', '牛客面经'],
    ['yingjiesheng.com', '应届生', '应届生经验'],
    ['juejin.cn', '掘金', '技术经验'],
  ] as const) {
    add(`site:${domain} ${alias} ${role} ${suffix}`, label, intent);
  }
  return plans.slice(0, Math.max(1, maxQueries));
}

function terms(target: CollectTarget): string[] {
  const values = [target.name, target.department ?? '', target.role, ...(target.aliases ?? [])];
  const result: string[] = [];
  for (const value of values) {
    const v = value.trim();
    if (v && !result.includes(v)) result.push(v);
  }
  return result;
}

function scoreResult(item: CollectedSource, target: CollectTarget): number {
  const haystack = `${item.title} ${item.snippet} ${item.content}`.toLowerCase();
  let score = 0;
  for (const term of terms(target)) {
    if (!haystack.includes(term.toLowerCase())) continue;
    if (term === target.name || (target.aliases ?? []).includes(term)) score += 5;
    else if (term === target.role) score += 3;
    else if (term === target.department) score += 2;
    else score += 1;
  }
  const identity = haystack.includes(target.name.toLowerCase());
  const roleHit = Boolean(target.role && haystack.includes(target.role.toLowerCase()));
  const deptHit = Boolean(target.department && haystack.includes(target.department.toLowerCase()));
  if (!identity && !roleHit && !deptHit) score -= 8;
  const interviewHits = INTERVIEW_TERMS.filter((t) => haystack.includes(t.toLowerCase()));
  if (interviewHits.length) score += Math.min(4, 1 + interviewHits.length * 0.5);
  if (['nowcoder.com', 'yingjiesheng.com', 'juejin.cn', 'csdn.net'].includes(item.platform)) {
    score += 1;
  }
  if (NOISE_TERMS.some((t) => haystack.includes(t))) score -= 4;
  if (/招聘|内推|宣讲/.test(haystack) && interviewHits.length === 0) score -= 8;
  const year = String(recencyYear());
  if (haystack.includes(year) && interviewHits.length) score += 2;
  return Math.round(score * 100) / 100;
}

async function searchTavily(query: string, limit: number): Promise<CollectedSource[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  const payload: Record<string, unknown> = {
    query,
    search_depth: 'basic',
    topic: 'general',
    max_results: Math.min(limit, 8),
    include_answer: false,
    include_raw_content: 'text',
  };
  const site = query.match(/site:([^\s]+)/i);
  if (site) payload.include_domains = [site[1].replace(/\/$/, '')];
  if (isRecencyQuery(query)) payload.start_date = `${recencyYear()}-01-01`;
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(18000),
  });
  if (!res.ok) return [];
  const rows = ((await res.json()) as { results?: Array<Record<string, string>> }).results ?? [];
  return rows
    .map((row) => {
      const url = canonicalUrl(row.url ?? '');
      const content = cleanText(row.raw_content || row.content || '');
      return {
        title: cleanText(row.title || '无标题'),
        url,
        snippet: cleanText(row.content || ''),
        platform: platformOf(url),
        query,
        content: content.length >= 120 ? content.slice(0, 8000) : '',
        contentStatus: (content.length >= 120 ? 'fulltext' : 'snippet_only') as CollectedSource['contentStatus'],
        publishedAt: row.published_date || row.published_at || inferPublishedAt(row.title, row.content),
        relevanceScore: 0,
        searchProvider: 'tavily',
      };
    })
    .filter((x) => x.url);
}

async function searchBocha(query: string, limit: number): Promise<CollectedSource[]> {
  const key = process.env.BOCHA_API_KEY;
  if (!key) return [];
  const domains = [...query.matchAll(/site:([^\s]+)/gi)].map((m) => m[1].replace(/\/$/, ''));
  const searchQuery = query.replace(/site:[^\s]+\s*/gi, '').trim() || query;
  const payload: Record<string, unknown> = {
    query: searchQuery,
    summary: true,
    count: Math.min(limit, 20),
    freshness: recencyFreshness(query),
  };
  if (domains.length) payload.include = domains.join('|');
  const res = await fetch('https://api.bochaai.com/v1/web-search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(18000),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    data?: { webPages?: { value?: Array<Record<string, string>> } };
  };
  const rows = json.data?.webPages?.value ?? [];
  return rows
    .map((row) => {
      const url = canonicalUrl(row.url ?? '');
      const summary = cleanText(row.summary || '');
      return {
        title: cleanText(row.name || '无标题'),
        url,
        snippet: cleanText(row.snippet || ''),
        platform: platformOf(url),
        query,
        content: summary.length >= 120 ? summary.slice(0, 8000) : '',
        contentStatus: (summary.length >= 120 ? 'search_summary' : 'snippet_only') as CollectedSource['contentStatus'],
        publishedAt: row.datePublished || inferPublishedAt(row.name, row.snippet || row.summary),
        relevanceScore: 0,
        searchProvider: 'bocha',
      };
    })
    .filter((x) => x.url);
}

async function searchBing(query: string, limit: number): Promise<CollectedSource[]> {
  const params = new URLSearchParams({
    q: query,
    count: String(Math.min(limit, 10)),
    setlang: 'zh-Hans',
    cc: 'cn',
  });
  const res = await fetch(`https://www.bing.com/search?${params}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    signal: AbortSignal.timeout(12000),
    redirect: 'follow',
  }).catch(() => null);
  if (!res?.ok) return [];
  const markup = await res.text();
  const blocks = markup.match(/<li[^>]*class=["'][^"']*b_algo[^"']*["'][^>]*>[\s\S]*?<\/li>/gi) ?? [];
  const out: CollectedSource[] = [];
  for (const block of blocks) {
    const href = block.match(/<h2[^>]*>\s*<a[^>]+href=["']([^"']+)/i);
    if (!href) continue;
    const url = canonicalUrl(href[1]);
    if (!url) continue;
    const title = block.match(/<h2[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i);
    const snippet = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    out.push({
      title: cleanText(title?.[1] ?? '无标题'),
      url,
      snippet: cleanText(snippet?.[1] ?? ''),
      platform: platformOf(url),
      query,
      content: '',
      contentStatus: 'snippet_only',
      relevanceScore: 0,
      searchProvider: 'bing',
    });
    if (out.length >= limit) break;
  }
  return out;
}

async function fetchFulltext(item: CollectedSource): Promise<CollectedSource> {
  if (item.contentStatus === 'fulltext' && item.content.length >= 120) return item;
  try {
    const res = await fetch(item.url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: AbortSignal.timeout(12000),
      redirect: 'follow',
    });
    if (!res.ok) return item;
    const ctype = res.headers.get('content-type') ?? '';
    if (!ctype.includes('text/html') && !ctype.includes('xhtml')) return item;
    const text = cleanText(await res.text());
    if (text.length < 120) return item;
    return { ...item, content: text.slice(0, 8000), contentStatus: 'fulltext' };
  } catch {
    return item;
  }
}

export async function collectInterviewIntel(target: CollectTarget): Promise<CollectReport> {
  const warnings: string[] = [];
  const plans = generateQueryPlan(target, 8);
  const hasTavily = Boolean(process.env.TAVILY_API_KEY);
  const hasBocha = Boolean(process.env.BOCHA_API_KEY);
  const providers: string[] = [];
  if (hasTavily) providers.push('tavily');
  if (hasBocha) providers.push('bocha');
  if (!providers.length) providers.push('bing');

  const raw: CollectedSource[] = [];
  await Promise.all(
    plans.map(async (plan) => {
      const batches = await Promise.allSettled([
        hasTavily ? searchTavily(plan.query, 8) : Promise.resolve([]),
        hasBocha ? searchBocha(plan.query, 8) : Promise.resolve([]),
        !hasTavily && !hasBocha ? searchBing(plan.query, 8) : Promise.resolve([]),
      ]);
      for (const batch of batches) {
        if (batch.status === 'fulfilled') raw.push(...batch.value);
      }
    }),
  );

  const excludedCount = raw.filter((x) => excluded(x.platform)).length;
  const filtered = raw.filter((x) => !excluded(x.platform));
  if (excludedCount) {
    warnings.push(`已排除 ${excludedCount} 条知乎/小红书自动检索结果。`);
  }

  const dedup = new Map<string, CollectedSource>();
  for (const item of filtered) {
    const key = canonicalUrl(item.url);
    if (!key) continue;
    item.url = key;
    item.relevanceScore = scoreResult(item, target);
    const old = dedup.get(key);
    if (!old || item.relevanceScore > old.relevanceScore) dedup.set(key, item);
  }

  const publishedTs = (iso?: string) => {
    if (!iso) return 0;
    const t = Date.parse(iso);
    return Number.isNaN(t) ? 0 : t;
  };

  const candidates = [...dedup.values()]
    .filter((x) => {
      const hay = `${x.title} ${x.snippet} ${x.content}`;
      const interviewLike = INTERVIEW_TERMS.some((t) => hay.includes(t));
      return x.relevanceScore >= 4 && interviewLike;
    })
    .sort((a, b) => {
      const da = publishedTs(a.publishedAt);
      const db = publishedTs(b.publishedAt);
      if (da !== db) return db - da;
      return b.relevanceScore - a.relevanceScore;
    });

  const KEEP = 16;
  const ranked: CollectedSource[] = [];
  const seenPlatform = new Set<string>();
  for (const item of candidates) {
    if (ranked.length >= KEEP) break;
    if (!seenPlatform.has(item.platform)) {
      ranked.push(item);
      seenPlatform.add(item.platform);
    }
  }
  for (const item of candidates) {
    if (ranked.length >= KEEP) break;
    if (!ranked.includes(item)) ranked.push(item);
  }

  if (!ranked.length) {
    warnings.push(
      hasTavily || hasBocha
        ? '没有找到足够相关的公开面经，可换更具体的去向或方向。'
        : '未配置 TAVILY_API_KEY / BOCHA_API_KEY，公开搜索结果不足。可先手动粘贴面经。',
    );
  }

  const fetched = await Promise.all(ranked.map((item) => fetchFulltext(item)));

  return {
    target,
    sources: fetched,
    queryPlan: plans,
    stats: {
      provider: providers.join('+'),
      queries: plans.length,
      raw: raw.length,
      kept: fetched.length,
      fulltext: fetched.filter((x) => x.contentStatus === 'fulltext').length,
    },
    warnings,
  };
}
