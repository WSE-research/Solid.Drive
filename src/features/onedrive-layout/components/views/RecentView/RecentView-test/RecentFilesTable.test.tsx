import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CatalogEntry } from '@/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(_key: string, fallback?: string) => fallback ?? _key],
}));

vi.mock('@/features/onedrive-layout/formatting', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/onedrive-layout/formatting')
  >('@/features/onedrive-layout/formatting');
  return {
    ...actual,
    pickFileIcon: () => ({
      Icon: ({ width, height }: { width?: number; height?: number }) => (
        <span data-testid="row-icon" data-w={width} data-h={height} />
      ),
      accent: '#5854d6',
    }),
  };
});

import { RecentFilesTable } from '../RecentView-file/RecentFilesTable';

const makeEntry = (overrides: Partial<CatalogEntry> = {}): CatalogEntry => ({
  uri: 'https://owner.example/my-solid-app/notes/index.ttl',
  conformsTo: 'http://schema.org/DigitalDocument',
  title: 'Notes.docx',
  description: '',
  modified: '2026-04-22T10:00:00Z',
  publisher: 'https://owner.example/profile/card#me',
  mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  byteSize: 1024,
  accessURL: '',
  ...overrides,
});

describe('RecentFilesTable', () => {
  it('shows the empty hint when there are no entries', () => {
    render(<RecentFilesTable entries={[]} ownerName="Alice" onOpen={vi.fn()} />);
    expect(
      screen.getByText(/no recent files/i),
    ).toBeInTheDocument();
  });

  it('renders the column headers (Name / Opened / Owner)', () => {
    render(
      <RecentFilesTable entries={[makeEntry()]} ownerName="Alice" onOpen={vi.fn()} />,
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Opened')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it('renders one row per entry with title + parent folder + owner', () => {
    render(
      <RecentFilesTable
        entries={[
          makeEntry({
            uri: 'https://owner.example/my-solid-app/photos/index.ttl',
            title: 'Beach.jpg',
          }),
        ]}
        ownerName="Alice"
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByText('Beach.jpg')).toBeInTheDocument();
    expect(screen.getByText('photos')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('falls back to the URI tail when the entry title is missing', () => {
    render(
      <RecentFilesTable
        entries={[
          makeEntry({
            uri: 'https://owner.example/my-solid-app/spreadsheet.xlsx',
            title: '',
          }),
        ]}
        ownerName="Alice"
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByText('spreadsheet.xlsx')).toBeInTheDocument();
  });

  it('passes 24x24 width/height to the row icon', () => {
    render(
      <RecentFilesTable entries={[makeEntry()]} ownerName="Alice" onOpen={vi.fn()} />,
    );
    const icon = screen.getByTestId('row-icon');
    expect(icon.getAttribute('data-w')).toBe('24');
    expect(icon.getAttribute('data-h')).toBe('24');
  });

  it('shows empty date cell when entry.modified is undefined', () => {
    render(
      <RecentFilesTable
        entries={[makeEntry({ modified: undefined })]}
        ownerName="Alice"
        onOpen={vi.fn()}
      />,
    );
    // The <span> for the date should be present but empty
    const dateSpan = document.querySelector('.odl-recent-row__date');
    expect(dateSpan?.textContent).toBe('');
  });

  it('shows empty date cell when entry.modified is an invalid date string', () => {
    render(
      <RecentFilesTable
        entries={[makeEntry({ modified: 'not-a-date' })]}
        ownerName="Alice"
        onOpen={vi.fn()}
      />,
    );
    const dateSpan = document.querySelector('.odl-recent-row__date');
    expect(dateSpan?.textContent).toBe('');
  });

  it('renders one row per entry when multiple are passed', () => {
    render(
      <RecentFilesTable
        entries={[
          makeEntry({ uri: 'https://owner.example/a/index.ttl', title: 'A' }),
          makeEntry({ uri: 'https://owner.example/b/index.ttl', title: 'B' }),
          makeEntry({ uri: 'https://owner.example/c/index.ttl', title: 'C' }),
        ]}
        ownerName="Alice"
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId('recent-files-row')).toHaveLength(3);
  });

  it('calls onOpen with the entry when a row is clicked', () => {
    const onOpen = vi.fn();
    const entry = makeEntry();
    render(
      <RecentFilesTable entries={[entry]} ownerName="Alice" onOpen={onOpen} />,
    );
    fireEvent.click(screen.getByTestId('recent-files-row'));
    expect(onOpen).toHaveBeenCalledWith(entry);
  });

  it('calls onOpen when a row is activated with Enter or Space', () => {
    const onOpen = vi.fn();
    render(
      <RecentFilesTable entries={[makeEntry()]} ownerName="Alice" onOpen={onOpen} />,
    );
    const row = screen.getByTestId('recent-files-row');
    fireEvent.keyDown(row, { key: 'Enter' });
    fireEvent.keyDown(row, { key: ' ' });
    expect(onOpen).toHaveBeenCalledTimes(2);
  });
});
