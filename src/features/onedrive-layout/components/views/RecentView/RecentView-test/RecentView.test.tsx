import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CatalogEntry } from '@/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(_key: string, fallback?: string) => fallback ?? _key],
}));

const mockWebId: { current: string | undefined } = {
  current: 'https://owner.example/profile/card#me',
};
const mockSolidFetch = vi.fn();
vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ session: { webId: mockWebId.current }, fetch: mockSolidFetch }),
  useSubject: () => null,
}));

const showError = vi.fn();
vi.mock('@/shared/contexts/NotificationContext', () => ({
  useNotifications: () => ({ showError }),
}));

const mockDownloadResource = vi.fn();
vi.mock('@/features/file-explorer/services/downloadResource', () => ({
  downloadResource: (...args: unknown[]) => mockDownloadResource(...args),
}));

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({ SolidProfileShapeType: {} }));

vi.mock('@/infrastructure/solid/catalog', () => ({
  resolveCatalogUri: () => 'https://owner.example/my-solid-app/catalog.ttl',
}));

vi.mock('@/features/file-explorer/hooks/useDriveInitialization', () => ({
  useDriveInitialization: () => ({ storageRootUri: 'https://owner.example/' }),
}));

const mockEntries: { current: CatalogEntry[] } = { current: [] };
const mockLoading: { current: boolean } = { current: false };
vi.mock('@/features/file-explorer/hooks/useCatalog', () => ({
  useCatalog: () => ({
    entries: mockEntries.current,
    containerUris: new Set(),
    loading: mockLoading.current,
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
    const onOpen = props.onOpen as (entry: CatalogEntry) => void;
    return (
      <div data-testid="recent-files-table" data-count={entries.length}>
        {entries.map((entry) => (
          <span
            key={entry.uri}
            data-testid="visible-row"
            data-uri={entry.uri}
            onClick={() => onOpen(entry)}
          />
        ))}
      </div>
    );
  },
}));

let lastPreviewProps: Record<string, unknown> | undefined;
vi.mock('@/features/onedrive-layout/components/FilePreviewDialog', () => ({
  FilePreviewDialog: (props: Record<string, unknown>) => {
    lastPreviewProps = props;
    const onOpenChange = props.onOpenChange as (next: boolean) => void;
    return (
      <div data-testid="preview-modal" data-uri={props.binaryUri as string}>
        <button
          type="button"
          data-testid="preview-close"
          onClick={() => onOpenChange(false)}
        />
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
    mockLoading.current = false;
    lastTableProps = undefined;
    lastPreviewProps = undefined;
    mockWebId.current = 'https://owner.example/profile/card#me';
    showError.mockClear();
    mockDownloadResource.mockReset().mockResolvedValue({ ok: true });
  });

  it('shows a loading state instead of the table on the first, empty load', () => {
    mockLoading.current = true;
    render(<RecentView />);
    expect(screen.getByText(/loading recent files/i)).toBeInTheDocument();
    expect(screen.queryByTestId('recent-files-table')).not.toBeInTheDocument();
  });

  it('keeps showing the table during a background revalidation that still has entries', () => {
    mockEntries.current = [makeEntry()];
    mockLoading.current = true;
    render(<RecentView />);
    expect(screen.queryByText(/loading recent files/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('recent-files-table')).toBeInTheDocument();
  });

  it('opens the preview dialog for the clicked entry, and closes it', () => {
    const entry = makeEntry({ accessURL: 'https://owner.example/my-solid-app/file/File.pdf' });
    mockEntries.current = [entry];
    render(<RecentView />);
    expect(screen.queryByTestId('preview-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('visible-row'));
    expect(screen.getByTestId('preview-modal')).toBeInTheDocument();
    expect(lastPreviewProps?.binaryUri).toBe(entry.accessURL);
    expect(lastPreviewProps?.title).toBe(entry.title);
    expect(lastPreviewProps?.mediaType).toBe(entry.mediaType);

    fireEvent.click(screen.getByTestId('preview-close'));
    expect(screen.queryByTestId('preview-modal')).not.toBeInTheDocument();
  });

  it('downloads the previewed entry via its accessURL', async () => {
    const entry = makeEntry({ accessURL: 'https://owner.example/my-solid-app/file/File.pdf' });
    mockEntries.current = [entry];
    render(<RecentView />);
    fireEvent.click(screen.getByTestId('visible-row'));

    const onDownload = lastPreviewProps?.onDownload as () => Promise<void>;
    await onDownload();
    expect(mockDownloadResource).toHaveBeenCalledWith(
      entry.accessURL,
      entry.title,
      mockSolidFetch,
    );
  });

  it('shows an error toast when the preview download fails', async () => {
    mockDownloadResource.mockResolvedValue({ ok: false, reason: 'boom' });
    const entry = makeEntry();
    mockEntries.current = [entry];
    render(<RecentView />);
    fireEvent.click(screen.getByTestId('visible-row'));

    const onDownload = lastPreviewProps?.onDownload as () => Promise<void>;
    await onDownload();
    expect(showError).toHaveBeenCalledWith(expect.stringContaining('boom'));
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
