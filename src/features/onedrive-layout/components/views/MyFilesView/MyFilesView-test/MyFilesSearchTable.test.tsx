import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CatalogEntry } from '@/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (
      key: string,
      fallback?: string,
      vars?: Record<string, string | number>,
    ) => {
      let out = fallback ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          out = out.replace(`{{${k}}}`, String(v));
        }
      }
      return out;
    },
  ],
}));

vi.mock('../MyFilesView-file/SharingCell', () => ({
  SharingCell: ({ uri }: { uri: string }) => (
    <span data-testid="sharing-cell" data-uri={uri} />
  ),
}));

import { MyFilesSearchTable } from '../MyFilesView-file/MyFilesSearchTable';

const entry = (over: Partial<CatalogEntry> = {}): CatalogEntry => ({
  uri: 'https://pod/app/file1/index.ttl',
  conformsTo: 'https://schema.org/MediaObject',
  title: 'report.pdf',
  description: '',
  modified: '2026-04-01T00:00:00Z',
  publisher: 'https://owner/me',
  mediaType: 'application/pdf',
  byteSize: 12345,
  accessURL: 'https://pod/app/file1/binary',
  ...over,
});

describe('MyFilesSearchTable', () => {
  it('renders the empty state with the query interpolated when there are no results', () => {
    render(
      <MyFilesSearchTable
        query="banana"
        results={[]}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('No files match "banana"')).toBeInTheDocument();
  });

  it('renders one row per catalog entry with the title, modified date, and size', () => {
    render(
      <MyFilesSearchTable
        query="rep"
        results={[entry()]}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole('row', { name: /report\.pdf/i })).toBeInTheDocument();
    expect(screen.getByTestId('sharing-cell')).toHaveAttribute(
      'data-uri',
      'https://pod/app/file1/',
    );
  });

  it('clicking a row calls onSelect with the container URI and title', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <MyFilesSearchTable
        query="rep"
        results={[entry()]}
        onSelect={onSelect}
      />,
    );
    await user.click(screen.getByRole('row', { name: /report\.pdf/i }));
    expect(onSelect).toHaveBeenCalledWith({
      kind: 'file',
      uri: 'https://pod/app/file1/',
      name: 'report.pdf',
    });
  });

  it('Enter and Space keys also trigger row selection', () => {
    const onSelect = vi.fn();
    render(
      <MyFilesSearchTable
        query="rep"
        results={[entry()]}
        onSelect={onSelect}
      />,
    );
    const row = screen.getByRole('row', { name: /report\.pdf/i });
    fireEvent.keyDown(row, { key: 'Enter' });
    fireEvent.keyDown(row, { key: ' ' });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('non-activation keys do not select the row', () => {
    const onSelect = vi.fn();
    render(
      <MyFilesSearchTable
        query="rep"
        results={[entry()]}
        onSelect={onSelect}
      />,
    );
    fireEvent.keyDown(screen.getByRole('row', { name: /report\.pdf/i }), {
      key: 'a',
    });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('marks the row as aria-selected when its container URI matches selectedUri', () => {
    render(
      <MyFilesSearchTable
        query="rep"
        results={[entry()]}
        selectedUri="https://pod/app/file1/"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole('row', { name: /report\.pdf/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
