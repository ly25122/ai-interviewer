import { NextResponse } from 'next/server';
import { parseUploadedDocument, ParseDocumentError } from '@/lib/parseDocument';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: '请以 multipart/form-data 上传文件' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '缺少 file 字段' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { text, format } = await parseUploadedDocument(buffer, file.name, file.type);
    return NextResponse.json({
      text,
      format,
      filename: file.name,
      chars: text.length,
    });
  } catch (error) {
    if (error instanceof ParseDocumentError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[interview/parse]', error);
    return NextResponse.json({ error: '解析失败，请改用粘贴正文' }, { status: 500 });
  }
}
