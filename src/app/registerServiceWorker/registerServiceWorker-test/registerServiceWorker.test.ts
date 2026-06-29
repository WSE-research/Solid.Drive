import { describe, it, expect, vi, beforeEach } from 'vitest';

const { registerSW } = vi.hoisted(() => ({ registerSW: vi.fn() }));
vi.mock('virtual:pwa-register', () => ({ registerSW }));

import { registerServiceWorker } from '../registerServiceWorker-file/registerServiceWorker';

describe('registerServiceWorker', () => {
  beforeEach(() => registerSW.mockReset());

  it('registers the service worker immediately on call', () => {
    registerServiceWorker();
    expect(registerSW).toHaveBeenCalledWith({ immediate: true });
  });
});
