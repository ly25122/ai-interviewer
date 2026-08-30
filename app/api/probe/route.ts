import { NextResponse } from 'next/server';
import { probeStep, type ProbeStepInput } from '@/lib/engine/probe';
import { LLMError } from '@/lib/llm';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: ProbeStepInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  if (!body?.topicTitle?.trim()) {
    return NextResponse.json({ error: '缺少考点' }, { status: 400 });
  }

  try {
    const result = await probeStep({
      topicTitle: body.topicTitle.trim(),
      variants: body.variants ?? [],
      turns: (body.turns ?? []).filter((t) => t?.question && t?.answer),
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof LLMError) {
      const configIssue = error.message.includes('未配置');
      return NextResponse.json(
        { error: configIssue ? '服务端未配置模型密钥' : `模型调用失败：${error.message}` },
        { status: configIssue ? 503 : 502 },
      );
    }
    console.error('[probe] 未预期错误', error);
    return NextResponse.json({ error: '追问失败，请稍后重试' }, { status: 500 });
  }
}
