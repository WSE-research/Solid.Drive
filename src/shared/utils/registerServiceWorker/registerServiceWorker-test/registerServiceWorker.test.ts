import { describe, it, expect, afterEach, vi } from 'vitest';
import { ENV } from '@/config';
import { registerServiceWorker } from '../registerServiceWorker-file/registerServiceWorker';

/** Installs a fake navigator.serviceWorker with the given register impl. */
const stubServiceWorker = (register: ReturnType<typeof vi.fn>): void => {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { register },
    configurable: true,
  });
};

describe('registerServiceWorker', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator as object, 'serviceWorker');
    vi.restoreAllMocks();
  });

  it('resolves to undefined when serviceWorker is unsupported', async () => {
    expect('serviceWorker' in navigator).toBe(false);
    await expect(registerServiceWorker()).resolves.toBeUndefined();
  });

  it('registers ${BASE_URL}sw.js scoped to BASE_URL', async () => {
    const registration = { scope: ENV.baseUrl } as ServiceWorkerRegistration;
    const register = vi.fn().mockResolvedValue(registration);
    stubServiceWorker(register);

    const result = await registerServiceWorker();

    expect(register).toHaveBeenCalledWith(`${ENV.baseUrl}sw.js`, {
      scope: ENV.baseUrl,
    });
    expect(result).toBe(registration);
  });

  it('swallows registration errors and resolves to undefined', async () => {
    const register = vi.fn().mockRejectedValue(new Error('boom'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stubServiceWorker(register);

    await expect(registerServiceWorker()).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
  });
});
