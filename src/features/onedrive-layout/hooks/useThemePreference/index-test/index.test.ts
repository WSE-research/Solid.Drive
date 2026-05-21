import { describe, it, expect } from 'vitest';
import * as api from '../index';

describe('useThemePreference index', () => {
  it('re-exports useThemePreference, isTheme, and applyStoredTheme', () => {
    expect(typeof api.useThemePreference).toBe('function');
    expect(typeof api.isTheme).toBe('function');
    expect(typeof api.applyStoredTheme).toBe('function');
  });
});
