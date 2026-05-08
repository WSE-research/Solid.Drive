import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CatalogEntry } from '@/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(_key: string, fallback?: string) => fallback ?? _key],
}));

const mockWebId: { current: string | undefined } = {
  current: 'https://owner.example/profile/card#me',
};
vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ session: { webId: mockWebId.current } }),
  useSubject: () => null,
}));

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({ SolidProfileShapeType: {} }));

vi.mock('@/infrastructure/solid/catalog', () => ({
  resolveCatalogUri: () => 'https://owner.example/my-solid-app/catalog.ttl',
}));

vi.mock('@/features/file-explorer/hooks/useDriveInitialization', () => ({
  useDriveInitialization: () => ({ storageRootUri: 'https://owner.example/' }),
}));

const mockEntries: { current: CatalogEntry[] } = { current: [] };
vi.mock('@/features/file-explorer/hooks/useCatalog', () => ({
  useCatalog: () => ({
    entries: mockEntries.current,
    containerUris: new Set(),
    loading: false,
    error: null,
  }),
}));

vi.mock('@/shared/utils/getProfileDisplayName', () => ({
  getProfileDisplayName: () => 'Alice',
}));

vi.mock('@/features/onedrive-layout/components/filters/TypeFilterChips', () => ({
  TypeFilterChips: ({
    chips,
    onToggle,
    onReset,
  }: {
    chips: ReadonlyArray<{ id: string }>;
    onToggle: (id: string) => void;
    onReset: () => void;
  }) => (
    <div data-testid="chips-inline" data-count={chips.length}>
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          data-testid={`chip-toggle-${chip.id}`}
          onClick={() => onToggle(chip.id)}
        />
      ))}
      <button
        type="button"
        data-testid="chip-reset"
        onClick={() => onReset()}
      />
    </div>
  ),
  TypeFilterChipsDropdown: ({ chips }: { chips: ReadonlyArray<{ id: string }> }) => (
    <div data-testid="chips-dropdown" data-count={chips.length} />
  ),
}));

