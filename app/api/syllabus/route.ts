import { NextResponse } from 'next/server';
import { analyzePost } from '@/lib/engine/analyzePost';
import { buildSyllabus, type AnalyzedPost } from '@/lib/engine/buildSyllabus';
import { LLMError } from '@/lib/llm';
import type { AnalyzeInput } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** 单次聚合的上限。超过这个数量响应会长到用户放弃等待，而考纲质量提升有限 */
const MAX_POSTS = 8;
/** 并发度。DeepSeek 对突发并发不算宽容，4 个足以把总耗时压到可接受范围 */
const CONCURRENCY = 4;

interface SyllabusRequest {
  posts: AnalyzeInput[];
  company?: string;
  role?: string;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

export async function POST(request: Request) {
  let body: SyllabusRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const posts = (body?.posts ?? []).filter((p) => p?.content?.trim());
  if (posts.length === 0) {
    return NextResponse.json({ error: '至少需要一篇面经' }, { status: 400 });
  }
  if (posts.length > MAX_POSTS) {
    return NextResponse.json(
      { error: `一次最多聚合 ${MAX_POSTS} 篇，当前 ${posts.length} 篇` },
      { status: 400 },
    );
  }

  try {
    const settled = await mapWithConcurrency(posts, CONCURRENCY, async (post, index) => {
      try {
        const { analysis } = await analyzePost(post);
        return { postId: `p${index + 1}`, analysis } satisfies AnalyzedPost;
      } catch (error) {
        // 单篇失败不应让整次聚合失败，跳过并在响应中说明
        console.error(`[syllabus] 第 ${index + 1} 篇分析失败`, error);
        return null;
      }
    });

    const analyzed = settled.filter((x): x is AnalyzedPost => x !== null);
    if (analyzed.length === 0) {
      return NextResponse.json({ error: '所有面经分析均失败' }, { status: 502 });
    }

    const syllabus = await buildSyllabus(analyzed, {
      company: body.company?.trim() || inferField(analyzed, 'company') || '未指定公司',
      role: body.role?.trim() || inferField(analyzed, 'role') || '未指定岗位',
    });

    return NextResponse.json({
      syllabus,
      analyzed,
      failedCount: posts.length - analyzed.length,
    });
  } catch (error) {
    if (error instanceof LLMError) {
      const configIssue = error.message.includes('未配置');
      return NextResponse.json(
        { error: configIssue ? '服务端未配置模型密钥' : `模型调用失败：${error.message}` },
        { status: configIssue ? 503 : 502 },
      );
    }
    console.error('[syllabus] 未预期错误', error);
    return NextResponse.json({ error: '聚合失败，请稍后重试' }, { status: 500 });
  }
}

/** 用户没填公司岗位时，取面经中出现次数最多的值 */
function inferField(posts: AnalyzedPost[], field: 'company' | 'role'): string | undefined {
  const counts = new Map<string, number>();
  for (const { analysis } of posts) {
    const value = analysis.extracted[field]?.trim();
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}
