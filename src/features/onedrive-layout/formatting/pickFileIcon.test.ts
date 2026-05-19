import { describe, it, expect } from 'vitest';
import { pickFileIcon, pickFolderIcon } from './pickFileIcon';

describe('pickFolderIcon', () => {
  it('returns a folder chip with its accent color', () => {
    const { Icon, accent } = pickFolderIcon();
    expect(typeof Icon).toBe('function');
    expect(accent).toBe('#eab308');
  });
});

describe('pickFileIcon', () => {
  it('prefers the PDF chip when mediaType is application/pdf', () => {
    const { accent } = pickFileIcon({
      name: 'a.pdf',
      mediaType: 'application/pdf',
    });
    expect(accent).toBe('#b91c1c');
  });

  it('falls back to the schema.org class accent when conformsTo is set', () => {
    const { accent } = pickFileIcon({
      name: 'photo.png',
      mediaType: 'image/png',
      conformsTo: 'http://schema.org/ImageObject',
    });
    expect(accent).toBe('#0d9488');
  });

  it('falls back to the generic DigitalDocument chip when nothing matches', () => {
    const { accent } = pickFileIcon({ name: 'mystery' });
    expect(accent).toBe('#475569');
  });
});
