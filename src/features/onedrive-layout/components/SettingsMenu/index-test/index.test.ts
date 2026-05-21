import { describe, it, expect } from 'vitest';
import * as api from '../index';

describe('SettingsMenu index', () => {
  it('re-exports the SettingsMenu component', () => {
    expect(typeof api.SettingsMenu).toBe('function');
  });
});
