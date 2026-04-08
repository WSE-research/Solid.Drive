import { describe, it, expect } from 'vitest';
import { formatBytes } from '../formatBytes-file/formatBytes';

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
