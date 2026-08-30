import { NextResponse } from 'next/server';
import { planResumeInterview } from '@/lib/engine/resumeInterview';
import { LLMError } from '@/lib/llm';
import type { IntelligenceItem } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 90;

export async function POST(request: Request) {
  let body: { resume?: string; jd?: string; intelligence?: IntelligenceItem[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const resume = body.resume?.trim() ?? '';
  const jd = body.jd?.trim() ?? '';
  const intelligence = Array.isArray(body.intelligence) ? body.intelligence : [];

  if (resume.length < 80) {
    return NextResponse.json({ error: '简历太短，请粘贴完整简历文本' }, { status: 400 });
  }
  if (jd.length < 40) {
    return NextResponse.json({ error: 'JD 太短，请粘贴完整岗位描述' }, { status: 400 });
  }

  try {
    const plan = await planResumeInterview(resume, jd, intelligence);
    return NextResponse.json({ plan });
  } catch (error) {
    if (error instanceof LLMError) {
      const configIssue = error.message.includes('未配置');
      return NextResponse.json(
        { error: configIssue ? '服务端未配置模型密钥' : `模型调用失败：${error.message}` },
        { status: configIssue ? 503 : 502 },
      );
    }
    console.error('[interview/plan]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成面试计划失败' },
      { status: 500 },
    );
  }
}
