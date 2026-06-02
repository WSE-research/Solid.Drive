import { describe, it, expect } from 'vitest';
import * as Module from '..';

describe('features/file-explorer/components/ContactCatalogBrowser/index exports', () => {
  it('exports ContactCatalogBrowser as a function', () => {
    expect(typeof Module.ContactCatalogBrowser).toBe('function');
  });

  it('exports exactly 1 runtime item', () => {
    expect(Object.keys(Module)).toHaveLength(1);
  });
});
