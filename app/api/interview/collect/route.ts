import { NextResponse } from 'next/server';
import { collectInterviewIntel } from '@/lib/engine/collectIntel';

export const runtime = 'nodejs';
export const maxDuration = 90;

export async function POST(request: Request) {
  let body: {
    name?: string;
    role?: string;
    department?: string;
    aliases?: string;
    context?: string;
    targetType?: 'auto' | 'company' | 'school';
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const name = body.name?.trim() ?? '';
  const role = body.role?.trim() ?? '';
  if (name.length < 2) {
    return NextResponse.json({ error: '请填写目标公司或学校' }, { status: 400 });
  }
  if (role.length < 2) {
    return NextResponse.json({ error: '请填写岗位或专业' }, { status: 400 });
  }

  try {
    const report = await collectInterviewIntel({
      name: name.slice(0, 80),
      role: role.slice(0, 80),
      department: (body.department ?? '').trim().slice(0, 80),
      aliases: (body.aliases ?? '')
        .split(/[,，]/)
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 8),
      context: (body.context ?? '').trim().slice(0, 200),
      targetType: body.targetType ?? 'auto',
    });
    return NextResponse.json(report);
  } catch (error) {
    console.error('[interview/collect]', error);
    return NextResponse.json({ error: '自动检索失败，请稍后重试或改为手动粘贴' }, { status: 502 });
  }
}
