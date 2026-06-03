import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (_key: string, fallbackOrOpts?: unknown, opts?: { count?: number }) => {
      const fallback =
        typeof fallbackOrOpts === 'string' ? fallbackOrOpts : _key;
      if (opts && typeof opts.count === 'number') {
        return fallback.replace('{{count}}', String(opts.count));
      }
      return fallback;
    },
  ],
}));

vi.mock('@/features/onedrive-layout/icons', () => {
  const Stub = () => <span />;
  return { OpenIcon: Stub, DownloadIcon: Stub, CloseIcon: Stub };
});

import { SharedSelectionToolbar } from '../SharedView-file/SharedSelectionToolbar';

describe('SharedSelectionToolbar', () => {
  it('renders Open, Download, and the selection-count badge with a clear control', () => {
    render(
      <SharedSelectionToolbar
        count={1}
        onOpen={vi.fn()}
        onDownload={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Clear selection' }),
    ).toBeInTheDocument();
  });

  it('fires onOpen when the user clicks Open', () => {
    const onOpen = vi.fn();
    render(
      <SharedSelectionToolbar
        count={1}
        onOpen={onOpen}
        onDownload={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('fires onDownload when the user clicks Download', () => {
    const onDownload = vi.fn();
    render(
      <SharedSelectionToolbar
        count={1}
        onOpen={vi.fn()}
        onDownload={onDownload}
        onClear={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('fires onClear when the user clicks the count badge', () => {
    const onClear = vi.fn();
    render(
      <SharedSelectionToolbar
        count={1}
        onOpen={vi.fn()}
        onDownload={vi.fn()}
        onClear={onClear}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
