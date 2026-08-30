import raw from './samples.json';
import type { AnalyzeInput } from './types';

/**
 * 三个示例覆盖三种典型形态，供评委与新用户一键体验。
 * 全部为虚构内容，不含任何真实用户信息与账号数据。
 *
 * 数据放在 JSON 里，让页面与测试脚本共用同一份，避免两处各存一份后逐渐漂移。
 */
export interface Sample extends AnalyzeInput {
  key: string;
  label: string;
  /** 这条示例想让用户看到什么 */
  hint: string;
}

export const SAMPLES: Sample[] = raw as Sample[];
