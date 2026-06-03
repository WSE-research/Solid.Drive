import { describe, it, expect } from 'vitest';
import * as Module from '..';

describe('features/auth/components/LandingPage/index exports', () => {
  it('exports LandingPage as a function', () => {
    expect(typeof Module.LandingPage).toBe('function');
  });

  it('exports exactly 1 item', () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
