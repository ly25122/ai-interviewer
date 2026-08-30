import { NextResponse } from 'next/server';
import { referenceAnswer } from '@/lib/engine/resumeInterview';
import { LLMError } from '@/lib/llm';
import type { AttackPoint, IntelligenceItem } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: {
    resume?: string;
    jd?: string;
    point?: AttackPoint;
    question?: string;
    turns?: Array<{ question: string; answer: string }>;
    intelligence?: IntelligenceItem[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  if (!body.point?.title?.trim()) {
    return NextResponse.json({ error: '缺少追问点' }, { status: 400 });
  }

  try {
    const reference = await referenceAnswer({
      resume: body.resume?.trim() ?? '',
      jd: body.jd?.trim() ?? '',
      point: body.point,
      question: body.question?.trim() || undefined,
      turns: (body.turns ?? []).filter((t) => t?.question && t?.answer),
      intelligence: Array.isArray(body.intelligence) ? body.intelligence : [],
    });
    return NextResponse.json({ reference });
  } catch (error) {
    if (error instanceof LLMError) {
      const configIssue = error.message.includes('未配置');
      return NextResponse.json(
        { error: configIssue ? '服务端未配置模型密钥' : `模型调用失败：${error.message}` },
        { status: configIssue ? 503 : 502 },
      );
    }
    console.error('[interview/reference]', error);
    return NextResponse.json({ error: '生成参考答案失败，请稍后重试' }, { status: 500 });
  }
}
