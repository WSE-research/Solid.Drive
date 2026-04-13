import { describe, it, expect } from 'vitest';
import {
  isLoadable,
  isReadable,
  isBinary,
  isDeletable,
  isReloadable,
  isSolidContainer,
  isSolidLeaf,
} from '../resourceGuards-file/resourceGuards';

describe('isLoadable', () => {
  it('returns true when object has the full loadable shape', () => {
    expect(isLoadable({
      isLoading: () => false,
      isUnfetched: () => false,
      isFetched: () => true,
    })).toBe(true);
  });

  it('returns false for null because loadable requires isLoading, isUnfetched, and isFetched', () => {
    expect(isLoadable(null)).toBe(false);
  });

  it('returns false when any required loadable method is missing', () => {
    expect(isLoadable({ isLoading: () => false, isFetched: () => true })).toBe(false);
  });
});

describe('isReadable', () => {
  it('returns true when object has isReading method', () => {
    expect(isReadable({ isReading: () => false })).toBe(true);
  });

  it('returns false for null because readable requires isReading', () => {
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

  it('returns false for null because binary requires isBinary and getBlob', () => {
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

  it('returns false for null because deletable requires delete method', () => {
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

  it('returns false for null because reloadable requires reload method', () => {
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

  it('returns false for null because SolidContainer requires children function', () => {
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

  it('returns false for null because SolidLeaf requires type property', () => {
    expect(isSolidLeaf(null)).toBe(false);
  });
});
