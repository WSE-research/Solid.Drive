import { describe, it, expect } from 'vitest';
import * as Module from '..';

describe('features/auth/utils/isValidIssuerUrl/index exports', () => {
  it('exports isValidIssuerUrl as a function', () => {
    expect(typeof Module.isValidIssuerUrl).toBe('function');
  });

  it('exports exactly 1 item', () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
