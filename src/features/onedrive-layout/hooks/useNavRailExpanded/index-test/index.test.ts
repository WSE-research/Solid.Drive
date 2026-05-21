import { describe, it, expect } from 'vitest';
import * as api from '../index';

describe('useNavRailExpanded index', () => {
  it('re-exports useNavRailExpanded', () => {
    expect(typeof api.useNavRailExpanded).toBe('function');
  });
});
