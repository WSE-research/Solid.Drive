import { describe, it, expect } from 'vitest';
import * as Module from '..';

describe('app/RequestNotificationsGate/index exports', () => {
  it('exports RequestNotificationsGate as a function', () => {
    expect(typeof Module.RequestNotificationsGate).toBe('function');
  });

  it('exports exactly 1 runtime value', () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
