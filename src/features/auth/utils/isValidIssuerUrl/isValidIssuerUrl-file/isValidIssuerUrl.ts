const LOCAL_HOSTNAMES: ReadonlySet<string> = new Set([
  'localhost',
  '127.0.0.1',
  '[::1]',
]);

const PROTOCOL_HTTPS = 'https:';
const PROTOCOL_HTTP = 'http:';

export const isValidIssuerUrl = (value: string): boolean => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  const isHttps = parsed.protocol === PROTOCOL_HTTPS;
  const isLocalHttp =
    parsed.protocol === PROTOCOL_HTTP && LOCAL_HOSTNAMES.has(parsed.hostname);

  return isHttps || isLocalHttp;
};
