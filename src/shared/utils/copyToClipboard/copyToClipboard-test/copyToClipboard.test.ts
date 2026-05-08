import { describe, it, expect, vi, afterEach } from 'vitest';
import { copyToClipboard } from '../copyToClipboard-file/copyToClipboard';

describe('copyToClipboard', () => {
  it('writes the given text via the injected writer and resolves true', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const ok = await copyToClipboard('https://pod/app/file/', write);
    expect(write).toHaveBeenCalledWith('https://pod/app/file/');
    expect(ok).toBe(true);
  });

  it('resolves false when the writer rejects', async () => {
    const write = vi.fn().mockRejectedValue(new Error('denied'));
    const ok = await copyToClipboard('anything', write);
    expect(ok).toBe(false);
  });

  it('resolves false when null is passed as the writer', async () => {
    const ok = await copyToClipboard('anything', null);
    expect(ok).toBe(false);
  });

  describe('default writer (navigator.clipboard)', () => {
    const originalClipboard = Object.getOwnPropertyDescriptor(
      Navigator.prototype,
      'clipboard',
    );

    afterEach(() => {
      // Restore whatever jsdom had — usually undefined.
      if (originalClipboard) {
        Object.defineProperty(Navigator.prototype, 'clipboard', originalClipboard);
      } else {
        delete (navigator as { clipboard?: unknown }).clipboard;
      }
    });

    it('uses navigator.clipboard.writeText when no writer is passed', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });
      const ok = await copyToClipboard('https://pod/app/file/');
      expect(writeText).toHaveBeenCalledWith('https://pod/app/file/');
      expect(ok).toBe(true);
    });

    it('returns false when navigator.clipboard is unavailable and no writer is passed', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true,
      });
      const ok = await copyToClipboard('anything');
      expect(ok).toBe(false);
    });
  });
});
