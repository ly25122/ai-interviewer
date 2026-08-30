const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class LLMError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

interface ChatOptions {
  messages: ChatMessage[];
  /** 判定类任务一律用低温度，避免同一篇面经两次分析结论不同 */
  temperature?: number;
  json?: boolean;
  maxTokens?: number;
  signal?: AbortSignal;
}

export async function chat({
  messages,
  temperature = 0,
  json = false,
  maxTokens = 4096,
  signal,
}: ChatOptions): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new LLMError('DEEPSEEK_API_KEY 未配置');
  }

  const res = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
      messages,
      temperature,
      max_tokens: maxTokens,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new LLMError(`DeepSeek 返回 ${res.status}: ${detail.slice(0, 300)}`, res.status);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new LLMError('DeepSeek 返回内容为空');
  }
  return content;
}

/**
 * 即便开启 json_object 模式，仍可能出现被 markdown 代码块包裹的情况，
 * 因此保留一层容错解析。
 */
export function parseJson<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        /* 常见于输出被 max_tokens 截断 */
      }
    }
    throw new LLMError(`无法解析为 JSON: ${cleaned.slice(0, 200)}`);
  }
}
