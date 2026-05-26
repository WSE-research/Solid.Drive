import { describe, it, expect } from 'vitest';
import * as Module from '..';

describe('app/AuthCallbackSkeleton/index exports', () => {
  it('exports AuthCallbackSkeleton as a function', () => {
    expect(typeof Module.AuthCallbackSkeleton).toBe('function');
  });

  it('exports exactly 1 runtime value', () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
