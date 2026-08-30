import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

const MAX_BYTES = 8 * 1024 * 1024;

export class ParseDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseDocumentError';
  }
}

function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extOf(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : '';
}

async function parsePdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return normalizeText(result.text ?? '');
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return normalizeText(result.value ?? '');
}

/**
 * 从上传文件抽出纯文本。支持 pdf / docx / txt / md。
 * 老式 .doc 不解析：格式封闭且库不稳定，引导用户另存为 docx 或粘贴。
 */
export async function parseUploadedDocument(
  buffer: Buffer,
  filename: string,
  mimeType?: string,
): Promise<{ text: string; format: string }> {
  if (buffer.byteLength === 0) {
    throw new ParseDocumentError('文件是空的');
  }
  if (buffer.byteLength > MAX_BYTES) {
    throw new ParseDocumentError('文件超过 8MB，请压缩或粘贴正文');
  }

  const ext = extOf(filename);
  const mime = (mimeType ?? '').toLowerCase();

  const isPdf =
    ext === 'pdf' || mime === 'application/pdf' || buffer.subarray(0, 5).toString() === '%PDF-';
  const isDocx =
    ext === 'docx' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const isDoc = ext === 'doc' || mime === 'application/msword';
  const isText =
    ['txt', 'md', 'markdown', 'text'].includes(ext) || mime.startsWith('text/');

  let text = '';
  let format = ext || 'unknown';

  if (isPdf) {
    format = 'pdf';
    text = await parsePdf(buffer);
  } else if (isDocx) {
    format = 'docx';
    text = await parseDocx(buffer);
  } else if (isDoc) {
    throw new ParseDocumentError('暂不支持旧版 .doc，请另存为 .docx，或直接粘贴正文');
  } else if (isText) {
    format = ext || 'txt';
    text = normalizeText(buffer.toString('utf8'));
  } else {
    throw new ParseDocumentError('仅支持 PDF、DOCX、TXT、MD');
  }

  if (text.length < 20) {
    throw new ParseDocumentError(
      '几乎没解析出文字。若是扫描件 PDF，需要先 OCR；也可直接粘贴正文。',
    );
  }

  return { text, format };
}