vi.mock('@/features/onedrive-layout/components/filters/PersonNameFilter', () => ({
  PersonNameFilter: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (next: string) => void;
  }) => (
    <input
      data-testid="person-filter"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

let lastTableProps: Record<string, unknown> | undefined;
vi.mock('../RecentView-file/RecentFilesTable', () => ({
  RecentFilesTable: (props: Record<string, unknown>) => {
    lastTableProps = props;
    const entries = props.entries as CatalogEntry[];
    return (
      <div data-testid="recent-files-table" data-count={entries.length}>
        {entries.map((entry) => (
          <span key={entry.uri} data-testid="visible-row" data-uri={entry.uri} />
        ))}
      </div>
    );
  },
}));

import { RecentView } from '../RecentView-file/RecentView';

const makeEntry = (overrides: Partial<CatalogEntry> = {}): CatalogEntry => ({
  uri: 'https://owner.example/my-solid-app/file/index.ttl',
  conformsTo: 'http://schema.org/DigitalDocument',
  title: 'File',
  description: '',
  modified: '2026-04-22T10:00:00Z',
  publisher: 'https://owner.example/profile/card#me',
  mediaType: 'application/pdf',
  byteSize: 0,
  accessURL: '',
  ...overrides,
});

describe('RecentView', () => {
  beforeEach(() => {
    mockEntries.current = [];
    lastTableProps = undefined;
    mockWebId.current = 'https://owner.example/profile/card#me';
  });

  it('still renders when the auth-restore window has not produced a WebID yet', () => {
    mockWebId.current = undefined;
    render(<RecentView />);
    expect(screen.getByText('Recent')).toBeInTheDocument();
  });

  it('renders the heading + chip variants + filter input + table', () => {
    render(<RecentView />);
    expect(screen.getByText('Recent')).toBeInTheDocument();
    expect(screen.getByTestId('chips-inline')).toBeInTheDocument();
    expect(screen.getByTestId('chips-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('person-filter')).toBeInTheDocument();
    expect(screen.getByTestId('recent-files-table')).toBeInTheDocument();
  });

  it('passes the resolved owner display name to the table', () => {
    mockEntries.current = [makeEntry()];
    render(<RecentView />);
    expect(lastTableProps?.ownerName).toBe('Alice');
  });

  it('sorts entries by modified date desc (most recent first)', () => {
    mockEntries.current = [
      makeEntry({
        uri: 'https://owner.example/old/index.ttl',
        title: 'Old',
        modified: '2025-01-01T00:00:00Z',
      }),
      makeEntry({
        uri: 'https://owner.example/new/index.ttl',
        title: 'New',
        modified: '2026-06-01T00:00:00Z',
      }),
      makeEntry({
        uri: 'https://owner.example/mid/index.ttl',
        title: 'Mid',
        modified: '2026-01-01T00:00:00Z',
      }),
    ];
    render(<RecentView />);
    const rows = screen.getAllByTestId('visible-row');
    expect(rows.map((row) => row.getAttribute('data-uri'))).toEqual([
      'https://owner.example/new/index.ttl',
      'https://owner.example/mid/index.ttl',
      'https://owner.example/old/index.ttl',
    ]);
  });

  it('filters entries by the person/name query (matches title)', () => {
    mockEntries.current = [
      makeEntry({ uri: 'https://owner.example/a/index.ttl', title: 'Alpha doc' }),
      makeEntry({ uri: 'https://owner.example/b/index.ttl', title: 'Beta doc' }),
    ];
    render(<RecentView />);
    const input = screen.getByTestId('person-filter');
    fireEvent.change(input, { target: { value: 'alph' } });
    const rows = screen.getAllByTestId('visible-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute('data-uri')).toBe(
      'https://owner.example/a/index.ttl',
    );
  });

  it('filters entries by the owner display name (matches ownerName)', () => {
    mockEntries.current = [
      makeEntry({ uri: 'https://owner.example/a/index.ttl', title: 'Alpha doc' }),
      makeEntry({ uri: 'https://owner.example/b/index.ttl', title: 'Beta doc' }),
    ];
    render(<RecentView />);
    // The mock getProfileDisplayName returns 'Alice'; typing 'ali' should
    // match the ownerName and keep both entries visible.
    const input = screen.getByTestId('person-filter');
    fireEvent.change(input, { target: { value: 'ali' } });
    const rows = screen.getAllByTestId('visible-row');
    // Both entries share the same owner 'Alice', so both survive the filter.
    expect(rows).toHaveLength(2);
  });

  it('treats entries with no modified date as epoch (sorted last)', () => {
    mockEntries.current = [
      makeEntry({
        uri: 'https://owner.example/dated/index.ttl',
        title: 'Dated',
        modified: '2026-01-01T00:00:00Z',
      }),
      makeEntry({
        uri: 'https://owner.example/nodated/index.ttl',
        title: 'NoDate',
        modified: undefined,
      }),
    ];
    render(<RecentView />);
    const rows = screen.getAllByTestId('visible-row');
    // 'Dated' should come first (more recent than epoch)
    expect(rows[0].getAttribute('data-uri')).toBe(
      'https://owner.example/dated/index.ttl',
    );
    expect(rows[1].getAttribute('data-uri')).toBe(
      'https://owner.example/nodated/index.ttl',
    );
  });

  it('builds the chip set from the catalog entries', () => {
    mockEntries.current = [
      makeEntry({
        uri: 'https://owner.example/a/index.ttl',
        conformsTo: 'http://schema.org/ImageObject',
      }),
      makeEntry({
        uri: 'https://owner.example/b/index.ttl',
        conformsTo: 'http://schema.org/DigitalDocument',
      }),
    ];
    render(<RecentView />);
    // 2 distinct schema.org classes → 2 chips, plus the synthetic
    // PDF chip if any entry's media type is application/pdf.
    const inline = screen.getByTestId('chips-inline');
    const count = Number(inline.getAttribute('data-count'));
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('toggling a chip narrows the visible entries; toggling the same chip again clears the filter', () => {
    mockEntries.current = [
      makeEntry({
        uri: 'https://owner.example/a/index.ttl',
        conformsTo: 'http://schema.org/ImageObject',
        mediaType: 'image/png',
      }),
      makeEntry({
        uri: 'https://owner.example/b/index.ttl',
        conformsTo: 'http://schema.org/DigitalDocument',
        mediaType: 'application/pdf',
      }),
    ];
    render(<RecentView />);
    const firstChip = screen.getAllByTestId(/^chip-toggle-/)[0];
    // Apply the filter — only entries matching that chip survive.
    fireEvent.click(firstChip);
    expect(screen.getAllByTestId('visible-row').length).toBeLessThan(2);
    // Toggling the same chip again returns the full list.
    fireEvent.click(firstChip);
    expect(screen.getAllByTestId('visible-row')).toHaveLength(2);
  });

  it('resetting the chip selection restores all entries', () => {
    mockEntries.current = [
      makeEntry({
        uri: 'https://owner.example/a/index.ttl',
        conformsTo: 'http://schema.org/ImageObject',
        mediaType: 'image/png',
      }),
      makeEntry({
        uri: 'https://owner.example/b/index.ttl',
        conformsTo: 'http://schema.org/DigitalDocument',
        mediaType: 'application/pdf',
      }),
    ];
    render(<RecentView />);
    const firstChip = screen.getAllByTestId(/^chip-toggle-/)[0];
    fireEvent.click(firstChip);
    fireEvent.click(screen.getByTestId('chip-reset'));
    expect(screen.getAllByTestId('visible-row')).toHaveLength(2);
  });
});
