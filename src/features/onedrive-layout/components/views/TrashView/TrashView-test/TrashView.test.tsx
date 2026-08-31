import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TrashEntry } from '@/features/file-explorer/hooks/useTrashEntries';

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, fallbackOrOpts?: unknown) => {
      if (typeof fallbackOrOpts === 'string') return fallbackOrOpts;
      const opts = fallbackOrOpts as { defaultValue?: string; name?: string } | undefined;
      const template = opts?.defaultValue ?? key;
      return opts?.name ? template.replace('{{name}}', opts.name) : template;
    },
  ],
}));

vi.mock('@/features/file-explorer/hooks/useDriveInitialization', () => ({
  useDriveInitialization: () => ({ storageRootUri: 'https://pod.example/' }),
}));

const mockRestore = vi.fn();
const mockPurge = vi.fn();
let mockTrashState: { entries: TrashEntry[]; loading: boolean; error: Error | null } = {
  entries: [],
  loading: false,
  error: null,
};
vi.mock('@/features/file-explorer/hooks/useTrashEntries', () => ({
  useTrashEntries: () => ({ ...mockTrashState, restore: mockRestore, purge: mockPurge }),
}));

const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
const mockConfirm = vi.fn();
vi.mock('@/shared/contexts/NotificationContext', () => ({
  useNotifications: () => ({ showSuccess: mockShowSuccess, showError: mockShowError, confirm: mockConfirm }),
}));

import { TrashView } from '../TrashView-file/TrashView';

const item: TrashEntry = {
  kind: 'file',
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
    kind: 'file',
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
  contents: null,
};

describe('TrashView', () => {
  beforeEach(() => {
    mockTrashState = { entries: [item], loading: false, error: null };
    mockRestore.mockReset().mockResolvedValue({ ok: true, restoredContainerUri: 'x', aclRestored: true });
    mockPurge.mockReset().mockResolvedValue({ ok: true });
    mockShowSuccess.mockClear();
    mockShowError.mockClear();
    mockConfirm.mockReset().mockResolvedValue(true);
  });

  it('shows the loading state', () => {
    mockTrashState = { entries: [], loading: true, error: null };
    render(<TrashView />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows the error state', () => {
    mockTrashState = { entries: [], loading: false, error: new Error('boom') };
    render(<TrashView />);
    expect(screen.getByText(/could not load the recycle bin/i)).toBeInTheDocument();
  });

  it('shows both a warning and the recovered entries when the catalog only partly failed to load', () => {
    mockTrashState = { entries: [item], loading: false, error: new Error('boom') };
    render(<TrashView />);
    expect(screen.getByText(/couldn't be loaded/i)).toBeInTheDocument();
    expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    expect(screen.queryByText(/could not load the recycle bin/i)).not.toBeInTheDocument();
  });

  it('renders the table with entries', () => {
    render(<TrashView />);
    expect(screen.getByText('photo.jpg')).toBeInTheDocument();
  });

  it('purges only after the confirm prompt is accepted', async () => {
    const user = userEvent.setup();
    render(<TrashView />);
    await user.click(screen.getByRole('button', { name: /delete permanently: photo\.jpg/i }));
    expect(mockConfirm).toHaveBeenCalled();
    expect(mockPurge).toHaveBeenCalledWith(item);
    expect(mockShowSuccess).toHaveBeenCalled();
  });

  it('does not purge when the confirm prompt is declined', async () => {
    mockConfirm.mockResolvedValue(false);
    const user = userEvent.setup();
    render(<TrashView />);
    await user.click(screen.getByRole('button', { name: /delete permanently: photo\.jpg/i }));
    expect(mockPurge).not.toHaveBeenCalled();
  });

  it('shows a toast saying a file already exists when the original location is occupied', async () => {
    mockRestore.mockResolvedValue({ ok: false, reason: 'occupied' });
    const user = userEvent.setup();
    render(<TrashView />);
    await user.click(screen.getByRole('button', { name: /restore: photo\.jpg/i }));
    expect(mockShowError).toHaveBeenCalledWith(expect.stringMatching(/already exists/i));
  });

  it('shows a generic failure toast when restore fails for another reason', async () => {
    mockRestore.mockResolvedValue({ ok: false, reason: 'failed', detail: 'network down' });
    const user = userEvent.setup();
    render(<TrashView />);
    await user.click(screen.getByRole('button', { name: /restore: photo\.jpg/i }));
    expect(mockShowError).toHaveBeenCalledWith(expect.stringMatching(/restore failed/i));
  });

  it('shows a success toast plus a warning when restore succeeds without restoring sharing permissions', async () => {
    mockRestore.mockResolvedValue({ ok: true, restoredContainerUri: 'x', aclRestored: false });
    const user = userEvent.setup();
    render(<TrashView />);
    await user.click(screen.getByRole('button', { name: /restore: photo\.jpg/i }));
    expect(mockShowSuccess).toHaveBeenCalledWith(expect.stringMatching(/photo\.jpg.*restored/i));
    expect(mockShowError).toHaveBeenCalledWith(expect.stringMatching(/sharing permissions/i));
  });

  it('shows only the success toast when restore fully succeeds, sharing permissions included', async () => {
    const user = userEvent.setup();
    render(<TrashView />);
    await user.click(screen.getByRole('button', { name: /restore: photo\.jpg/i }));
    expect(mockShowSuccess).toHaveBeenCalled();
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it('shows a purge-failure toast including the reason', async () => {
    mockPurge.mockResolvedValue({ ok: false, reason: '403 Forbidden' });
    const user = userEvent.setup();
    render(<TrashView />);
    await user.click(screen.getByRole('button', { name: /delete permanently: photo\.jpg/i }));
    expect(mockShowError).toHaveBeenCalledWith(expect.stringContaining('403 Forbidden'));
  });

  it('does not render the Empty recycle bin button when the trash is empty', () => {
    mockTrashState = { entries: [], loading: false, error: null };
    render(<TrashView />);
    expect(screen.queryByRole('button', { name: /empty recycle bin/i })).not.toBeInTheDocument();
  });

  it('purges every entry after the Empty recycle bin confirm is accepted', async () => {
    const user = userEvent.setup();
    render(<TrashView />);
    await user.click(screen.getByRole('button', { name: /empty recycle bin/i }));
    expect(mockConfirm).toHaveBeenCalled();
    expect(mockPurge).toHaveBeenCalledWith(item);
    expect(mockShowSuccess).toHaveBeenCalled();
  });

  it('does not purge anything when the Empty recycle bin confirm is declined', async () => {
    mockConfirm.mockResolvedValue(false);
    const user = userEvent.setup();
    render(<TrashView />);
    await user.click(screen.getByRole('button', { name: /empty recycle bin/i }));
    expect(mockPurge).not.toHaveBeenCalled();
  });

  it('shows a partial-failure toast when some purges fail while emptying the trash', async () => {
    mockPurge.mockResolvedValue({ ok: false, reason: '403 Forbidden' });
    const user = userEvent.setup();
    render(<TrashView />);
    await user.click(screen.getByRole('button', { name: /empty recycle bin/i }));
    expect(mockShowError).toHaveBeenCalled();
    expect(mockShowSuccess).not.toHaveBeenCalled();
  });
});
