import { describe, it, expect } from 'vitest';
import * as Module from '..';

describe('features/profile/hooks/useSeenRequests/index exports', () => {
  it('exports useSeenRequests as a function', () => {
    expect(typeof Module.useSeenRequests).toBe('function');
  });

  it('exports exactly 1 runtime value', () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
