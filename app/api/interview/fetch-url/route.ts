import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_CHARS = 12000;

/** 粗清洗 HTML 成正文文本：去脚本样式、去标签、解实体、压空白 */
function htmlToText(html: string): string {
  let s = html;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  // 块级标签换成换行，便于保留段落
  s = s.replace(/<\/(p|div|section|article|li|h[1-6]|br|tr)>/gi, '\n');
  s = s.replace(/<br\s*\/?>(?=)/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  s = s
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return s;
}

function titleOf(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? htmlToText(m[1]).slice(0, 80) : '';
}

export async function POST(request: Request) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const raw = body.url?.trim() ?? '';
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: '链接格式不对，请以 http(s):// 开头' }, { status: 400 });
  }
  if (!/^https?:$/.test(target.protocol)) {
    return NextResponse.json({ error: '只支持 http/https 链接' }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `目标站点返回 ${res.status}，可能需要登录或有反爬，请手动复制正文粘贴` },
        { status: 502 },
      );
    }
    const ctype = res.headers.get('content-type') ?? '';
    const html = await res.text();
    const text = ctype.includes('text/html') ? htmlToText(html) : html.trim();
    if (text.length < 40) {
      return NextResponse.json(
        { error: '这个页面几乎没抓到正文（可能是动态渲染或需登录），请手动复制粘贴' },
        { status: 422 },
      );
    }
    return NextResponse.json({
      title: titleOf(html) || target.hostname,
      url: target.toString(),
      text: text.slice(0, MAX_CHARS),
      truncated: text.length > MAX_CHARS,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return NextResponse.json(
      {
        error: aborted
          ? '抓取超时，站点可能较慢或屏蔽了访问，请手动复制正文粘贴'
          : '抓取失败，请检查链接或手动复制正文粘贴',
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
