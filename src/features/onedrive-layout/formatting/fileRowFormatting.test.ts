import { describe, it, expect } from 'vitest';
import {
  EMPTY_CELL,
  containerUriFromCatalogUri,
  decodeUriTail,
  formatCatalogSize,
  formatModifiedDate,
  isActivationKey,
  parentFolderLabel,
  safeDecodeUriTail,
} from './fileRowFormatting';

describe('decodeUriTail', () => {
  it('returns the decoded last segment of a folder URI', () => {
    expect(decodeUriTail('https://pod/app/docs/')).toBe('docs');
  });

  it('returns the decoded last segment of a file URI', () => {
    expect(decodeUriTail('https://pod/app/file.txt')).toBe('file.txt');
  });

  it('decodes percent-encoded characters', () => {
    expect(decodeUriTail('https://pod/app/My%20Files/')).toBe('My Files');
  });

  it('returns an empty string for the empty URI', () => {
    expect(decodeUriTail('')).toBe('');
  });
});

describe('containerUriFromCatalogUri', () => {
  it('strips the index.ttl suffix', () => {
    expect(containerUriFromCatalogUri('https://pod/app/file/index.ttl')).toBe(
      'https://pod/app/file/',
    );
  });

  it('passes URIs without the index suffix through unchanged', () => {
    expect(containerUriFromCatalogUri('https://pod/app/file/')).toBe(
      'https://pod/app/file/',
    );
  });
});

describe('formatModifiedDate', () => {
  it('formats an ISO date for the default locale', () => {
    const result = formatModifiedDate('2026-04-30T00:00:00Z');
    expect(result).not.toBe(EMPTY_CELL);
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns the placeholder for undefined', () => {
    expect(formatModifiedDate(undefined)).toBe(EMPTY_CELL);
  });

  it('returns the placeholder for the empty string', () => {
    expect(formatModifiedDate('')).toBe(EMPTY_CELL);
  });
});

describe('formatCatalogSize', () => {
  it('formats a byte count', () => {
    expect(formatCatalogSize(1024)).toBeTruthy();
  });

  it('returns the placeholder for undefined', () => {
    expect(formatCatalogSize(undefined)).toBe(EMPTY_CELL);
  });

  it('formats zero rather than collapsing to the placeholder', () => {
    expect(formatCatalogSize(0)).not.toBe(EMPTY_CELL);
  });
});

describe('safeDecodeUriTail', () => {
  it('decodes a valid percent-encoded tail', () => {
    expect(safeDecodeUriTail('https://pod/app/My%20Files/')).toBe('My Files');
  });

  it('returns the raw tail unchanged when decoding fails', () => {
    expect(safeDecodeUriTail('https://pod/app/%E0%A4%A')).toBe('%E0%A4%A');
  });

  it('falls back to the trimmed input when there is no slash', () => {
    expect(safeDecodeUriTail('bare')).toBe('bare');
  });
});

describe('parentFolderLabel', () => {
  it('returns the parent leaf decoded', () => {
    expect(parentFolderLabel('https://pod/app/docs/index.ttl')).toBe('docs');
  });

  it('returns the parent leaf for a trailing-slash container URI', () => {
    expect(parentFolderLabel('https://pod/app/docs/file/')).toBe('docs');
  });

  it('returns an empty string when there is no parent segment', () => {
    expect(parentFolderLabel('file.txt')).toBe('');
  });

  it('falls back to the raw parent when decoding fails', () => {
    expect(parentFolderLabel('https://pod/%E0%A4%A/file.txt')).toBe('%E0%A4%A');
  });
});

describe('isActivationKey', () => {
  it('returns true for Enter', () => {
    expect(isActivationKey('Enter')).toBe(true);
  });

  it('returns true for Space', () => {
    expect(isActivationKey(' ')).toBe(true);
  });

  it('returns false for other keys', () => {
    expect(isActivationKey('Escape')).toBe(false);
    expect(isActivationKey('Tab')).toBe(false);
    expect(isActivationKey('a')).toBe(false);
  });
});
