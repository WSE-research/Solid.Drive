import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseLinkHeaderForRel, subscribeToInbox } from '../inboxSubscription-file/inboxSubscription';

const INBOX_URI = 'https://pod.example/inbox/';
const STORAGE_DESC_URI = 'https://pod.example/.well-known/solid';
const SUBSCRIPTION_ENDPOINT = 'https://pod.example/.notifications/WebSocketChannel2023/';
const RECEIVE_FROM = 'wss://pod.example/.notifications/WebSocketChannel2023/abc';

const STORAGE_DESC_TURTLE = `
@prefix notify: <http://www.w3.org/ns/solid/notifications#> .
<https://pod.example/.well-known/solid#WebSocketChannel2023>
  notify:channelType notify:WebSocketChannel2023 ;
  notify:subscription <${SUBSCRIPTION_ENDPOINT}> .
`;

const headHeaders = (linkValue: string | null) => ({
  get: (key: string) => (key.toLowerCase() === 'link' ? linkValue : null),
});

class FakeWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static instances: FakeWebSocket[] = [];

  readyState: number = FakeWebSocket.CONNECTING;
  url: string;
  private listeners = new Map<string, ((event: unknown) => void)[]>();

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, fn: (event: unknown) => void): void {
    const arr = this.listeners.get(type) ?? [];
    arr.push(fn);
    this.listeners.set(type, arr);
  }

  emit(type: string, event: unknown = {}): void {
    for (const fn of this.listeners.get(type) ?? []) fn(event);
  }

  close(): void {
    this.readyState = 3;
  }
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  (globalThis as unknown as { WebSocket: typeof FakeWebSocket }).WebSocket = FakeWebSocket;
});

afterEach(() => {
  delete (globalThis as unknown as { WebSocket?: unknown }).WebSocket;
});

describe('parseLinkHeaderForRel', () => {
  it('returns the target URI for a matching rel', () => {
    const header = `<${STORAGE_DESC_URI}>; rel="http://www.w3.org/ns/solid/terms#storageDescription"`;
    expect(parseLinkHeaderForRel(header, 'http://www.w3.org/ns/solid/terms#storageDescription'))
      .toBe(STORAGE_DESC_URI);
  });

  it('handles multiple entries separated by commas', () => {
    const header = `<${STORAGE_DESC_URI}>; rel="http://www.w3.org/ns/solid/terms#storageDescription", <https://x.example/foo>; rel="self"`;
    expect(parseLinkHeaderForRel(header, 'self')).toBe('https://x.example/foo');
  });

  it('handles unquoted rel values', () => {
    const header = `<${STORAGE_DESC_URI}>; rel=http://www.w3.org/ns/solid/terms#storageDescription`;
    expect(parseLinkHeaderForRel(header, 'http://www.w3.org/ns/solid/terms#storageDescription'))
      .toBe(STORAGE_DESC_URI);
  });

  it('returns null when no entry matches', () => {
    expect(parseLinkHeaderForRel(`<x>; rel="other"`, 'self')).toBeNull();
  });
});

