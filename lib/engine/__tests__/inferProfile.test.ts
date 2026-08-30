import { describe, expect, it } from 'vitest';
import { shouldAugmentProfile } from '../inferProfile';

describe('shouldAugmentProfile', () => {
  it('augments when posts are scarce', () => {
    expect(shouldAugmentProfile(1, 8)).toBe(true);
    expect(shouldAugmentProfile(2, 8)).toBe(true);
  });

  it('augments when extracted topics are thin', () => {
    expect(shouldAugmentProfile(8, 2)).toBe(true);
  });

  it('skips when intel is already dense', () => {
    expect(shouldAugmentProfile(5, 6)).toBe(false);
  });
});
