import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrashTable } from '../TrashView-file/TrashTable';
import type { TrashEntry } from '@/features/file-explorer/hooks/useTrashEntries';

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, fallbackOrOpts?: unknown) => {
      if (typeof fallbackOrOpts === 'string') return fallbackOrOpts;
      const opts = fallbackOrOpts as { defaultValue?: string; count?: number } | undefined;
      return opts?.defaultValue ?? key;
    },
  ],
}));

function makeEntry(overrides: Partial<TrashEntry> = {}): TrashEntry {
  return {
    entry: {
      metadataUri: 'https://pod.example/trash/photo-abc/index.ttl',
      binaryUri: 'https://pod.example/trash/photo-abc/photo.jpg',
      classUri: 'http://schema.org/ImageObject',
      mediaType: 'image/jpeg',
      byteSize: 2048,
      title: 'photo.jpg',
      description: '',
      modified: '2026-01-01T00:00:00.000Z',
    },
    containerUri: 'https://pod.example/trash/photo-abc/',
    tombstone: {
      originalContainerUri: 'https://pod.example/my-solid-app/photo-2024/',
      originalParentUri: 'https://pod.example/my-solid-app/',
      originalCatalogUri: 'https://pod.example/catalog.ttl',
      originalInstanceUri: 'https://pod.example/my-solid-app/photo-2024/index.ttl',
      originalBinaryName: 'photo.jpg',
      originalClassUri: 'http://schema.org/ImageObject',
      hasAclSnapshot: true,
      deletedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-12-31T00:00:00.000Z',
    },
    ...overrides,
  };
}

describe('TrashTable', () => {
  it('shows the empty state when there are no entries', () => {
    render(<TrashTable entries={[]} onRestore={vi.fn()} onPurge={vi.fn()} />);
    expect(screen.getByText(/recycle bin is empty/i)).toBeInTheDocument();
  });

  it('renders one row per entry with title and size', () => {
    const entries = [makeEntry(), makeEntry({ containerUri: 'https://pod.example/my-solid-app/trash/doc-def/', entry: { ...makeEntry().entry, title: 'doc.pdf' } })];
    render(<TrashTable entries={entries} onRestore={vi.fn()} onPurge={vi.fn()} />);
    expect(screen.getAllByTestId('trash-row')).toHaveLength(2);
    expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    expect(screen.getByText('doc.pdf')).toBeInTheDocument();
  });

  it('fires onRestore with the entry when Restore is clicked', async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    const entry = makeEntry();
    render(<TrashTable entries={[entry]} onRestore={onRestore} onPurge={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /restore: photo\.jpg/i }));
    expect(onRestore).toHaveBeenCalledWith(entry);
  });

  it('fires onPurge with the entry when Delete permanently is clicked', async () => {
    const user = userEvent.setup();
    const onPurge = vi.fn();
    const entry = makeEntry();
    render(<TrashTable entries={[entry]} onRestore={vi.fn()} onPurge={onPurge} />);
    await user.click(screen.getByRole('button', { name: /delete permanently: photo\.jpg/i }));
    expect(onPurge).toHaveBeenCalledWith(entry);
  });

  it('disables Restore when the tombstone is null, but keeps Purge enabled', () => {
    const entry = makeEntry({ tombstone: null });
    render(<TrashTable entries={[entry]} onRestore={vi.fn()} onPurge={vi.fn()} />);
    expect(screen.getByRole('button', { name: /restore: photo\.jpg/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /delete permanently: photo\.jpg/i })).toBeEnabled();
  });

  it('disables both actions for the busy row only', () => {
    const busyEntry = makeEntry();
    const otherEntry = makeEntry({
      containerUri: 'https://pod.example/my-solid-app/trash/other/',
      entry: { ...makeEntry().entry, title: 'other.pdf' },
    });
    render(
      <TrashTable
        entries={[busyEntry, otherEntry]}
        busyContainerUri={busyEntry.containerUri}
        onRestore={vi.fn()}
        onPurge={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /restore: photo\.jpg/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /delete permanently: photo\.jpg/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /restore: other\.pdf/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /delete permanently: other\.pdf/i })).toBeEnabled();
  });

  it('activates Restore exactly once on Enter key', async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    const entry = makeEntry();
    render(<TrashTable entries={[entry]} onRestore={onRestore} onPurge={vi.fn()} />);
    const button = screen.getByRole('button', { name: /restore: photo\.jpg/i });
    button.focus();
    await user.keyboard('{Enter}');
  
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onRestore).toHaveBeenCalledWith(entry);
  });

  it('falls back to the container URI tail for the title and shows — for the original location when the tombstone is missing', () => {
    const entry = makeEntry({ tombstone: null, entry: { ...makeEntry().entry, title: '' } });
    render(<TrashTable entries={[entry]} onRestore={vi.fn()} onPurge={vi.fn()} />);
    expect(screen.getByText('photo-abc')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
