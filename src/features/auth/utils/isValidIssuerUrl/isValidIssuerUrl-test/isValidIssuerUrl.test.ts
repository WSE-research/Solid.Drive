import { describe, it, expect } from 'vitest';
import { isValidIssuerUrl } from '../isValidIssuerUrl-file/isValidIssuerUrl';

describe('isValidIssuerUrl', () => {
  it('returns false for an empty string', () => {
    expect(isValidIssuerUrl('')).toBe(false);
  });

  it('returns false for whitespace only', () => {
    expect(isValidIssuerUrl('   ')).toBe(false);
  });

  it('returns false for a non-URL string', () => {
    expect(isValidIssuerUrl('not a url')).toBe(false);
  });

  it('returns false for a bare hostname without a protocol', () => {
    expect(isValidIssuerUrl('solidcommunity.net')).toBe(false);
  });

  it('returns true for an https URL', () => {
    expect(isValidIssuerUrl('https://solidcommunity.net')).toBe(true);
  });

  it('returns true for an https URL with a path', () => {
    expect(isValidIssuerUrl('https://example.org/oidc')).toBe(true);
  });

  it('trims surrounding whitespace before validating', () => {
    expect(isValidIssuerUrl('  https://solidcommunity.net  ')).toBe(true);
  });

  it('returns true for http://localhost so local CSS development works', () => {
    expect(isValidIssuerUrl('http://localhost:3001')).toBe(true);
  });

  it('returns true for http://127.0.0.1', () => {
    expect(isValidIssuerUrl('http://127.0.0.1:3000')).toBe(true);
  });

  it('returns false for http on a remote host', () => {
    expect(isValidIssuerUrl('http://example.org')).toBe(false);
  });

  it('returns false for unsupported protocols', () => {
    expect(isValidIssuerUrl('ftp://example.org')).toBe(false);
  });
});
