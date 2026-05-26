import { describe, expect, it } from 'vitest';
import * as Module from '..';

describe('features/auth/hooks/useResizeObserver/index exports', () => {
  it('exports useResizeObserver as a function', () => {
    expect(typeof Module.useResizeObserver).toBe('function');
  });

  it('exports exactly 1 item', () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
