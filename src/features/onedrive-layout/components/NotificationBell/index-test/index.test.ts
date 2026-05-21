import { describe, it, expect } from 'vitest';
import * as Module from '..';

describe('features/onedrive-layout/components/NotificationBell/index exports', () => {
  it('exports NotificationBell as a function', () => {
    expect(typeof Module.NotificationBell).toBe('function');
  });

  it('exports exactly 1 runtime value', () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
