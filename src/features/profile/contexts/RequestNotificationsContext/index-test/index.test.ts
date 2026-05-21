import { describe, it, expect } from 'vitest';
import * as Module from '..';

describe('features/profile/contexts/RequestNotificationsContext/index exports', () => {
  it('exports RequestNotificationsProvider as a function', () => {
    expect(typeof Module.RequestNotificationsProvider).toBe('function');
  });

  it('exports useRequestNotifications as a function', () => {
    expect(typeof Module.useRequestNotifications).toBe('function');
  });

  it('exports exactly 2 runtime values', () => {
    expect(Object.keys(Module)).toHaveLength(2);
  });
});
