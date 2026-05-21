import { describe, it, expect } from 'vitest';
import * as Module from '..';

describe('infrastructure/inbox/inboxSubscription/index exports', () => {
  it('exports subscribeToInbox as a function', () => {
    expect(typeof Module.subscribeToInbox).toBe('function');
  });

  it('exports parseLinkHeaderForRel as a function', () => {
    expect(typeof Module.parseLinkHeaderForRel).toBe('function');
  });

  it('exports exactly 2 runtime values', () => {
    expect(Object.keys(Module)).toHaveLength(2);
  });
});
