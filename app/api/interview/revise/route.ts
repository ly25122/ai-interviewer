import { NextResponse } from 'next/server';
import { reviseResume } from '@/lib/engine/resumeRevise';
import { LLMError } from '@/lib/llm';
import type { IntelligenceItem } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 90;

export async function POST(request: Request) {
  let body: {
    resume?: string;
    jd?: string;
    intelligence?: IntelligenceItem[];
    debrief?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const resume = body.resume?.trim() ?? '';
  const jd = body.jd?.trim() ?? '';
  if (resume.length < 80) {
    return NextResponse.json({ error: '简历太短，请先放入完整简历再改' }, { status: 400 });
  }
  if (jd.length < 40) {
    return NextResponse.json({ error: '请先放入岗位 JD，才能对照着改' }, { status: 400 });
  }

  try {
    const edits = await reviseResume({
      resume,
      jd,
      intelligence: Array.isArray(body.intelligence) ? body.intelligence : [],
      debrief: body.debrief?.trim() || undefined,
    });
    if (edits.length === 0) {
      return NextResponse.json({ error: '没有给出可执行的修改建议，请稍后重试' }, { status: 502 });
    }
    return NextResponse.json({ edits });
  } catch (error) {
    if (error instanceof LLMError) {
      const configIssue = error.message.includes('未配置');
      return NextResponse.json(
        { error: configIssue ? '服务端未配置模型密钥' : `模型调用失败：${error.message}` },
        { status: configIssue ? 503 : 502 },
      );
    }
    console.error('[interview/revise]', error);
    return NextResponse.json({ error: '生成修改建议失败' }, { status: 500 });
  }
}
