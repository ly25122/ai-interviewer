import { describe, expect, it } from 'vitest';
import { parseUploadedDocument, ParseDocumentError } from '../parseDocument';

describe('parseUploadedDocument', () => {
  it('parses plain text', async () => {
    const buf = Buffer.from('这是一份足够长的简历文本，用来测试解析器能否正确读出 UTF-8 内容。');
    const { text, format } = await parseUploadedDocument(buf, 'resume.txt', 'text/plain');
    expect(format).toBe('txt');
    expect(text).toContain('简历文本');
  });

  it('rejects empty files', async () => {
    await expect(parseUploadedDocument(Buffer.alloc(0), 'a.txt')).rejects.toBeInstanceOf(
      ParseDocumentError,
    );
  });

  it('rejects legacy .doc', async () => {
    await expect(
      parseUploadedDocument(Buffer.from('x'.repeat(40)), 'old.doc', 'application/msword'),
    ).rejects.toThrow(/docx/);
  });
});
