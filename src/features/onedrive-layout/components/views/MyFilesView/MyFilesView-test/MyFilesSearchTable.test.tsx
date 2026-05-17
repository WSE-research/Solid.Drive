import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CatalogEntry } from '@/types';
import { MyFilesSearchTable } from '../MyFilesView-file/MyFilesSearchTable';

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, fallback?: string, vars?: Record<string, unknown>) => {
      if (vars?.query !== undefined && fallback) {
        return fallback.replace('{{query}}', String(vars.query));
      }
      return fallback ?? key;
    },
  ],
}));

vi.mock('../MyFilesView-file/SharingCell', () => ({
  SharingCell: ({ uri }: { uri: string }) => (
    <span data-testid="mock-sharing-cell" data-uri={uri} />
  ),
}));

vi.mock('../MyFilesView-file/MyFilesTableHead', () => ({
  MyFilesTableHead: () => <div data-testid="mock-table-head" />,
}));

const baseEntry: CatalogEntry = {
  uri: 'https://pod/app/file1/index.ttl',
  conformsTo: 'https://schema.org/MediaObject',
  title: 'report.pdf',
  description: '',
  modified: '2026-04-01T00:00:00Z',
  publisher: 'https://owner/me',
  mediaType: 'application/pdf',
  byteSize: 12345,
  accessURL: 'https://pod/app/file1/binary',
};

describe('MyFilesSearchTable', () => {
  let onSelect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSelect = vi.fn();
  });

  it('renders a no-results placeholder when results is empty', () => {
    render(
      <MyFilesSearchTable
        query="missing"
        results={[]}
        onSelect={onSelect}
      />,
    );
    expect(
      screen.getByText('No files match "missing"'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('mock-table-head')).not.toBeInTheDocument();
  });

  it('renders one row per result with the entry title', () => {
    render(
      <MyFilesSearchTable
        query="rep"
        results={[baseEntry, { ...baseEntry, uri: 'https://pod/app/file2/index.ttl', title: 'notes.md' }]}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    expect(screen.getByText('notes.md')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('clicking a row calls onSelect with kind: file and the container URI derived from the catalog URI', async () => {
    const user = userEvent.setup();
    render(
      <MyFilesSearchTable
        query="rep"
        results={[baseEntry]}
        onSelect={onSelect}
      />,
    );
    await user.click(screen.getByText('report.pdf'));
    expect(onSelect).toHaveBeenCalledWith({
      kind: 'file',
      uri: 'https://pod/app/file1/',
      name: 'report.pdf',
    });
  });

  it('pressing Enter on a focused row activates the same select handler', () => {
    render(
      <MyFilesSearchTable
        query="rep"
        results={[baseEntry]}
        onSelect={onSelect}
      />,
    );
    const row = screen.getByRole('row');
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('pressing Space on a focused row also activates the select handler', () => {
    render(
      <MyFilesSearchTable
        query="rep"
        results={[baseEntry]}
        onSelect={onSelect}
      />,
    );
    fireEvent.keyDown(screen.getByRole('row'), { key: ' ' });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('non-activation keys do not trigger select', () => {
    render(
      <MyFilesSearchTable
        query="rep"
        results={[baseEntry]}
        onSelect={onSelect}
      />,
    );
    fireEvent.keyDown(screen.getByRole('row'), { key: 'Tab' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('marks the row matching selectedUri with aria-selected', () => {
    render(
      <MyFilesSearchTable
        query="rep"
        results={[baseEntry]}
        selectedUri="https://pod/app/file1/"
        onSelect={onSelect}
      />,
    );
    expect(screen.getByRole('row')).toHaveAttribute('aria-selected', 'true');
  });
});
