import type { ProbeSession, SelfRating, Syllabus } from './types';

/**
 * 个人数据一律留在浏览器本地，不上传服务器。
 * 这既是隐私立场，也让产品无需账号体系——评委打开即用，没有注册门槛。
 */
const KEY = 'diqi.state.v1';

export interface LocalState {
  syllabus: Syllabus | null;
  ratings: Record<string, SelfRating>;
  probes: Record<string, ProbeSession>;
}

export const EMPTY_STATE: LocalState = { syllabus: null, ratings: {}, probes: {} };

export function loadState(): LocalState {
  if (typeof window === 'undefined') return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<LocalState>;
    return {
      syllabus: parsed.syllabus ?? null,
      ratings: parsed.ratings ?? {},
      probes: parsed.probes ?? {},
    };
  } catch {
    return EMPTY_STATE;
  }
}

function saveState(state: LocalState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 超出配额时静默失败，不影响当前会话使用
  }
}

/*
 * 以外部 store 的形式暴露给 React。
 * 直接在 effect 里读 localStorage 再 setState 会造成级联渲染，
 * useSyncExternalStore 是这类「浏览器本地状态」的标准接法。
 */

let cache: LocalState | null = null;
const listeners = new Set<() => void>();

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 必须返回稳定引用，否则 useSyncExternalStore 会陷入无限重渲染 */
export function getSnapshot(): LocalState {
  if (cache === null) cache = loadState();
  return cache;
}

/** 服务端与首次 hydration 时统一返回空状态，避免 markup 不一致 */
export function getServerSnapshot(): LocalState {
  return EMPTY_STATE;
}

export function setLocalState(updater: (prev: LocalState) => LocalState): void {
  cache = updater(getSnapshot());
  saveState(cache);
  listeners.forEach((listener) => listener());
}

export function clearState(): void {
  cache = EMPTY_STATE;
  if (typeof window !== 'undefined') window.localStorage.removeItem(KEY);
  listeners.forEach((listener) => listener());
}
