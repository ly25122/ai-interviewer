import { NextResponse } from 'next/server';
import { resumeInterviewStep } from '@/lib/engine/resumeInterview';
import { LLMError } from '@/lib/llm';
import type { AttackPoint } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: {
    resume?: string;
    jd?: string;
    point?: AttackPoint;
    turns?: Array<{ question: string; answer: string }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  if (!body.resume?.trim() || !body.jd?.trim()) {
    return NextResponse.json({ error: '缺少简历或 JD' }, { status: 400 });
  }
  if (!body.point?.title?.trim()) {
    return NextResponse.json({ error: '缺少追问点' }, { status: 400 });
  }

  try {
    const result = await resumeInterviewStep({
      resume: body.resume.trim(),
      jd: body.jd.trim(),
      point: body.point,
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
    console.error('[interview/step]', error);
    return NextResponse.json({ error: '追问失败，请稍后重试' }, { status: 500 });
  }
}
