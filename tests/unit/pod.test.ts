import { describe, it, expect } from 'vitest';
import {
  formatBytes,
  isLoadable,
  isReadable,
  isBinary,
  isDeletable,
  isReloadable,
  isSolidContainer,
  isSolidLeaf,
} from '../../src/pod';


describe('formatBytes', () => {
  it('returns empty string for undefined', () => {
    expect(formatBytes(undefined)).toBe('');
  });

  it('returns empty string for zero', () => {
    expect(formatBytes('0')).toBe('');
  });

  it('formats bytes under 1 KB', () => {
    expect(formatBytes('512')).toBe('512 B');
  });

  it('formats bytes in KB range', () => {
    expect(formatBytes('2048')).toBe('2.0 KB');
  });

  it('formats bytes in MB range', () => {
    expect(formatBytes('3145728')).toBe('3.0 MB');
  });

  it('rounds to one decimal place', () => {
    expect(formatBytes('1536')).toBe('1.5 KB');
  });
});


describe('isLoadable', () => {
  it('returns true when object has isLoading method', () => {
    expect(isLoadable({ isLoading: () => false })).toBe(true);
  });

  it('returns false for null', () => {
    expect(isLoadable(null)).toBe(false);
  });

  it('returns false when isLoading is missing', () => {
    expect(isLoadable({ reload: () => {} })).toBe(false);
  });
});

describe('isReadable', () => {
  it('returns true when object has isReading method', () => {
    expect(isReadable({ isReading: () => false })).toBe(true);
  });

  it('returns false for null', () => {
    expect(isReadable(null)).toBe(false);
  });

  it('returns false when isReading is missing', () => {
    expect(isReadable({})).toBe(false);
  });
});

describe('isBinary', () => {
  it('returns true when object has isBinary and getBlob', () => {
    expect(isBinary({ isBinary: () => true, getBlob: () => new Blob() })).toBe(true);
  });

  it('returns false when getBlob is missing', () => {
    expect(isBinary({ isBinary: () => true })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isBinary(null)).toBe(false);
  });
});

describe('isDeletable', () => {
  it('returns true when object has delete method', () => {
    expect(isDeletable({ delete: async () => {} })).toBe(true);
  });

  it('returns false when delete is missing', () => {
    expect(isDeletable({})).toBe(false);
  });

  it('returns false for null', () => {
    expect(isDeletable(null)).toBe(false);
  });
});

describe('isReloadable', () => {
  it('returns true when object has reload method', () => {
    expect(isReloadable({ reload: async () => {} })).toBe(true);
  });

  it('returns false when reload is missing', () => {
    expect(isReloadable({})).toBe(false);
  });

  it('returns false for null', () => {
    expect(isReloadable(null)).toBe(false);
  });
});

describe('isSolidContainer', () => {
  it('returns true when object has children function', () => {
    expect(isSolidContainer({ children: () => [] })).toBe(true);
  });

  it('returns false when children is not a function', () => {
    expect(isSolidContainer({ children: [] })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isSolidContainer(null)).toBe(false);
  });
});

describe('isSolidLeaf', () => {
  it('returns true when type is SolidLeaf', () => {
    expect(isSolidLeaf({ type: 'SolidLeaf' })).toBe(true);
  });

  it('returns false when type is different', () => {
    expect(isSolidLeaf({ type: 'SolidContainer' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isSolidLeaf(null)).toBe(false);
  });
});
