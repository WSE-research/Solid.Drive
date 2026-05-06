import { describe, it, expect, vi, beforeEach } from 'vitest';
import { copyToClipboard } from '../copyToClipboard-file/copyToClipboard';

describe('copyToClipboard', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('writes the given text to the clipboard and resolves true', async () => {
    const ok = await copyToClipboard('https://pod/app/file/');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://pod/app/file/');
    expect(ok).toBe(true);
  });

  it('resolves false when the clipboard API rejects', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    const ok = await copyToClipboard('anything');
    expect(ok).toBe(false);
  });

  it('resolves false when the clipboard API is unavailable', async () => {
    Object.assign(navigator, { clipboard: undefined });
    const ok = await copyToClipboard('anything');
    expect(ok).toBe(false);
  });
});
