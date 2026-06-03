import { describe, it, expect } from 'vitest';
import * as Module from '..';

describe('features/auth/hooks/useIssuerSelection/index exports', () => {
  it('exports useIssuerSelection as a function', () => {
    expect(typeof Module.useIssuerSelection).toBe('function');
  });

  it('exports exactly 1 runtime item', () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