describe('subscribeToInbox', () => {
  let fetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetch = vi.fn(async (uri: string, init?: { method?: string }) => {
      if (init?.method === 'HEAD' && uri === INBOX_URI) {
        return {
          ok: true,
          headers: headHeaders(
            `<${STORAGE_DESC_URI}>; rel="http://www.w3.org/ns/solid/terms#storageDescription"`,
          ),
        };
      }
      if (uri === STORAGE_DESC_URI) {
        return {
          ok: true,
          text: async () => STORAGE_DESC_TURTLE,
          headers: headHeaders(null),
        };
      }
      if (uri === SUBSCRIPTION_ENDPOINT && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            type: 'WebSocketChannel2023',
            topic: INBOX_URI,
            receiveFrom: RECEIVE_FROM,
          }),
          headers: headHeaders(null),
        };
      }
      return { ok: false, status: 404, statusText: 'Not Found', headers: headHeaders(null) };
    });
  });

  it('discovers the subscription endpoint and opens a WebSocket', async () => {
    const onNotify = vi.fn();
    const handle = await subscribeToInbox(INBOX_URI, fetch as never, onNotify);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].url).toBe(RECEIVE_FROM);
    handle.close();
  });

  it('forwards each WebSocket message to onNotify', async () => {
    const onNotify = vi.fn();
    await subscribeToInbox(INBOX_URI, fetch as never, onNotify);
    FakeWebSocket.instances[0].emit('message');
    FakeWebSocket.instances[0].emit('message');
    expect(onNotify).toHaveBeenCalledTimes(2);
  });

  it('does not call onNotify after the handle is closed', async () => {
    const onNotify = vi.fn();
    const handle = await subscribeToInbox(INBOX_URI, fetch as never, onNotify);
    handle.close();
    FakeWebSocket.instances[0].emit('message');
    expect(onNotify).not.toHaveBeenCalled();
  });

  it('throws when the inbox has no storageDescription link relation', async () => {
    fetch.mockReset();
    fetch.mockImplementation(async () => ({
      ok: true,
      headers: headHeaders('<x>; rel="other"'),
    }));
    await expect(subscribeToInbox(INBOX_URI, fetch as never, vi.fn())).rejects.toThrow(
      /storageDescription/,
    );
  });

  it('throws when the storage description has no WebSocketChannel2023 endpoint', async () => {
    fetch.mockReset();
    fetch.mockImplementation(async (uri: string, init?: { method?: string }) => {
      if (init?.method === 'HEAD') {
        return {
          ok: true,
          headers: headHeaders(
            `<${STORAGE_DESC_URI}>; rel="http://www.w3.org/ns/solid/terms#storageDescription"`,
          ),
        };
      }
      if (uri === STORAGE_DESC_URI) {
        return {
          ok: true,
          text: async () => '@prefix x: <https://x.example/> . <a> x:y "z" .',
          headers: headHeaders(null),
        };
      }
      return { ok: false, status: 404, statusText: 'x', headers: headHeaders(null) };
    });
    await expect(subscribeToInbox(INBOX_URI, fetch as never, vi.fn())).rejects.toThrow(
      /WebSocketChannel2023/,
    );
  });

  it('throws when the subscription POST fails', async () => {
    fetch.mockReset();
    fetch.mockImplementation(async (uri: string, init?: { method?: string }) => {
      if (init?.method === 'HEAD') {
        return {
          ok: true,
          headers: headHeaders(
            `<${STORAGE_DESC_URI}>; rel="http://www.w3.org/ns/solid/terms#storageDescription"`,
          ),
        };
      }
      if (uri === STORAGE_DESC_URI) {
        return {
          ok: true,
          text: async () => STORAGE_DESC_TURTLE,
          headers: headHeaders(null),
        };
      }
      if (init?.method === 'POST') {
        return { ok: false, status: 500, statusText: 'Server Error', headers: headHeaders(null) };
      }
      return { ok: false, status: 404, statusText: 'x', headers: headHeaders(null) };
    });
    await expect(subscribeToInbox(INBOX_URI, fetch as never, vi.fn())).rejects.toThrow(/500/);
  });

  it('throws when the subscription response lacks receiveFrom', async () => {
    fetch.mockReset();
    fetch.mockImplementation(async (uri: string, init?: { method?: string }) => {
      if (init?.method === 'HEAD') {
        return {
          ok: true,
          headers: headHeaders(
            `<${STORAGE_DESC_URI}>; rel="http://www.w3.org/ns/solid/terms#storageDescription"`,
          ),
        };
      }
      if (uri === STORAGE_DESC_URI) {
        return {
          ok: true,
          text: async () => STORAGE_DESC_TURTLE,
          headers: headHeaders(null),
        };
      }
      if (init?.method === 'POST') {
        return { ok: true, json: async () => ({}), headers: headHeaders(null) };
      }
      return { ok: false, status: 404, statusText: 'x', headers: headHeaders(null) };
    });
    await expect(subscribeToInbox(INBOX_URI, fetch as never, vi.fn())).rejects.toThrow(
      /receiveFrom/,
    );
  });

  it('reports WebSocket errors via onError', async () => {
    const onError = vi.fn();
    await subscribeToInbox(INBOX_URI, fetch as never, vi.fn(), onError);
    FakeWebSocket.instances[0].emit('error', { type: 'error' });
    expect(onError).toHaveBeenCalled();
  });
});
