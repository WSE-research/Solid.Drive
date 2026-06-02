import { describe, it, expect } from 'vitest';
import * as Module from '..';

describe('shared/hooks/usePendingRequests/index exports', () => {
  it('exports usePendingRequests and useRequestStatus as functions', () => {
    expect(typeof Module.usePendingRequests).toBe('function');
    expect(typeof Module.useRequestStatus).toBe('function');
  });

  it('exports exactly 2 runtime items', () => {
    expect(Object.keys(Module)).toHaveLength(2);
  });
});
