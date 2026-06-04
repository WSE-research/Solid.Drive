import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { FileMediaPreview } from '../FileCard-file/FileMediaPreview';

vi.mock('@/config', () => ({
  MIME_PREFIXES: { IMAGE: 'image/', VIDEO: 'video/', AUDIO: 'audio/', TEXT: 'text/' },
  CONTENT_TYPES: { PDF: 'application/pdf' },
}));

const previewUrl = 'https://pod.example/file.bin';

describe('FileMediaPreview', () => {
  it('renders an img for image MIME types', () => {
    const { container } = render(
      <FileMediaPreview previewUrl={previewUrl} mimeType="image/png" name="pic.png" />
    );
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img!.src).toContain(previewUrl);
    expect(img!.alt).toBe('pic.png');
    expect(img!.className).toBe('file-card__preview');
  });

  it('uses "Preview" alt when name is not provided for images', () => {
    const { container } = render(
      <FileMediaPreview previewUrl={previewUrl} mimeType="image/jpeg" />
    );
    const img = container.querySelector('img');
    expect(img!.alt).toBe('Preview');
  });

  it('renders a video element for video MIME types', () => {
    const { container } = render(
      <FileMediaPreview previewUrl={previewUrl} mimeType="video/mp4" name="clip.mp4" />
    );
    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video!.src).toContain(previewUrl);
    expect(video!.hasAttribute('controls')).toBe(true);
    expect(video!.className).toBe('file-card__preview');
  });

  it('renders an audio element for audio MIME types', () => {
    const { container } = render(
      <FileMediaPreview previewUrl={previewUrl} mimeType="audio/mpeg" name="song.mp3" />
    );
    const audio = container.querySelector('audio');
    expect(audio).toBeInTheDocument();
    expect(audio!.src).toContain(previewUrl);
    expect(audio!.hasAttribute('controls')).toBe(true);
    expect(audio!.className).toBe('file-card__preview--audio');
  });

  it('renders an iframe for PDF MIME type', () => {
    const { container } = render(
      <FileMediaPreview previewUrl={previewUrl} mimeType="application/pdf" name="doc.pdf" />
    );
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe!.src).toContain(previewUrl);
    expect(iframe!.title).toBe('doc.pdf');
    expect(iframe!.className).toBe('file-card__preview--doc');
  });

  it('renders an iframe for text MIME types', () => {
    const { container } = render(
      <FileMediaPreview previewUrl={previewUrl} mimeType="text/plain" name="readme.txt" />
    );
    const iframe = container.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe!.title).toBe('readme.txt');
  });

  it('uses "Preview" title for iframe when name not provided', () => {
    const { container } = render(
      <FileMediaPreview previewUrl={previewUrl} mimeType="text/html" />
    );
    const iframe = container.querySelector('iframe');
    expect(iframe!.title).toBe('Preview');
  });

  it('returns null for unsupported MIME types', () => {
    const { container } = render(
      <FileMediaPreview previewUrl={previewUrl} mimeType="application/zip" name="archive.zip" />
    );
    expect(container.innerHTML).toBe('');
  });

  it('injects a dark-theme stylesheet into the document frame on load', () => {
    const { container } = render(
      <FileMediaPreview previewUrl={previewUrl} mimeType="text/plain" name="readme.txt" />
    );
    const iframe = container.querySelector('iframe')!;
    const frameDoc = document.implementation.createHTMLDocument('');
    Object.defineProperty(iframe, 'contentDocument', {
      configurable: true,
      get() {
        return frameDoc;
      },
    });
    fireEvent.load(iframe);
    const injected = frameDoc.head.querySelector('style');
    expect(injected).not.toBeNull();
    expect(injected!.textContent).toContain('color-scheme:dark');
    expect(injected!.textContent).toContain('html,body');
  });

  it('silently ignores a frame whose document is unreachable', () => {
    const { container } = render(
      <FileMediaPreview previewUrl={previewUrl} mimeType="application/pdf" name="doc.pdf" />
    );
    const iframe = container.querySelector('iframe')!;
    Object.defineProperty(iframe, 'contentDocument', {
      configurable: true,
      get() {
        throw new Error('cross-origin');
      },
    });
    expect(() => fireEvent.load(iframe)).not.toThrow();
  });

  it('does nothing when the frame document has no head', () => {
    const { container } = render(
      <FileMediaPreview previewUrl={previewUrl} mimeType="text/plain" name="readme.txt" />
    );
    const iframe = container.querySelector('iframe')!;
    Object.defineProperty(iframe, 'contentDocument', {
      configurable: true,
      get() {
        return {} as Document;
      },
    });
    expect(() => fireEvent.load(iframe)).not.toThrow();
  });
});
