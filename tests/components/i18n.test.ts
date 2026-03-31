import { describe, it, expect } from 'vitest';
import i18n from '../../src/i18n';

describe('i18n configuration', () => {
  it('has English as fallback language', () => {
    const fallback = i18n.options.fallbackLng;
    const langs = Array.isArray(fallback) ? fallback : [fallback];
    expect(langs).toContain('en');
  });

  it('supports English and German', () => {
    expect(i18n.options.supportedLngs).toContain('en');
    expect(i18n.options.supportedLngs).toContain('de');
  });

  it('disables HTML escaping so JSX handles it', () => {
    expect(i18n.options.interpolation?.escapeValue).toBe(false);
  });

  it('detects language from localStorage before navigator', () => {
    const order = (i18n.options.detection as { order: string[] })?.order;
    expect(order[0]).toBe('localStorage');
    expect(order[1]).toBe('navigator');
  });

  it('bundles translations for en and de', () => {
    const resources = i18n.options.resources as Record<string, unknown>;
    expect(resources).toHaveProperty('en');
    expect(resources).toHaveProperty('de');
  });
});
