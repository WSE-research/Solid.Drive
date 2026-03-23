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

// ─── formatBytes ────────────────────────────────────────────────────────────

describe('formatBytes', () => {
  it('returns empty string for undefined', () => {
    expect(formatBytes(undefined)).toBe('');
  });

  it('returns empty string for zero bytes', () => {
    expect(formatBytes('0')).toBe('');
  });

  it('returns bytes for values under 1 KB', () => {
    expect(formatBytes('512')).toBe('512 B');
    expect(formatBytes('1')).toBe('1 B');
    expect(formatBytes('1023')).toBe('1023 B');
  });

  it('returns KB for values between 1 KB and 1 MB', () => {
    expect(formatBytes('1024')).toBe('1.0 KB');
    expect(formatBytes('2048')).toBe('2.0 KB');
    expect(formatBytes('1536')).toBe('1.5 KB');
  });

  it('returns MB for values 1 MB and above', () => {
    expect(formatBytes('1048576')).toBe('1.0 MB');
    expect(formatBytes('2097152')).toBe('2.0 MB');
    expect(formatBytes('1572864')).toBe('1.5 MB');
  });

  it('returns empty string for non-numeric strings', () => {
    expect(formatBytes('abc')).toBe('');
  });
});

// ─── Type guards ─────────────────────────────────────────────────────────────

describe('isLoadable', () => {
  it('returns true when object has isLoading method', () => {
    expect(isLoadable({ isLoading: () => false })).toBe(true);
  });

  it('returns false for null', () => {
    expect(isLoadable(null)).toBe(false);
  });

  it('returns false for object missing isLoading', () => {
    expect(isLoadable({ other: true })).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(isLoadable(42)).toBe(false);
    expect(isLoadable('string')).toBe(false);
  });
});

describe('isReadable', () => {
  it('returns true when object has isReading method', () => {
    expect(isReadable({ isReading: () => false })).toBe(true);
  });

  it('returns false for null', () => {
    expect(isReadable(null)).toBe(false);
  });

  it('returns false for object missing isReading', () => {
    expect(isReadable({ isLoading: () => false })).toBe(false);
  });
});

describe('isBinary', () => {
  it('returns true when object has isBinary and getBlob', () => {
    expect(isBinary({ isBinary: () => true, getBlob: () => new Blob() })).toBe(true);
  });

  it('returns false when getBlob is missing', () => {
    expect(isBinary({ isBinary: () => true })).toBe(false);
  });

  it('returns false when isBinary is missing', () => {
    expect(isBinary({ getBlob: () => new Blob() })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isBinary(null)).toBe(false);
  });
});

describe('isDeletable', () => {
  it('returns true when object has delete method', () => {
    expect(isDeletable({ delete: async () => {} })).toBe(true);
  });

  it('returns false for null', () => {
    expect(isDeletable(null)).toBe(false);
  });

  it('returns false for object missing delete', () => {
    expect(isDeletable({ remove: async () => {} })).toBe(false);
  });
});

describe('isReloadable', () => {
  it('returns true when object has reload method', () => {
    expect(isReloadable({ reload: async () => {} })).toBe(true);
  });

  it('returns false for null', () => {
    expect(isReloadable(null)).toBe(false);
  });

  it('returns false for object missing reload', () => {
    expect(isReloadable({ refresh: async () => {} })).toBe(false);
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

  it('returns false for object missing children', () => {
    expect(isSolidContainer({ uri: 'https://pod.example.com/' })).toBe(false);
  });
});

describe('isSolidLeaf', () => {
  it('returns true when object has type === "SolidLeaf"', () => {
    expect(isSolidLeaf({ type: 'SolidLeaf' })).toBe(true);
  });

  it('returns false for different type value', () => {
    expect(isSolidLeaf({ type: 'SolidContainer' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isSolidLeaf(null)).toBe(false);
  });

  it('returns false for object missing type', () => {
    expect(isSolidLeaf({ uri: 'https://pod.example.com/file.txt' })).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isSolidLeaf(undefined)).toBe(false);
  });
});
