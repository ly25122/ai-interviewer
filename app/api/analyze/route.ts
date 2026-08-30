import { NextResponse } from 'next/server';
import { analyzePost } from '@/lib/engine/analyzePost';
import { LLMError } from '@/lib/llm';
import type { AnalyzeInput } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** 超出此长度的正文会显著拖慢响应，而面经很少这么长，多半是误粘贴 */
const MAX_CONTENT_LENGTH = 8000;

export async function POST(request: Request) {
  let body: AnalyzeInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const content = body?.content?.trim();
  if (!content) {
    return NextResponse.json({ error: '请粘贴面经正文' }, { status: 400 });
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `正文过长（${content.length} 字），请控制在 ${MAX_CONTENT_LENGTH} 字以内` },
      { status: 400 },
    );
  }

  try {
    const result = await analyzePost({ ...body, content });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof LLMError) {
      const configIssue = error.message.includes('未配置');
      return NextResponse.json(
        { error: configIssue ? '服务端未配置模型密钥' : `模型调用失败：${error.message}` },
        { status: configIssue ? 503 : 502 },
      );
    }
    console.error('[analyze] 未预期错误', error);
    return NextResponse.json({ error: '分析失败，请稍后重试' }, { status: 500 });
  }
}
