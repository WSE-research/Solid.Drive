/**
 * Validates the static PWA artifacts shipped in `public/` and the
 * `index.html` wiring. These files are not modules, so they are read
 * from disk and asserted here to catch regressions (missing icon,
 * malformed manifest, dropped manifest link) without booting a server.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// vitest runs from the package root, so resolve assets against cwd.
const fromRoot = (relative: string): string => resolve(process.cwd(), relative);

const readJson = (relative: string): Record<string, unknown> =>
  JSON.parse(readFileSync(fromRoot(relative), 'utf8'));

describe('public/manifest.webmanifest', () => {
  const manifest = readJson('public/manifest.webmanifest');

  it('declares the required top-level members', () => {
    expect(manifest.name).toBe('Solid.drive');
    expect(manifest.short_name).toBe('Solid.drive');
    expect(manifest.display).toBe('standalone');
    expect(typeof manifest.theme_color).toBe('string');
    expect(typeof manifest.background_color).toBe('string');
  });

  it('uses BASE_URL-relative start_url and scope', () => {
    // Relative members resolve against the manifest URL, which is served
    // under Vite's `base`, so they honour BASE_URL in dev and production
    // without any build-time templating.
    expect(manifest.start_url).toBe('.');
    expect(manifest.scope).toBe('.');
  });

  it('ships 192, 512 and a maskable 512 icon, all relative', () => {
    const icons = manifest.icons as Array<{
      src: string;
      sizes: string;
      type: string;
      purpose?: string;
    }>;
    const bySize = (sizes: string, maskable = false) =>
      icons.find(
        (icon) =>
          icon.sizes === sizes &&
          (maskable
            ? icon.purpose?.includes('maskable')
            : !icon.purpose?.includes('maskable')),
      );

    expect(bySize('192x192')).toBeDefined();
    expect(bySize('512x512')).toBeDefined();
    expect(bySize('512x512', true)).toBeDefined();

    for (const icon of icons) {
      expect(icon.type).toBe('image/png');
      expect(icon.src.startsWith('/')).toBe(false);
      expect(existsSync(fromRoot(`public/${icon.src}`))).toBe(true);
    }
  });
});

describe('public/sw.js', () => {
  const sw = readFileSync(fromRoot('public/sw.js'), 'utf8');

  it('claims clients and skips waiting so it controls the page promptly', () => {
    expect(sw).toContain('self.skipWaiting()');
    expect(sw).toContain('self.clients.claim()');
  });

  it('handles install, activate and fetch lifecycle events', () => {
    expect(sw).toContain("addEventListener('install'");
    expect(sw).toContain("addEventListener('activate'");
    expect(sw).toContain("addEventListener('fetch'");
  });

  it('resolves its scope from its own location, not a hard-coded base', () => {
    expect(sw).toContain('self.location.href');
  });
});

describe('index.html PWA wiring', () => {
  const html = readFileSync(fromRoot('index.html'), 'utf8');

  it('links the manifest with a root-relative href Vite rewrites under base', () => {
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('href="/manifest.webmanifest"');
  });

  it('declares a theme-color matching the manifest', () => {
    const manifest = readJson('public/manifest.webmanifest');
    expect(html).toContain('name="theme-color"');
    expect(html).toContain(`content="${manifest.theme_color}"`);
  });

  it('declares an apple-touch-icon with a root-relative href', () => {
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('href="/icons/icon-192.png"');
  });
});
