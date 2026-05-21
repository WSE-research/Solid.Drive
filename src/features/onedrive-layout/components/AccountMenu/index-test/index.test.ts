import { describe, it, expect } from 'vitest';
import * as api from '../index';

describe('AccountMenu index', () => {
  it('re-exports the AccountMenu component', () => {
    expect(typeof api.AccountMenu).toBe('function');
  });
});
